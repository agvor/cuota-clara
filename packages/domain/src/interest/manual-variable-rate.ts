const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NON_NEGATIVE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export type VariableRateReviewFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export type ManualVariableRate = Readonly<{
  effectiveDate: string;
  annualNominalRate: string;
}>;

export type ManualVariableRatePlan = Readonly<{
  fixedPeriods: number;
  reviewFrequency: VariableRateReviewFrequency;
  variableRates: readonly ManualVariableRate[];
}>;

export type ResolvedAnnualRate = Readonly<{
  phase: 'fixed' | 'variable';
  annualNominalRate: string;
}>;

export class VariableRatePlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VariableRatePlanError';
  }
}

function validatePlan(plan: ManualVariableRatePlan): void {
  if (!Number.isInteger(plan.fixedPeriods) || plan.fixedPeriods < 0) {
    throw new VariableRatePlanError('La duración fija debe expresarse como un entero no negativo.');
  }
  if (plan.variableRates.length === 0) {
    throw new VariableRatePlanError('La fase variable requiere al menos una tasa manual.');
  }

  let previousDate: string | undefined;
  for (const rate of plan.variableRates) {
    if (!ISO_DATE.test(rate.effectiveDate) || !NON_NEGATIVE_DECIMAL.test(rate.annualNominalRate)) {
      throw new VariableRatePlanError(
        'Las tasas variables requieren fecha ISO y tasa decimal no negativa.',
      );
    }
    if (previousDate && rate.effectiveDate <= previousDate) {
      throw new VariableRatePlanError(
        'Las tasas variables deben estar ordenadas por fecha sin duplicados.',
      );
    }
    previousDate = rate.effectiveDate;
  }
}

export function resolveAnnualRateForPeriod(input: {
  fixedAnnualNominalRate: string;
  variableRatePlan?: ManualVariableRatePlan;
  periodNumber: number;
  periodEndDate: string;
}): ResolvedAnnualRate {
  if (!NON_NEGATIVE_DECIMAL.test(input.fixedAnnualNominalRate)) {
    throw new VariableRatePlanError('La tasa fija debe ser un decimal no negativo.');
  }
  if (
    !Number.isInteger(input.periodNumber) ||
    input.periodNumber <= 0 ||
    !ISO_DATE.test(input.periodEndDate)
  ) {
    throw new VariableRatePlanError('El periodo y su fecha de cierre deben ser válidos.');
  }
  if (!input.variableRatePlan) {
    return { phase: 'fixed', annualNominalRate: input.fixedAnnualNominalRate };
  }

  validatePlan(input.variableRatePlan);
  if (input.periodNumber <= input.variableRatePlan.fixedPeriods) {
    return { phase: 'fixed', annualNominalRate: input.fixedAnnualNominalRate };
  }

  const applicableRates = input.variableRatePlan.variableRates.filter(
    (rate) => rate.effectiveDate <= input.periodEndDate,
  );
  const rate = applicableRates.at(-1);
  if (!rate) {
    throw new VariableRatePlanError(
      'No existe una tasa manual vigente para este periodo variable.',
    );
  }
  return { phase: 'variable', annualNominalRate: rate.annualNominalRate };
}
