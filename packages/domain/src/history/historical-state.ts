import { Money } from '../money.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type PaymentSource = 'manual' | 'csv_import';

export type PaymentRecord = Readonly<{
  id: string;
  date: string;
  totalAmount: Money;
  interestAmount?: Money;
  principalAmount?: Money;
  extraPrincipalAmount?: Money;
  insuranceAmount?: Money;
  feeAmount?: Money;
  source: PaymentSource;
  sourceReference?: string;
  notes?: string;
}>;

export type CreatePaymentRecordInput = PaymentRecord;

export type ReconciliationAdjustment = Readonly<{
  id: string;
  date: string;
  reportedBalance: Money;
  reason: string;
}>;

export type HistoricalState = Readonly<{
  cutoffDate: string;
  historicalPayments: readonly PaymentRecord[];
  appliedPrincipal: Money;
  balanceBeforeReconciliation: Money;
  reconciliation?: ReconciliationAdjustment;
  reconciliationAdjustment?: Money;
  currentBalance: Money;
}>;

export class HistoricalStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HistoricalStateError';
  }
}

function validateDate(date: string, field: string): void {
  if (!ISO_DATE.test(date)) {
    throw new HistoricalStateError(`${field} debe usar el formato ISO YYYY-MM-DD.`);
  }
}

function validateNonNegativeAmount(amount: Money, field: string): void {
  if (amount.isNegative()) {
    throw new HistoricalStateError(`${field} no puede ser negativo.`);
  }
}

function validateCurrency(amount: Money, currency: string, field: string): void {
  if (amount.currency !== currency) {
    throw new HistoricalStateError(`${field} debe usar la moneda ${currency}.`);
  }
}

function validateOptionalAmount(amount: Money | undefined, currency: string, field: string): void {
  if (amount) {
    validateCurrency(amount, currency, field);
    validateNonNegativeAmount(amount, field);
  }
}

export function createPaymentRecord(input: CreatePaymentRecordInput): PaymentRecord {
  if (!input.id.trim())
    throw new HistoricalStateError('El pago histórico requiere un identificador.');
  validateDate(input.date, 'La fecha de pago');
  validateNonNegativeAmount(input.totalAmount, 'El importe total');
  const currency = input.totalAmount.currency;
  validateOptionalAmount(input.interestAmount, currency, 'El interés');
  validateOptionalAmount(input.principalAmount, currency, 'El principal');
  validateOptionalAmount(input.extraPrincipalAmount, currency, 'El principal extraordinario');
  validateOptionalAmount(input.insuranceAmount, currency, 'El seguro');
  validateOptionalAmount(input.feeAmount, currency, 'La comisión');

  return Object.freeze({ ...input });
}

export function createReconciliationAdjustment(
  adjustment: ReconciliationAdjustment,
): ReconciliationAdjustment {
  if (!adjustment.id.trim()) {
    throw new HistoricalStateError('El ajuste de reconciliación requiere un identificador.');
  }
  validateDate(adjustment.date, 'La fecha de reconciliación');
  if (!adjustment.reason.trim()) {
    throw new HistoricalStateError('El ajuste de reconciliación requiere una justificación.');
  }
  validateNonNegativeAmount(adjustment.reportedBalance, 'El saldo reportado');
  return Object.freeze({ ...adjustment });
}

export function reconstructHistoricalState(input: {
  initialBalance: Money;
  payments: readonly PaymentRecord[];
  cutoffDate: string;
  reconciliation?: ReconciliationAdjustment;
}): HistoricalState {
  validateDate(input.cutoffDate, 'La fecha de corte');
  if (!input.initialBalance.isPositive()) {
    throw new HistoricalStateError('El saldo inicial debe ser positivo.');
  }

  const currency = input.initialBalance.currency;
  const payments = [...input.payments].sort((left, right) => left.date.localeCompare(right.date));
  const paymentIds = new Set<string>();
  let currentBalance = input.initialBalance;
  let appliedPrincipal = Money.from('0', currency);

  for (const payment of payments) {
    if (paymentIds.has(payment.id)) {
      throw new HistoricalStateError(`El identificador de pago ${payment.id} está duplicado.`);
    }
    paymentIds.add(payment.id);
    validateDate(payment.date, 'La fecha de pago');
    if (payment.date > input.cutoffDate) {
      throw new HistoricalStateError(
        'Un pago histórico no puede ser posterior a la fecha de corte.',
      );
    }
    validateCurrency(payment.totalAmount, currency, 'El importe total');
    validateNonNegativeAmount(payment.totalAmount, 'El importe total');
    validateOptionalAmount(payment.interestAmount, currency, 'El interés');
    validateOptionalAmount(payment.principalAmount, currency, 'El principal');
    validateOptionalAmount(payment.extraPrincipalAmount, currency, 'El principal extraordinario');
    validateOptionalAmount(payment.insuranceAmount, currency, 'El seguro');
    validateOptionalAmount(payment.feeAmount, currency, 'La comisión');
    if (!payment.principalAmount) {
      throw new HistoricalStateError(
        `El pago ${payment.id} no contiene principal para reconstruir el saldo.`,
      );
    }

    const principal = payment.principalAmount.add(
      payment.extraPrincipalAmount ?? Money.from('0', currency),
    );
    if (currentBalance.isLessThan(principal)) {
      throw new HistoricalStateError(`El pago ${payment.id} excede el saldo pendiente.`);
    }
    currentBalance = currentBalance.subtract(principal);
    appliedPrincipal = appliedPrincipal.add(principal);
  }

  const balanceBeforeReconciliation = currentBalance;
  if (!input.reconciliation) {
    return Object.freeze({
      cutoffDate: input.cutoffDate,
      historicalPayments: Object.freeze(payments),
      appliedPrincipal,
      balanceBeforeReconciliation,
      currentBalance,
    });
  }

  const reconciliation = input.reconciliation;
  validateDate(reconciliation.date, 'La fecha de reconciliación');
  if (reconciliation.date !== input.cutoffDate) {
    throw new HistoricalStateError('La reconciliación debe estar fechada en la fecha de corte.');
  }
  validateCurrency(reconciliation.reportedBalance, currency, 'El saldo reportado');
  validateNonNegativeAmount(reconciliation.reportedBalance, 'El saldo reportado');

  return Object.freeze({
    cutoffDate: input.cutoffDate,
    historicalPayments: Object.freeze(payments),
    appliedPrincipal,
    balanceBeforeReconciliation,
    reconciliation,
    reconciliationAdjustment: reconciliation.reportedBalance.subtract(balanceBeforeReconciliation),
    currentBalance: reconciliation.reportedBalance,
  });
}
