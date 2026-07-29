import {
  compareFixedRateAmortizations,
  generateFixedRateAmortization,
  type FixedRateAmortizationComparison,
  type FixedRateAmortizationResult,
  type OneTimeExtraPayment,
} from '../amortization/fixed-rate.js';
import { type Loan } from '../loan/loan.js';
import { Money } from '../money.js';
import { type ProjectionScenarioSnapshot } from '../ports/loan-repository.js';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SCENARIO_KIND = 'one_time_extra_payment_v1';
const MAXIMUM_PERIODS = 600;

export type OneTimeExtraPaymentScenario = ProjectionScenarioSnapshot &
  Readonly<{
    configuration: Readonly<{
      kind: typeof SCENARIO_KIND;
      extraPayment: Readonly<{ id: string; date: string; amount: string; currency: string }>;
    }>;
  }>;

export type OneTimeExtraPaymentComparison = Readonly<{
  base: FixedRateAmortizationResult;
  alternative: FixedRateAmortizationResult;
  comparison: FixedRateAmortizationComparison;
}>;

export class ScenarioValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioValidationError';
  }
}

export function createOneTimeExtraPaymentScenario(input: {
  id: string;
  loanId: string;
  name: string;
  createdAt: string;
  extraPayment: OneTimeExtraPayment;
}): OneTimeExtraPaymentScenario {
  if (!input.id.trim() || !input.loanId.trim() || !input.name.trim() || !input.createdAt.trim()) {
    throw new ScenarioValidationError(
      'El escenario requiere identificador, préstamo, nombre y fecha.',
    );
  }
  if (!input.extraPayment.id.trim() || !isIsoDate(input.extraPayment.date)) {
    throw new ScenarioValidationError('El pago extraordinario requiere identificador y fecha ISO.');
  }
  if (!input.extraPayment.amount.isPositive()) {
    throw new ScenarioValidationError('El pago extraordinario debe ser positivo.');
  }
  return Object.freeze({
    id: input.id,
    loanId: input.loanId,
    name: input.name,
    createdAt: input.createdAt,
    configuration: Object.freeze({
      kind: SCENARIO_KIND,
      extraPayment: Object.freeze({
        id: input.extraPayment.id,
        date: input.extraPayment.date,
        amount: input.extraPayment.amount.toDecimalString(),
        currency: input.extraPayment.amount.currency,
      }),
    }),
  });
}

export function compareLoanWithOneTimeExtraPayment(input: {
  loan: Loan;
  scenario: OneTimeExtraPaymentScenario;
}): OneTimeExtraPaymentComparison {
  if (input.scenario.loanId !== input.loan.id) {
    throw new ScenarioValidationError('El escenario pertenece a otro préstamo.');
  }
  const extraPayment = deserializeExtraPayment(input.scenario);
  if (extraPayment.amount.currency !== input.loan.initialBalance.currency) {
    throw new ScenarioValidationError('El pago extraordinario debe usar la moneda del préstamo.');
  }
  const periodEndDates = generatePeriodEndDates(input.loan.startDate, input.loan.periodsPerYear);
  const base = projectLoanAmortization(input.loan);
  const alternative = generateFixedRateAmortization({
    openingBalance: input.loan.initialBalance,
    annualNominalRate: input.loan.annualNominalRate,
    periodsPerYear: input.loan.periodsPerYear,
    ordinaryPayment: input.loan.ordinaryPayment,
    startDate: input.loan.startDate,
    periodEndDates,
    roundingPolicy: input.loan.roundingPolicy,
    extraPayments: [extraPayment],
    ...(input.loan.variableRatePlan ? { variableRatePlan: input.loan.variableRatePlan } : {}),
  });
  return Object.freeze({
    base,
    alternative,
    comparison: compareFixedRateAmortizations(base, alternative),
  });
}

export function projectLoanAmortization(loan: Loan): FixedRateAmortizationResult {
  return generateFixedRateAmortization({
    openingBalance: loan.initialBalance,
    annualNominalRate: loan.annualNominalRate,
    periodsPerYear: loan.periodsPerYear,
    ordinaryPayment: loan.ordinaryPayment,
    startDate: loan.startDate,
    periodEndDates: generatePeriodEndDates(loan.startDate, loan.periodsPerYear),
    roundingPolicy: loan.roundingPolicy,
    ...(loan.variableRatePlan ? { variableRatePlan: loan.variableRatePlan } : {}),
  });
}

export function isOneTimeExtraPaymentScenario(
  scenario: ProjectionScenarioSnapshot,
): scenario is OneTimeExtraPaymentScenario {
  const configuration = scenario.configuration;
  const extraPayment = configuration.extraPayment;
  return (
    configuration.kind === SCENARIO_KIND &&
    typeof extraPayment === 'object' &&
    extraPayment !== null &&
    typeof (extraPayment as Record<string, unknown>).id === 'string' &&
    typeof (extraPayment as Record<string, unknown>).date === 'string' &&
    typeof (extraPayment as Record<string, unknown>).amount === 'string' &&
    typeof (extraPayment as Record<string, unknown>).currency === 'string'
  );
}

function deserializeExtraPayment(scenario: OneTimeExtraPaymentScenario): OneTimeExtraPayment {
  const configuration = scenario.configuration;
  if (configuration.kind !== SCENARIO_KIND) {
    throw new ScenarioValidationError(
      'El escenario no usa una configuración de pago extraordinario compatible.',
    );
  }
  return Object.freeze({
    id: configuration.extraPayment.id,
    date: configuration.extraPayment.date,
    amount: Money.from(configuration.extraPayment.amount, configuration.extraPayment.currency),
  });
}

function generatePeriodEndDates(startDate: string, periodsPerYear: number): readonly string[] {
  if (!isIsoDate(startDate) || !Number.isInteger(periodsPerYear) || periodsPerYear <= 0) {
    throw new ScenarioValidationError('El préstamo requiere fecha inicial y frecuencia válidas.');
  }
  if (12 % periodsPerYear !== 0) {
    throw new ScenarioValidationError(
      'La comparación inicial solo admite frecuencias que dividan 12.',
    );
  }
  const monthsPerPeriod = 12 / periodsPerYear;
  return Object.freeze(
    Array.from({ length: MAXIMUM_PERIODS }, (_, index) =>
      addMonths(startDate, monthsPerPeriod * (index + 1)),
    ),
  );
}

function addMonths(date: string, months: number): string {
  const match = ISO_DATE.exec(date);
  if (!match) throw new ScenarioValidationError('La fecha debe usar formato ISO.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const base = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
  );
}
