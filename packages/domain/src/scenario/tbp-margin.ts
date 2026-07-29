import { type FixedRateAmortizationResult } from '../amortization/fixed-rate.js';
import {
  resolveTbpMarginRateForPeriod,
  type TbpMarginRatePlan,
} from '../interest/tbp-margin-rate.js';
import { type Loan } from '../loan/loan.js';
import { type ProjectionScenarioSnapshot } from '../ports/loan-repository.js';

import { projectLoanAmortization, ScenarioValidationError } from './one-time-extra-payment.js';

const SCENARIO_KIND = 'tbp_margin_v1';

export type TbpMarginScenario = ProjectionScenarioSnapshot &
  Readonly<{
    configuration: TbpMarginRatePlan;
  }>;

/** Crea un supuesto TBP versionado que puede persistirse con el préstamo. */
export function createTbpMarginScenario(input: {
  id: string;
  loanId: string;
  name: string;
  createdAt: string;
  plan: TbpMarginRatePlan;
}): TbpMarginScenario {
  if (!input.id.trim() || !input.loanId.trim() || !input.name.trim() || !input.createdAt.trim()) {
    throw new ScenarioValidationError(
      'El escenario TBP requiere identificador, préstamo, nombre y fecha.',
    );
  }
  resolveTbpMarginRateForPeriod({
    fixedAnnualNominalRate: '0',
    plan: input.plan,
    periodNumber: input.plan.fixedPeriods + 1,
  });
  return Object.freeze({
    id: input.id,
    loanId: input.loanId,
    name: input.name,
    createdAt: input.createdAt,
    configuration: Object.freeze({ ...input.plan }),
  });
}

export function isTbpMarginScenario(
  scenario: ProjectionScenarioSnapshot,
): scenario is TbpMarginScenario {
  const configuration = scenario.configuration;
  return (
    configuration.kind === SCENARIO_KIND &&
    typeof configuration.fixedPeriods === 'number' &&
    typeof configuration.marginAnnualRate === 'string' &&
    typeof configuration.tbpInitialAnnualRate === 'string' &&
    typeof configuration.reviewFrequency === 'string' &&
    typeof configuration.evolution === 'string' &&
    typeof configuration.variationPerReview === 'string'
  );
}

/** Proyecta el préstamo con el supuesto TBP del escenario, sin mutar el contrato. */
export function projectLoanWithTbpMarginScenario(input: {
  loan: Loan;
  scenario: TbpMarginScenario;
}): FixedRateAmortizationResult {
  if (input.scenario.loanId !== input.loan.id) {
    throw new ScenarioValidationError('El escenario pertenece a otro préstamo.');
  }
  if (input.loan.variableRatePlan || input.loan.tbpMarginRatePlan) {
    throw new ScenarioValidationError(
      'El escenario TBP no puede reemplazar silenciosamente un plan de tasa existente.',
    );
  }
  return projectLoanAmortization({
    ...input.loan,
    tbpMarginRatePlan: input.scenario.configuration,
  });
}
