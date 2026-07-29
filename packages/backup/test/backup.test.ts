import { describe, expect, test } from 'vitest';

import {
  createLoan,
  createLoanV2,
  createLoanV3,
  createPaymentRecord,
  Money,
} from '@cuotaclara/domain';

import { createBackup, parseBackup } from '../src/index.js';

const aggregate = {
  loan: createLoan({
    id: 'loan-001',
    name: 'Hipoteca',
    startDate: '2026-01-01',
    initialBalance: Money.from('1000.00', 'CRC'),
    ordinaryPayment: Money.from('100.00', 'CRC'),
    annualNominalRate: '0.12',
    periodsPerYear: 12,
    roundingPolicy: { scale: 2, mode: 'half_up' },
  }),
  payments: [
    createPaymentRecord({
      id: 'payment-001',
      date: '2026-02-01',
      totalAmount: Money.from('100.00', 'CRC'),
      principalAmount: Money.from('90.00', 'CRC'),
      source: 'manual',
    }),
  ],
  scenarios: [],
};

describe('backup', () => {
  test('serializa y restaura importes decimales y agregados validados', () => {
    const backup = createBackup([aggregate], '2026-07-29T00:00:00.000Z');
    const restored = parseBackup(JSON.stringify(backup));

    expect(restored.aggregates[0]?.loan.initialBalance.toDecimalString()).toBe('1000');
    expect(restored.aggregates[0]?.payments[0]?.principalAmount?.currency).toBe('CRC');
  });

  test('rechaza una copia de versión o estructura desconocida', () => {
    expect(() => parseBackup('{"schemaVersion":99}')).toThrow('respaldo');
  });

  test('conserva contratos v3 y permite restaurar copias v1 y v2', () => {
    const v2Loan = createLoanV2({
      id: 'loan-v2',
      name: 'Hipoteca v2',
      startDate: '2026-01-01',
      originalPrincipal: Money.from('1000.00', 'CRC'),
      monthlyInstallment: Money.from('100.00', 'CRC'),
      monthlyInsurance: Money.from('5.00', 'CRC'),
      term: { totalInstallments: 12 },
      annualNominalRate: '0.12',
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const v2Backup = createBackup([{ ...aggregate, loan: v2Loan }], '2026-07-29T00:00:00.000Z');
    const restoredV2 = parseBackup(JSON.stringify({ ...v2Backup, schemaVersion: 2 }));

    expect(restoredV2.aggregates[0]?.loan.contract).toMatchObject({
      version: 2,
      term: { totalInstallments: 12 },
    });

    const v3Loan = createLoanV3({
      id: 'loan-v3',
      name: 'Hipoteca v3',
      startDate: '2026-01-01',
      originalPrincipal: Money.from('1000.00', 'CRC'),
      monthlyTotalPayment: Money.from('105.00', 'CRC'),
      monthlyInsurance: Money.from('5.00', 'CRC'),
      term: { totalInstallments: 12 },
      annualNominalRate: '0.12',
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const v3 = createBackup([{ ...aggregate, loan: v3Loan }], '2026-07-29T00:00:00.000Z');
    expect(v3.schemaVersion).toBe(3);
    expect(parseBackup(JSON.stringify(v3)).aggregates[0]?.loan.contract).toMatchObject({
      version: 3,
      monthlyTotalPayment: expect.objectContaining({ currency: 'CRC' }),
    });

    const v1Text = JSON.stringify({ ...createBackup([aggregate]), schemaVersion: 1 });
    expect(parseBackup(v1Text).aggregates[0]?.loan.contract).toBeUndefined();
  });
});
