import { Money, type RoundingPolicy } from '../money.js';
import {
  resolveAnnualRateForPeriod,
  type ManualVariableRatePlan,
} from '../interest/manual-variable-rate.js';
import { type TbpMarginRatePlan } from '../interest/tbp-margin-rate.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NON_NEGATIVE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export type Loan = Readonly<{
  id: string;
  name: string;
  startDate: string;
  initialBalance: Money;
  ordinaryPayment: Money;
  annualNominalRate: string;
  variableRatePlan?: ManualVariableRatePlan;
  tbpMarginRatePlan?: TbpMarginRatePlan;
  periodsPerYear: number;
  roundingPolicy: RoundingPolicy;
  contract?: LoanContract;
}>;

export type CreateLoanInput = Loan;

export type LoanTerm = Readonly<{ endDate: string }> | Readonly<{ totalInstallments: number }>;

export type LoanContractV2 = Readonly<{
  version: 2;
  originalPrincipal: Money;
  monthlyInstallment: Money;
  monthlyInsurance: Money;
  term: LoanTerm;
}>;

export type LoanContractV3 = Readonly<{
  version: 3;
  originalPrincipal: Money;
  monthlyTotalPayment: Money;
  monthlyInsurance: Money;
  term: LoanTerm;
}>;

export type LoanContract = LoanContractV2 | LoanContractV3;

export type CreateLoanV2Input = Readonly<{
  id: string;
  name: string;
  startDate: string;
  originalPrincipal: Money;
  monthlyInstallment: Money;
  monthlyInsurance: Money;
  term: LoanTerm;
  annualNominalRate: string;
  variableRatePlan?: ManualVariableRatePlan;
  tbpMarginRatePlan?: TbpMarginRatePlan;
  roundingPolicy: RoundingPolicy;
}>;

export type CreateLoanV3Input = Readonly<{
  id: string;
  name: string;
  startDate: string;
  originalPrincipal: Money;
  monthlyTotalPayment: Money;
  monthlyInsurance: Money;
  term: LoanTerm;
  annualNominalRate: string;
  variableRatePlan?: ManualVariableRatePlan;
  tbpMarginRatePlan?: TbpMarginRatePlan;
  roundingPolicy: RoundingPolicy;
}>;

export class LoanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoanValidationError';
  }
}

export function createLoan(input: CreateLoanInput): Loan {
  if (!input.id.trim()) throw new LoanValidationError('El préstamo requiere un identificador.');
  if (!input.name.trim()) throw new LoanValidationError('El préstamo requiere un nombre.');
  if (!ISO_DATE.test(input.startDate)) {
    throw new LoanValidationError('La fecha de inicio debe usar el formato ISO YYYY-MM-DD.');
  }
  if (!input.initialBalance.isPositive()) {
    throw new LoanValidationError('El saldo inicial debe ser positivo.');
  }
  if (!input.ordinaryPayment.isPositive()) {
    throw new LoanValidationError('La cuota ordinaria debe ser positiva.');
  }
  if (input.initialBalance.currency !== input.ordinaryPayment.currency) {
    throw new LoanValidationError('El saldo inicial y la cuota deben usar la misma moneda.');
  }
  if (!NON_NEGATIVE_DECIMAL.test(input.annualNominalRate)) {
    throw new LoanValidationError('La tasa nominal anual debe ser un decimal no negativo.');
  }
  if (!Number.isInteger(input.periodsPerYear) || input.periodsPerYear <= 0) {
    throw new LoanValidationError('Los periodos por año deben ser un entero positivo.');
  }
  if (input.variableRatePlan || input.tbpMarginRatePlan) {
    resolveAnnualRateForPeriod({
      fixedAnnualNominalRate: input.annualNominalRate,
      ...(input.variableRatePlan ? { variableRatePlan: input.variableRatePlan } : {}),
      ...(input.tbpMarginRatePlan ? { tbpMarginRatePlan: input.tbpMarginRatePlan } : {}),
      periodNumber:
        (input.variableRatePlan?.fixedPeriods ?? input.tbpMarginRatePlan?.fixedPeriods ?? 0) + 1,
      periodEndDate: input.variableRatePlan?.variableRates[0]?.effectiveDate ?? input.startDate,
    });
  }
  if (input.contract) {
    validateContract(input.contract, input.startDate, input.initialBalance.currency);
    if (!sameMoney(input.contract.originalPrincipal, input.initialBalance)) {
      throw new LoanValidationError(
        'El contrato debe coincidir con el monto original del préstamo.',
      );
    }
    const expectedBasePayment =
      input.contract.version === 2
        ? input.contract.monthlyInstallment
        : input.contract.monthlyTotalPayment.subtract(input.contract.monthlyInsurance);
    if (!sameMoney(expectedBasePayment, input.ordinaryPayment))
      throw new LoanValidationError('El contrato debe coincidir con la cuota base del préstamo.');
  }
  return Object.freeze({ ...input });
}

