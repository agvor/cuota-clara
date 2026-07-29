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
  AmortizationValidationError,
  generateFixedRateAmortization,
  type FixedRateAmortizationInput,
  type FixedRateAmortizationPeriod,
  type FixedRateAmortizationResult,
} from './amortization/fixed-rate.js';
