import { calculateFixedNominalInterest } from '../interest/fixed-rate.js';
import { resolveAnnualRateForPeriod } from '../interest/manual-variable-rate.js';
import { Money } from '../money.js';
import { Decimal } from 'decimal.js';

import { type Loan } from './loan.js';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ContractEstimatePeriod = Readonly<{
  period: number;
  date: string;
  openingBalance: Money;
  interest: Money;
  principal: Money;
  installment: Money;
  insurance: Money;
  totalDue: Money;
  closingBalance: Money;
}>;

export type LoanContractEstimate = Readonly<{
  status: 'settled_early' | 'settled_on_term' | 'remaining_balance';
  contractualInstallments: number;
  estimatedInstallments: number;
  finalInstallmentDate: string;
  estimatedPrincipal: Money;
  estimatedInterest: Money;
  estimatedInsurance: Money;
  estimatedTotal: Money;
  finalInstallment: Money;
  finalInsurance: Money;
  finalTotalDue: Money;
  hasAdjustedFinalInstallment: boolean;
  remainingPrincipal: Money;
  configuredTotalPayment?: Money;
  projectedInitialTotalPayment?: Money;
  automaticTotalPayment?: Money;
  initialPaymentDifference?: Money;
  hasConfiguredPaymentDifference: boolean;
  periods: readonly ContractEstimatePeriod[];
}>;

export class ContractEstimateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractEstimateError';
  }
}

/**
 * Proyecta un contrato v2 o v3 con su cuota base y seguro mensual separado.
 * La estimación usa tasa nominal anual dividida entre doce y no sustituye el
 * estado histórico ni una liquidación bancaria.
 */
export function estimateLoanContract(loan: Loan): LoanContractEstimate {
  const contract = loan.contract;
  if (!contract) {
    throw new ContractEstimateError('La estimación requiere un contrato con plazo y seguro.');
  }
  if (loan.periodsPerYear !== 12) {
    throw new ContractEstimateError(
      'La estimación contractual inicial solo admite pagos mensuales.',
    );
  }

  const dates = generateMonthlyDates(loan.startDate, contract.term);
  const zero = Money.from('0', loan.initialBalance.currency);
  let openingBalance = loan.initialBalance;
  let periodStartDate = loan.startDate;
  let estimatedInterest = zero;
  let estimatedPrincipal = zero;
  let estimatedInsurance = zero;
  let estimatedTotal = zero;
  const periods: ContractEstimatePeriod[] = [];
  let projectedInitialTotalPayment: Money | undefined;

  for (const [index, date] of dates.entries()) {
    const rate = resolveAnnualRateForPeriod({
      fixedAnnualNominalRate: loan.annualNominalRate,
      ...(loan.variableRatePlan ? { variableRatePlan: loan.variableRatePlan } : {}),
      ...(loan.tbpMarginRatePlan ? { tbpMarginRatePlan: loan.tbpMarginRatePlan } : {}),
      periodNumber: index + 1,
      periodEndDate: date,
    });
    const interest = calculateFixedNominalInterest({
      openingBalance,
      annualNominalRate: rate.annualNominalRate,
      periodsPerYear: loan.periodsPerYear,
      periodStartDate,
      periodEndDate: date,
      roundingPolicy: loan.roundingPolicy,
    }).interest;
    const amountDueBeforeInsurance = openingBalance.add(interest);
    const isTermPreservingContract = contract.version === 3;
    const installment = isTermPreservingContract
      ? index + 1 === dates.length
        ? amountDueBeforeInsurance
        : calculateTermPreservingInstallment({
            openingBalance,
            annualNominalRate: rate.annualNominalRate,
            remainingInstallments: dates.length - index,
            periodsPerYear: loan.periodsPerYear,
            roundingPolicy: loan.roundingPolicy,
          })
      : amountDueBeforeInsurance.isLessThan(loan.ordinaryPayment)
        ? amountDueBeforeInsurance
        : loan.ordinaryPayment;
    if (!projectedInitialTotalPayment) {
      projectedInitialTotalPayment = installment.add(contract.monthlyInsurance);
    }
    const principal = installment.subtract(interest);
    if (principal.isLessThanOrEqualTo(zero)) {
      throw new ContractEstimateError(
        contract.version === 3
          ? `La cuota base derivada de cuota total menos seguro no cubre el interés exigible en la cuota ${index + 1}.`
          : `La cuota mensual no cubre el interés exigible en la cuota ${index + 1}.`,
      );
    }
    const closingBalance = openingBalance.subtract(principal);
    const totalDue = installment.add(contract.monthlyInsurance);
    const period: ContractEstimatePeriod = Object.freeze({
      period: index + 1,
      date,
      openingBalance,
      interest,
      principal,
      installment,
      insurance: contract.monthlyInsurance,
      totalDue,
      closingBalance,
    });
    periods.push(period);
    estimatedInterest = estimatedInterest.add(interest);
    estimatedPrincipal = estimatedPrincipal.add(principal);
    estimatedInsurance = estimatedInsurance.add(contract.monthlyInsurance);
    estimatedTotal = estimatedTotal.add(totalDue);

    if (closingBalance.isZero() && !isTermPreservingContract) break;
    openingBalance = closingBalance;
    periodStartDate = date;
  }

  const finalPeriod = periods.at(-1);
  if (!finalPeriod) throw new ContractEstimateError('El plazo contractual no contiene cuotas.');
  const status = finalPeriod.closingBalance.isZero()
    ? periods.length < dates.length
      ? 'settled_early'
      : 'settled_on_term'
    : 'remaining_balance';
  const isAutomaticPayment = contract.version === 3 && contract.paymentMode === 'automatic';
  const configuredTotalPayment =
    contract.version === 3 && !isAutomaticPayment ? contract.monthlyTotalPayment : undefined;
  const initialPaymentDifference =
    configuredTotalPayment && projectedInitialTotalPayment
      ? projectedInitialTotalPayment.subtract(configuredTotalPayment)
      : undefined;

  return Object.freeze({
    status,
    contractualInstallments: dates.length,
    estimatedInstallments: periods.length,
    finalInstallmentDate: finalPeriod.date,
    estimatedPrincipal,
    estimatedInterest,
    estimatedInsurance,
    estimatedTotal,
    finalInstallment: finalPeriod.installment,
    finalInsurance: finalPeriod.insurance,
    finalTotalDue: finalPeriod.totalDue,
    hasAdjustedFinalInstallment:
      finalPeriod.installment.toDecimalString() !==
      (contract.version === 3
        ? periods.at(-2)?.installment.toDecimalString()
        : loan.ordinaryPayment.toDecimalString()),
    remainingPrincipal: finalPeriod.closingBalance,
    ...(configuredTotalPayment ? { configuredTotalPayment } : {}),
    ...(projectedInitialTotalPayment && !isAutomaticPayment
      ? { projectedInitialTotalPayment }
      : {}),
    ...(projectedInitialTotalPayment && isAutomaticPayment
      ? { automaticTotalPayment: projectedInitialTotalPayment }
      : {}),
    ...(initialPaymentDifference ? { initialPaymentDifference } : {}),
    hasConfiguredPaymentDifference:
      Boolean(initialPaymentDifference) && !initialPaymentDifference?.isZero(),
    periods: Object.freeze(periods),
  });
}

