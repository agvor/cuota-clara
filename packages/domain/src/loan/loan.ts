import { Money, type RoundingPolicy } from '../money.js';
import {
  resolveAnnualRateForPeriod,
  type ManualVariableRatePlan,
} from '../interest/manual-variable-rate.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NON_NEGATIVE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export type Loan = Readonly<{
  id: string;
  name: string;
  startDate: string;
  initialBalance: Money;
  ordinaryPayment: Money;
  annualNominalRate: string;
  variableRatePlan?: ManualVariableRatePlan;
  periodsPerYear: number;
  roundingPolicy: RoundingPolicy;
}>;

export type CreateLoanInput = Loan;

export class LoanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoanValidationError';
  }
}

export function createLoan(input: CreateLoanInput): Loan {
  if (!input.id.trim()) throw new LoanValidationError('El préstamo requiere un identificador.');
  if (!input.name.trim()) throw new LoanValidationError('El préstamo requiere un nombre.');
  if (!ISO_DATE.test(input.startDate)) {
    throw new LoanValidationError('La fecha de inicio debe usar el formato ISO YYYY-MM-DD.');
  }
  if (!input.initialBalance.isPositive()) {
    throw new LoanValidationError('El saldo inicial debe ser positivo.');
  }
  if (!input.ordinaryPayment.isPositive()) {
    throw new LoanValidationError('La cuota ordinaria debe ser positiva.');
  }
  if (input.initialBalance.currency !== input.ordinaryPayment.currency) {
    throw new LoanValidationError('El saldo inicial y la cuota deben usar la misma moneda.');
  }
  if (!NON_NEGATIVE_DECIMAL.test(input.annualNominalRate)) {
    throw new LoanValidationError('La tasa nominal anual debe ser un decimal no negativo.');
  }
  if (!Number.isInteger(input.periodsPerYear) || input.periodsPerYear <= 0) {
    throw new LoanValidationError('Los periodos por año deben ser un entero positivo.');
  }
  if (input.variableRatePlan) {
    resolveAnnualRateForPeriod({
      fixedAnnualNominalRate: input.annualNominalRate,
      variableRatePlan: input.variableRatePlan,
      periodNumber: input.variableRatePlan.fixedPeriods + 1,
      periodEndDate: input.variableRatePlan.variableRates[0]?.effectiveDate ?? input.startDate,
    });
  }
  return Object.freeze({ ...input });
}
