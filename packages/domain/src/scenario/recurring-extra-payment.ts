import {
  compareFixedRateAmortizations,
  generateFixedRateAmortization,
  type FixedRateAmortizationComparison,
  type FixedRateAmortizationResult,
  type RecurringExtraPayment,
} from '../amortization/fixed-rate.js';
import { type Loan } from '../loan/loan.js';
import { Money } from '../money.js';
import { type ProjectionScenarioSnapshot } from '../ports/loan-repository.js';

import {
  projectLoanAmortization,
  scenarioAmortizationInput,
  ScenarioValidationError,
  type ScenarioProjectionContext,
} from './one-time-extra-payment.js';

const SCENARIO_KIND = 'recurring_extra_payment_v1';

export type RecurringExtraPaymentScenario = ProjectionScenarioSnapshot &
  Readonly<{
    configuration: Readonly<{
      kind: typeof SCENARIO_KIND;
      mode: RecurringExtraPayment['kind'];
      amount: string;
      currency: string;
    }>;
  }>;

export type RecurringExtraPaymentComparison = Readonly<{
  base: FixedRateAmortizationResult;
  alternative: FixedRateAmortizationResult;
  comparison: FixedRateAmortizationComparison;
}>;

export function createRecurringExtraPaymentScenario(input: {
  id: string;
  loanId: string;
  name: string;
  createdAt: string;
  recurringExtraPayment: RecurringExtraPayment;
}): RecurringExtraPaymentScenario {
  if (!input.id.trim() || !input.loanId.trim() || !input.name.trim() || !input.createdAt.trim()) {
    throw new ScenarioValidationError(
      'El escenario requiere identificador, préstamo, nombre y fecha.',
    );
  }
  if (
    (input.recurringExtraPayment.kind !== 'constant_extra' &&
      input.recurringExtraPayment.kind !== 'constant_principal') ||
    !input.recurringExtraPayment.amount.isPositive()
  ) {
    throw new ScenarioValidationError(
      'El aporte recurrente debe ser positivo y usar un modo válido.',
    );
  }
  return Object.freeze({
    id: input.id,
    loanId: input.loanId,
    name: input.name,
    createdAt: input.createdAt,
    configuration: Object.freeze({
      kind: SCENARIO_KIND,
      mode: input.recurringExtraPayment.kind,
      amount: input.recurringExtraPayment.amount.toDecimalString(),
      currency: input.recurringExtraPayment.amount.currency,
    }),
  });
}

export function compareLoanWithRecurringExtraPayment(input: {
  loan: Loan;
  scenario: RecurringExtraPaymentScenario;
  projectionContext?: ScenarioProjectionContext;
}): RecurringExtraPaymentComparison {
  if (input.scenario.loanId !== input.loan.id) {
    throw new ScenarioValidationError('El escenario pertenece a otro préstamo.');
  }
  const recurringExtraPayment = deserializeRecurringExtraPayment(input.scenario);
  if (recurringExtraPayment.amount.currency !== input.loan.initialBalance.currency) {
    throw new ScenarioValidationError('El aporte recurrente debe usar la moneda del préstamo.');
  }
  const base = projectLoanAmortization(input.loan, input.projectionContext);
  const alternative = generateFixedRateAmortization({
    ...scenarioAmortizationInput(input.loan, input.projectionContext),
    recurringExtraPayment,
  });
  return Object.freeze({
    base,
    alternative,
    comparison: compareFixedRateAmortizations(base, alternative),
  });
}

export function isRecurringExtraPaymentScenario(
  scenario: ProjectionScenarioSnapshot,
): scenario is RecurringExtraPaymentScenario {
  const configuration = scenario.configuration;
  return (
    configuration.kind === SCENARIO_KIND &&
    (configuration.mode === 'constant_extra' || configuration.mode === 'constant_principal') &&
    typeof configuration.amount === 'string' &&
    typeof configuration.currency === 'string'
  );
}

function deserializeRecurringExtraPayment(
  scenario: RecurringExtraPaymentScenario,
): RecurringExtraPayment {
  return Object.freeze({
    kind: scenario.configuration.mode,
    amount: Money.from(scenario.configuration.amount, scenario.configuration.currency),
  });
}