function calculateTermPreservingInstallment(input: {
  openingBalance: Money;
  annualNominalRate: string;
  remainingInstallments: number;
  periodsPerYear: number;
  roundingPolicy: Loan['roundingPolicy'];
}): Money {
  const rate = new Decimal(input.annualNominalRate).div(input.periodsPerYear);
  const balance = new Decimal(input.openingBalance.toDecimalString());
  const amount = rate.isZero()
    ? balance.div(input.remainingInstallments)
    : balance
        .mul(rate)
        .div(new Decimal(1).minus(new Decimal(1).plus(rate).pow(-input.remainingInstallments)));
  return Money.from(amount.toFixed(40), input.openingBalance.currency).round(input.roundingPolicy);
}

function generateMonthlyDates(
  startDate: string,
  term: NonNullable<Loan['contract']>['term'],
): readonly string[] {
  assertIsoDate(startDate, 'La fecha de inicio');
  if ('totalInstallments' in term) {
    return Object.freeze(
      Array.from({ length: term.totalInstallments }, (_, index) => addMonths(startDate, index + 1)),
    );
  }

  assertIsoDate(term.endDate, 'La fecha final');
  const dates: string[] = [];
  let elapsedMonths = 1;
  let scheduledDate = addMonths(startDate, elapsedMonths);
  while (scheduledDate < term.endDate) {
    dates.push(scheduledDate);
    elapsedMonths += 1;
    scheduledDate = addMonths(startDate, elapsedMonths);
  }
  dates.push(term.endDate);
  return Object.freeze(dates);
}

function addMonths(date: string, months: number): string {
  const match = ISO_DATE.exec(date);
  if (!match) throw new ContractEstimateError('La fecha debe usar el formato ISO YYYY-MM-DD.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const base = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(
    Math.min(day, lastDay),
  ).padStart(2, '0')}`;
}

function assertIsoDate(value: string, label: string): void {
  const match = ISO_DATE.exec(value);
  if (!match) throw new ContractEstimateError(`${label} debe usar el formato ISO YYYY-MM-DD.`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new ContractEstimateError(`${label} debe ser una fecha de calendario válida.`);
  }
}
