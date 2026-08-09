import { describe, expect, test } from 'vitest';

import { createPaymentRecord, Money, type PaymentRecord } from '@cuotaclara/domain';

import { classifyPaymentImports, mergePaymentImports } from '../src/payment-import-policy.js';

function payment(
  id: string,
  sourcePaymentId: string,
  overrides: Partial<PaymentRecord> = {},
): PaymentRecord {
  return createPaymentRecord({
    id,
    sourcePaymentId,
    date: '2026-02-01',
    totalAmount: Money.from('100.00', 'CRC'),
    principalAmount: Money.from('90.00', 'CRC'),
    source: 'csv_import',
    ...overrides,
  });
}

describe('política de importación de pagos', () => {
  test('clasifica nuevos, registrados, conflictos y posibles duplicados de forma determinista', () => {
    const existing = [
      payment('stored-1', 'bank-1'),
      payment('stored-2', 'bank-2', { date: '2026-03-01' }),
    ];
    const incoming = [
      payment('incoming-same', 'bank-1', { sourceReference: 'next.csv:2' }),
      payment('incoming-conflict', 'bank-2', {
        date: '2026-03-01',
        totalAmount: Money.from('101.00', 'CRC'),
      }),
      payment('incoming-possible', 'bank-3'),
      payment('incoming-new', 'bank-4', { date: '2026-04-01' }),
    ];

    const result = classifyPaymentImports(existing, incoming);

    expect(result.newRecords.map((record) => record.id)).toEqual(['incoming-new']);
    expect(result.alreadyRegistered).toMatchObject([
      { incoming: { id: 'incoming-same' }, existing: { id: 'stored-1' } },
    ]);
    expect(result.conflicts).toMatchObject([
      { incoming: { id: 'incoming-conflict' }, existing: { id: 'stored-2' } },
    ]);
    expect(result.possibleDuplicates).toMatchObject([
      { incoming: { id: 'incoming-possible' }, matches: [{ id: 'stored-1' }] },
    ]);
  });

  test('reimportar el mismo archivo no agrega pagos y un archivo mixto conserva solo los nuevos', () => {
    const existing = [payment('stored-1', 'bank-1')];
    const incoming = [
      payment('incoming-same', 'bank-1', { sourceReference: 'repeat.csv:2' }),
      payment('incoming-new', 'bank-2', { date: '2026-03-01' }),
    ];

    const result = mergePaymentImports(existing, incoming);

    expect(result.payments.map((record) => record.id)).toEqual(['stored-1', 'incoming-new']);
    expect(result.imported).toEqual([incoming[1]]);
    expect(result.omitted).toEqual([incoming[0]]);
    expect(result.unresolvedConflicts).toEqual([]);
    expect(result.unresolvedPossibleDuplicates).toEqual([]);
  });

  test('mantiene identidad interna al reemplazar y exige decisión para coincidencias ambiguas', () => {
    const existing = [payment('stored-1', 'bank-1')];
    const conflict = payment('incoming-conflict', 'bank-1', {
      totalAmount: Money.from('105.00', 'CRC'),
    });
    const possible = payment('incoming-possible', 'bank-2');

    const unresolved = mergePaymentImports(existing, [conflict, possible]);
    expect(unresolved.unresolvedConflicts).toHaveLength(1);
    expect(unresolved.unresolvedPossibleDuplicates).toHaveLength(1);
    expect(unresolved.payments).toEqual(existing);

    const resolved = mergePaymentImports(existing, [conflict, possible], {
      conflicts: { [conflict.id]: 'replace' },
      possibleDuplicates: { [possible.id]: 'import' },
    });
    expect(resolved.payments).toMatchObject([
      { id: 'stored-1', sourcePaymentId: 'bank-1' },
      { id: 'incoming-possible', sourcePaymentId: 'bank-2' },
    ]);
    expect(resolved.payments[0]?.totalAmount.toDecimalString()).toBe('105');
    expect(resolved.replaced).toMatchObject([
      { previous: { id: 'stored-1' }, replacement: { id: 'stored-1' } },
    ]);
  });

  test('dos pagos legítimos iguales pueden importarse cuando tienen referencias distintas', () => {
    const existing = [payment('stored-1', 'bank-1')];
    const legitimateSecondPayment = payment('incoming-2', 'bank-2');

    const result = mergePaymentImports(existing, [legitimateSecondPayment], {
      possibleDuplicates: { [legitimateSecondPayment.id]: 'import' },
    });

    expect(result.payments).toHaveLength(2);
    expect(result.imported).toEqual([legitimateSecondPayment]);
  });
});
