import { Decimal } from 'decimal.js';

import { Money, type RoundingPolicy } from '../money.js';

const RateDecimal = Decimal.clone({ precision: 40 });
const NON_NEGATIVE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type FixedNominalInterestContext = Readonly<{
  openingBalance: Money;
  annualNominalRate: string;
  periodsPerYear: number;
  periodStartDate: string;
  periodEndDate: string;
  roundingPolicy: RoundingPolicy;
}>;

export type InterestCalculationResult = Readonly<{
  interest: Money;
  trace: Readonly<{
    model: 'nominal_annual_divided_by_periods';
    annualNominalRate: string;
    periodicRate: string;
    periodStartDate: string;
    periodEndDate: string;
    roundingPolicy: RoundingPolicy;
  }>;
}>;

export class InterestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InterestValidationError';
  }
}

function validateContext(context: FixedNominalInterestContext): void {
  if (!NON_NEGATIVE_DECIMAL.test(context.annualNominalRate)) {
    throw new InterestValidationError('La tasa nominal anual debe ser un decimal no negativo.');
  }
  if (!Number.isInteger(context.periodsPerYear) || context.periodsPerYear <= 0) {
    throw new InterestValidationError(
      'La cantidad de periodos por año debe ser un entero positivo.',
    );
  }
  if (!ISO_DATE.test(context.periodStartDate) || !ISO_DATE.test(context.periodEndDate)) {
    throw new InterestValidationError(
      'Las fechas del periodo deben usar el formato ISO YYYY-MM-DD.',
    );
  }
}

/** Calcula interés nominal anual dividido entre los periodos declarados. */
export function calculateFixedNominalInterest(
  context: FixedNominalInterestContext,
): InterestCalculationResult {
  validateContext(context);

  const periodicRate = new RateDecimal(context.annualNominalRate)
    .dividedBy(context.periodsPerYear)
    .toString();
  const interest = context.openingBalance
    .multiplyBy(context.annualNominalRate)
    .divideBy(String(context.periodsPerYear))
    .round(context.roundingPolicy);

  return {
    interest,
    trace: {
      model: 'nominal_annual_divided_by_periods',
      annualNominalRate: context.annualNominalRate,
      periodicRate,
      periodStartDate: context.periodStartDate,
      periodEndDate: context.periodEndDate,
      roundingPolicy: context.roundingPolicy,
    },
  };
}