/** Crea el contrato v2 sin eliminar la representación v1 necesaria durante la migración. */
export function createLoanV2(input: CreateLoanV2Input): Loan {
  validateContract(
    {
      version: 2,
      originalPrincipal: input.originalPrincipal,
      monthlyInstallment: input.monthlyInstallment,
      monthlyInsurance: input.monthlyInsurance,
      term: input.term,
    },
    input.startDate,
    input.originalPrincipal.currency,
  );
  return createLoan({
    id: input.id,
    name: input.name,
    startDate: input.startDate,
    initialBalance: input.originalPrincipal,
    ordinaryPayment: input.monthlyInstallment,
    annualNominalRate: input.annualNominalRate,
    ...(input.variableRatePlan ? { variableRatePlan: input.variableRatePlan } : {}),
    ...(input.tbpMarginRatePlan ? { tbpMarginRatePlan: input.tbpMarginRatePlan } : {}),
    periodsPerYear: 12,
    roundingPolicy: input.roundingPolicy,
    contract: Object.freeze({
      version: 2,
      originalPrincipal: input.originalPrincipal,
      monthlyInstallment: input.monthlyInstallment,
      monthlyInsurance: input.monthlyInsurance,
      term: Object.freeze({ ...input.term }),
    }),
  });
}

/** Crea el contrato v3: la cuota ingresada incluye el seguro mensual. */
export function createLoanV3(input: CreateLoanV3Input): Loan {
  const contract: LoanContractV3 = Object.freeze({
    version: 3,
    originalPrincipal: input.originalPrincipal,
    monthlyTotalPayment: input.monthlyTotalPayment,
    monthlyInsurance: input.monthlyInsurance,
    term: Object.freeze({ ...input.term }),
  });
  validateContract(contract, input.startDate, input.originalPrincipal.currency);
  const basePayment = input.monthlyTotalPayment.subtract(input.monthlyInsurance);
  return createLoan({
    id: input.id,
    name: input.name,
    startDate: input.startDate,
    initialBalance: input.originalPrincipal,
    ordinaryPayment: basePayment,
    annualNominalRate: input.annualNominalRate,
    ...(input.variableRatePlan ? { variableRatePlan: input.variableRatePlan } : {}),
    ...(input.tbpMarginRatePlan ? { tbpMarginRatePlan: input.tbpMarginRatePlan } : {}),
    periodsPerYear: 12,
    roundingPolicy: input.roundingPolicy,
    contract,
  });
}

export function isLegacyLoan(loan: Loan): boolean {
  return !loan.contract;
}

export function requiresContractMigration(loan: Loan): boolean {
  return !loan.contract || loan.contract.version !== 3;
}

function validateContract(contract: LoanContract, startDate: string, currency: string): void {
  if (contract.version !== 2 && contract.version !== 3)
    throw new LoanValidationError('La versión del contrato no es compatible.');
  if (!contract.originalPrincipal.isPositive()) {
    throw new LoanValidationError('El monto original debe ser positivo.');
  }
  if (contract.monthlyInsurance.isNegative()) {
    throw new LoanValidationError('El seguro mensual no puede ser negativo.');
  }
  const monthlyPayment =
    contract.version === 2 ? contract.monthlyInstallment : contract.monthlyTotalPayment;
  if (monthlyPayment.isZero() || !monthlyPayment.isPositive()) {
    throw new LoanValidationError('La cuota mensual debe ser positiva.');
  }
  const amounts = [contract.originalPrincipal, monthlyPayment, contract.monthlyInsurance];
  if (amounts.some((amount) => amount.currency !== currency)) {
    throw new LoanValidationError('El contrato debe usar una única moneda.');
  }
  if (
    contract.version === 3 &&
    (contract.monthlyTotalPayment.subtract(contract.monthlyInsurance).isZero() ||
      !contract.monthlyTotalPayment.subtract(contract.monthlyInsurance).isPositive())
  ) {
    throw new LoanValidationError(
      'La cuota total menos el seguro debe dejar una cuota base positiva.',
    );
  }
  const hasEndDate = 'endDate' in contract.term;
  const hasTotalInstallments = 'totalInstallments' in contract.term;
  if (hasEndDate === hasTotalInstallments) {
    throw new LoanValidationError(
      'El plazo debe declarar exactamente una fecha final o cantidad de cuotas.',
    );
  }
  if (hasEndDate) {
    if (!ISO_DATE.test(contract.term.endDate) || contract.term.endDate <= startDate) {
      throw new LoanValidationError('La fecha final debe ser ISO y posterior al inicio.');
    }
  } else if (
    !Number.isInteger(contract.term.totalInstallments) ||
    contract.term.totalInstallments <= 0
  ) {
    throw new LoanValidationError('La cantidad total de cuotas debe ser un entero positivo.');
  }
}

function sameMoney(first: Money, second: Money): boolean {
  return first.currency === second.currency && first.toDecimalString() === second.toDecimalString();
}
