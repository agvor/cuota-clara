/**
 * Núcleo financiero de CuotaClara.
 *
 * Esta frontera se mantiene libre de React, IndexedDB y APIs del navegador.
 * Las APIs financieras siempre reciben importes decimales como texto o tipos
 * de dominio; no aceptan números binarios para cálculos monetarios.
 */
export {
  AmountScaleError,
  CurrencyMismatchError,
  Money,
  MoneyValidationError,
  type RoundingMode,
  type RoundingPolicy,
} from './money.js';
export {
  calculateFixedNominalInterest,
  InterestValidationError,
  type FixedNominalInterestContext,
  type InterestCalculationResult,
} from './interest/fixed-rate.js';
export {
  resolveAnnualRateForPeriod,
  VariableRatePlanError,
  type ManualVariableRate,
  type ManualVariableRatePlan,
  type ResolvedAnnualRate,
  type VariableRateReviewFrequency,
} from './interest/manual-variable-rate.js';
export {
  AmortizationValidationError,
  compareFixedRateAmortizations,
  generateFixedRateAmortization,
  type FixedRateAmortizationComparison,
  type FixedRateAmortizationInput,
  type FixedRateAmortizationPeriod,
  type FixedRateAmortizationResult,
  type OneTimeExtraPayment,
} from './amortization/fixed-rate.js';
export {
  createPaymentRecord,
  createReconciliationAdjustment,
  HistoricalStateError,
  reconstructHistoricalState,
  type CreatePaymentRecordInput,
  type HistoricalState,
  type PaymentRecord,
  type PaymentSource,
  type ReconciliationAdjustment,
} from './history/historical-state.js';
export {
  createLoan,
  createLoanV2,
  isLegacyLoan,
  LoanValidationError,
  type CreateLoanInput,
  type CreateLoanV2Input,
  type Loan,
  type LoanContractV2,
  type LoanTerm,
} from './loan/loan.js';
export {
  estimateLoanContract,
  ContractEstimateError,
  type ContractEstimatePeriod,
  type LoanContractEstimate,
} from './loan/contract-estimate.js';
export type {
  LoanAggregate,
  LoanRepository,
  ProjectionScenarioSnapshot,
} from './ports/loan-repository.js';
export {
  compareLoanWithOneTimeExtraPayment,
  createOneTimeExtraPaymentScenario,
  isOneTimeExtraPaymentScenario,
  projectLoanAmortization,
  ScenarioValidationError,
  type OneTimeExtraPaymentComparison,
  type OneTimeExtraPaymentScenario,
} from './scenario/one-time-extra-payment.js';
