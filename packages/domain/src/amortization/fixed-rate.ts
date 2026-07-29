import { calculateFixedNominalInterest } from '../interest/fixed-rate.js';
import { Money, type RoundingPolicy } from '../money.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type OneTimeExtraPayment = Readonly<{
  id: string;
  date: string;
  amount: Money;
}>;

export type FixedRateAmortizationInput = Readonly<{
  openingBalance: Money;
  annualNominalRate: string;
  periodsPerYear: number;
  ordinaryPayment: Money;
  startDate: string;
  periodEndDates: readonly string[];
  roundingPolicy: RoundingPolicy;
  extraPayments?: readonly OneTimeExtraPayment[];
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
  ordinaryPayment: Money;
  extraPayment: Money;
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

export type FixedRateAmortizationComparison = Readonly<{
  baseCompletionDate: string;
  alternativeCompletionDate: string;
  interestSaved: Money;
  periodsSaved: number;
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

function extraPaymentsByDate(input: FixedRateAmortizationInput): ReadonlyMap<string, Money> {
  const extraPayments = new Map<string, Money>();
  const identifiers = new Set<string>();
  const paymentDates = new Set(input.periodEndDates);

  for (const extraPayment of input.extraPayments ?? []) {
    if (!extraPayment.id.trim() || identifiers.has(extraPayment.id)) {
      throw new AmortizationValidationError(
        'Cada pago extraordinario requiere un identificador único.',
      );
    }
    identifiers.add(extraPayment.id);
    if (!ISO_DATE.test(extraPayment.date) || !paymentDates.has(extraPayment.date)) {
      throw new AmortizationValidationError(
        'Cada pago extraordinario debe coincidir con una fecha de pago del escenario.',
      );
    }
    if (
      extraPayment.amount.currency !== input.openingBalance.currency ||
      !extraPayment.amount.isPositive()
    ) {
      throw new AmortizationValidationError(
        'El pago extraordinario debe ser positivo y usar la moneda del préstamo.',
      );
    }
    extraPayments.set(
      extraPayment.date,
      (extraPayments.get(extraPayment.date) ?? Money.from('0', extraPayment.amount.currency)).add(
        extraPayment.amount,
      ),
    );
  }

  return extraPayments;
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
  const noExtraPayment = Money.from('0', input.openingBalance.currency);
  const extrasByDate = extraPaymentsByDate(input);
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
    const ordinaryPayment = amountDue.isLessThan(input.ordinaryPayment)
      ? amountDue
      : input.ordinaryPayment;
    const ordinaryPrincipal = ordinaryPayment.subtract(interestResult.interest);

    if (ordinaryPrincipal.isLessThanOrEqualTo(Money.from('0', ordinaryPrincipal.currency))) {
      throw new AmortizationValidationError('La cuota debe cubrir más que el interés del periodo.');
    }

    const balanceAfterOrdinaryPayment = openingBalance.subtract(ordinaryPrincipal);
    const requestedExtraPayment = extrasByDate.get(periodEndDate) ?? noExtraPayment;
    const extraPayment = balanceAfterOrdinaryPayment.isLessThan(requestedExtraPayment)
      ? balanceAfterOrdinaryPayment
      : requestedExtraPayment;
    const principal = ordinaryPrincipal.add(extraPayment);
    const payment = ordinaryPayment.add(extraPayment);
    const closingBalance = balanceAfterOrdinaryPayment.subtract(extraPayment);
    periods.push({
      period: index + 1,
      date: periodEndDate,
      openingBalance,
      annualNominalRate: input.annualNominalRate,
      periodicRate: interestResult.trace.periodicRate,
      interest: interestResult.interest,
      principal,
      fees: noFees,
      ordinaryPayment,
      extraPayment,
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

export function compareFixedRateAmortizations(
  base: FixedRateAmortizationResult,
  alternative: FixedRateAmortizationResult,
): FixedRateAmortizationComparison {
  const baseCurrency = base.periods[0]?.openingBalance.currency;
  const alternativeCurrency = alternative.periods[0]?.openingBalance.currency;
  if (!baseCurrency || !alternativeCurrency || baseCurrency !== alternativeCurrency) {
    throw new AmortizationValidationError(
      'Los escenarios deben tener resultados y usar la misma moneda.',
    );
  }

  return {
    baseCompletionDate: base.summary.completionDate,
    alternativeCompletionDate: alternative.summary.completionDate,
    interestSaved: Money.from(base.summary.totalInterest, baseCurrency).subtract(
      Money.from(alternative.summary.totalInterest, alternativeCurrency),
    ),
    periodsSaved: base.periods.length - alternative.periods.length,
  };
}
