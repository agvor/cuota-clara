import { describe, expect, test } from 'vitest';

import {
  createPaymentRecord,
  createReconciliationAdjustment,
  HistoricalStateError,
  reconstructHistoricalState,
} from '../src/history/historical-state.js';
import { Money } from '../src/money.js';

const roundingPolicy = { scale: 2, mode: 'half_up' } as const;

function twoHistoricalPayments() {
  return [
    createPaymentRecord({
      id: 'payment-1',
      date: '2026-02-01',
      totalAmount: Money.from('340.00', 'CRC'),
      interestAmount: Money.from('10.00', 'CRC'),
      principalAmount: Money.from('330.00', 'CRC'),
      source: 'manual',
      notes: 'Pago registrado desde el estado de cuenta.',
    }),
    createPaymentRecord({
      id: 'payment-2',
      date: '2026-03-01',
      totalAmount: Money.from('340.00', 'CRC'),
      interestAmount: Money.from('6.70', 'CRC'),
      principalAmount: Money.from('333.30', 'CRC'),
      source: 'manual',
    }),
  ];
}

describe('reconstructHistoricalState', () => {
  test('reconstruye el saldo con pagos históricos sin mutar sus registros', () => {
    const payments = Object.freeze(twoHistoricalPayments());
    const result = reconstructHistoricalState({
      initialBalance: Money.from('1000.00', 'CRC'),
      payments,
      cutoffDate: '2026-03-01',
    });

    expect(result.balanceBeforeReconciliation.toFixed(roundingPolicy)).toBe('336.70');
    expect(result.currentBalance.toFixed(roundingPolicy)).toBe('336.70');
    expect(result.appliedPrincipal.toFixed(roundingPolicy)).toBe('663.30');
    expect(result.historicalPayments).toHaveLength(2);
    expect(payments[1]?.principalAmount?.toFixed(roundingPolicy)).toBe('333.30');
  });

  test('aplica un ajuste de reconciliación fechado sin modificar el historial', () => {
    const payments = twoHistoricalPayments();
    const reconciliation = createReconciliationAdjustment({
      id: 'reconciliation-1',
      date: '2026-03-01',
      reportedBalance: Money.from('336.65', 'CRC'),
      reason: 'Saldo mostrado por la entidad financiera.',
    });
    const result = reconstructHistoricalState({
      initialBalance: Money.from('1000.00', 'CRC'),
      payments,
      cutoffDate: '2026-03-01',
      reconciliation,
    });

    expect(result.balanceBeforeReconciliation.toFixed(roundingPolicy)).toBe('336.70');
    expect(result.reconciliationAdjustment?.toFixed(roundingPolicy)).toBe('-0.05');
    expect(result.currentBalance.toFixed(roundingPolicy)).toBe('336.65');
    expect(payments[1]?.principalAmount?.toFixed(roundingPolicy)).toBe('333.30');
  });

  test('rechaza reconstruir un pago cuyo principal no se conoce', () => {
    const paymentWithoutPrincipal = createPaymentRecord({
      id: 'payment-without-principal',
      date: '2026-02-01',
      totalAmount: Money.from('340.00', 'CRC'),
      source: 'csv_import',
      sourceReference: 'archivo.csv:2',
    });

    expect(() =>
      reconstructHistoricalState({
        initialBalance: Money.from('1000.00', 'CRC'),
        payments: [paymentWithoutPrincipal],
        cutoffDate: '2026-02-01',
      }),
    ).toThrow(HistoricalStateError);
  });
});
