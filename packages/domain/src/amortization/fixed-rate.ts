import { calculateFixedNominalInterest } from '../interest/fixed-rate.js';
import { Money, type RoundingPolicy } from '../money.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type FixedRateAmortizationInput = Readonly<{
  openingBalance: Money;
  annualNominalRate: string;
  periodsPerYear: number;
  ordinaryPayment: Money;
  startDate: string;
  periodEndDates: readonly string[];
  roundingPolicy: RoundingPolicy;
}>;

export type FixedRateAmortizationPeriod = Readonly<{
  period: number;
  date: string;
  openingBalance: Money;
  annualNominalRate: string;
  periodicRate: string;
  interest: Money;
  principal: Money;
  fees: Money;
  payment: Money;
  closingBalance: Money;
}>;

export type FixedRateAmortizationResult = Readonly<{
  periods: readonly FixedRateAmortizationPeriod[];
  summary: Readonly<{
    completionDate: string;
    totalInterest: string;
    totalPrincipal: string;
    totalPaid: string;
  }>;
}>;

export class AmortizationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmortizationValidationError';
  }
}

function validateInput(input: FixedRateAmortizationInput): void {
  if (!ISO_DATE.test(input.startDate)) {
    throw new AmortizationValidationError(
      'La fecha de inicio debe usar el formato ISO YYYY-MM-DD.',
    );
  }
  if (input.periodEndDates.length === 0) {
    throw new AmortizationValidationError('Se requiere al menos una fecha de pago.');
  }
  if (input.openingBalance.isNegative() || input.openingBalance.isZero()) {
    throw new AmortizationValidationError('El saldo inicial debe ser positivo.');
  }
  if (!input.ordinaryPayment.isPositive()) {
    throw new AmortizationValidationError('La cuota ordinaria debe ser positiva.');
  }
  if (input.openingBalance.currency !== input.ordinaryPayment.currency) {
    throw new AmortizationValidationError(
      'El saldo y la cuota ordinaria deben usar la misma moneda.',
    );
  }
}

/** Genera una amortización de tasa fija para fechas de pago explícitas. */
export function generateFixedRateAmortization(
  input: FixedRateAmortizationInput,
): FixedRateAmortizationResult {
  validateInput(input);

  let openingBalance = input.openingBalance;
  let periodStartDate = input.startDate;
  let totalInterest = Money.from('0', input.openingBalance.currency);
  let totalPrincipal = Money.from('0', input.openingBalance.currency);
  let totalPaid = Money.from('0', input.openingBalance.currency);
  const noFees = Money.from('0', input.openingBalance.currency);
  const periods: FixedRateAmortizationPeriod[] = [];

  for (const [index, periodEndDate] of input.periodEndDates.entries()) {
    if (!ISO_DATE.test(periodEndDate) || periodEndDate <= periodStartDate) {
      throw new AmortizationValidationError(
        'Las fechas de pago deben ser ISO y avanzar estrictamente.',
      );
    }

    const interestResult = calculateFixedNominalInterest({
      openingBalance,
      annualNominalRate: input.annualNominalRate,
      periodsPerYear: input.periodsPerYear,
      periodStartDate,
      periodEndDate,
      roundingPolicy: input.roundingPolicy,
    });
    const amountDue = openingBalance.add(interestResult.interest);
    const payment = amountDue.isLessThan(input.ordinaryPayment) ? amountDue : input.ordinaryPayment;
    const principal = payment.subtract(interestResult.interest);

    if (principal.isLessThanOrEqualTo(Money.from('0', principal.currency))) {
      throw new AmortizationValidationError('La cuota debe cubrir más que el interés del periodo.');
    }

    const closingBalance = openingBalance.subtract(principal);
    periods.push({
      period: index + 1,
      date: periodEndDate,
      openingBalance,
      annualNominalRate: input.annualNominalRate,
      periodicRate: interestResult.trace.periodicRate,
      interest: interestResult.interest,
      principal,
      fees: noFees,
      payment,
      closingBalance,
    });
    totalInterest = totalInterest.add(interestResult.interest);
    totalPrincipal = totalPrincipal.add(principal);
    totalPaid = totalPaid.add(payment);

    if (closingBalance.isZero()) {
      return {
        periods,
        summary: {
          completionDate: periodEndDate,
          totalInterest: totalInterest.toFixed(input.roundingPolicy),
          totalPrincipal: totalPrincipal.toFixed(input.roundingPolicy),
          totalPaid: totalPaid.toFixed(input.roundingPolicy),
        },
      };
    }
    openingBalance = closingBalance;
    periodStartDate = periodEndDate;
  }

  throw new AmortizationValidationError('Las fechas de pago no alcanzan para cancelar el saldo.');
}
