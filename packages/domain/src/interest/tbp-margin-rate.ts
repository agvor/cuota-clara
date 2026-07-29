import { Decimal } from 'decimal.js';

import type { VariableRateReviewFrequency } from './manual-variable-rate.js';

const RateDecimal = Decimal.clone({ precision: 40 });
const NON_NEGATIVE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export type TbpEvolution = 'estable' | 'alza_progresiva' | 'baja_progresiva';

export type TbpMarginRatePlan = Readonly<{
  kind: 'tbp_margin_v1';
  fixedPeriods: number;
  marginAnnualRate: string;
  tbpInitialAnnualRate: string;
  reviewFrequency: VariableRateReviewFrequency;
  evolution: TbpEvolution;
  variationPerReview: string;
}>;

export type TbpMarginResolvedRate = Readonly<{
  phase: 'fixed' | 'variable';
  annualNominalRate: string;
  tbpAnnualRate: string;
}>;

export class TbpMarginRatePlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TbpMarginRatePlanError';
  }
}

/** Resuelve TBP+margen por cuota sin consultar fuentes externas. */
export function resolveTbpMarginRateForPeriod(input: {
  fixedAnnualNominalRate: string;
  plan: TbpMarginRatePlan;
  periodNumber: number;
}): TbpMarginResolvedRate {
  validateInput(input);
  const { plan } = input;
  const initialTbp = new RateDecimal(plan.tbpInitialAnnualRate);
  if (input.periodNumber <= plan.fixedPeriods) {
    return Object.freeze({
      phase: 'fixed',
      annualNominalRate: input.fixedAnnualNominalRate,
      tbpAnnualRate: initialTbp.toString(),
    });
  }

  const periodsSinceVariableStart = input.periodNumber - plan.fixedPeriods - 1;
  const reviewsElapsed = Math.floor(
    periodsSinceVariableStart / periodsForReview(plan.reviewFrequency),
  );
  const variation = new RateDecimal(plan.variationPerReview).times(reviewsElapsed);
  const tbp = resolveTbp(initialTbp, variation, plan.evolution);
  return Object.freeze({
    phase: 'variable',
    annualNominalRate: tbp.plus(new RateDecimal(plan.marginAnnualRate)).toString(),
    tbpAnnualRate: tbp.toString(),
  });
}

function validateInput(input: {
  fixedAnnualNominalRate: string;
  plan: TbpMarginRatePlan;
  periodNumber: number;
}): void {
  if (!NON_NEGATIVE_DECIMAL.test(input.fixedAnnualNominalRate)) {
    throw new TbpMarginRatePlanError('La tasa fija debe ser un decimal anual no negativo.');
  }
  if (!Number.isInteger(input.periodNumber) || input.periodNumber <= 0) {
    throw new TbpMarginRatePlanError('El número de cuota debe ser un entero positivo.');
  }
  const { plan } = input;
  if (plan.kind !== 'tbp_margin_v1') {
    throw new TbpMarginRatePlanError('La regla TBP no tiene una versión compatible.');
  }
  if (!Number.isInteger(plan.fixedPeriods) || plan.fixedPeriods < 0) {
    throw new TbpMarginRatePlanError('La duración fija debe ser un entero no negativo.');
  }
  if (
    !NON_NEGATIVE_DECIMAL.test(plan.marginAnnualRate) ||
    !NON_NEGATIVE_DECIMAL.test(plan.tbpInitialAnnualRate) ||
    !NON_NEGATIVE_DECIMAL.test(plan.variationPerReview)
  ) {
    throw new TbpMarginRatePlanError(
      'TBP, margen y variación por revisión deben ser decimales no negativos.',
    );
  }
  if (!['monthly', 'quarterly', 'semiannual', 'annual'].includes(plan.reviewFrequency)) {
    throw new TbpMarginRatePlanError('La frecuencia de revisión TBP no es compatible.');
  }
  if (!['estable', 'alza_progresiva', 'baja_progresiva'].includes(plan.evolution)) {
    throw new TbpMarginRatePlanError('La evolución de TBP no es compatible.');
  }
}

function periodsForReview(frequency: VariableRateReviewFrequency): number {
  return { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[frequency];
}

function resolveTbp(initial: Decimal, variation: Decimal, evolution: TbpEvolution): Decimal {
  if (evolution === 'estable') return initial;
  if (evolution === 'alza_progresiva') return initial.plus(variation);
  return Decimal.max(new RateDecimal(0), initial.minus(variation));
}
