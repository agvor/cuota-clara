import { createBankReset, createLoan, createPaymentRecord, Money } from '@cuotaclara/domain';
import { describe, expect, test } from 'vitest';

import { createDuplicateLoanAggregate } from './duplicate-loan.js';

const roundingPolicy = { scale: 2, mode: 'half_up' } as const;

describe('createDuplicateLoanAggregate', () => {
  test('regenera identificadores al copiar pagos, escenarios y reset', () => {
    const loan = createLoan({
      id: 'loan-original',
      name: 'Casa original',
      startDate: '2026-01-01',
      initialBalance: Money.from('1000', 'CRC'),
      ordinaryPayment: Money.from('100', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      roundingPolicy,
    });
    const source = {
      loan,
      payments: [
        createPaymentRecord({
          id: 'payment-original',
          date: '2026-02-01',
          totalAmount: Money.from('100', 'CRC'),
          principalAmount: Money.from('50', 'CRC'),
          source: 'csv_import',
          sourcePaymentId: 'bank-payment-original',
        }),
      ],
      scenarios: [
        {
          id: 'scenario-original',
          loanId: loan.id,
          name: 'Aporte extra',
          configuration: { kind: 'constant_extra' },
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      bankReset: createBankReset({
        id: 'reset-original',
        cutoffDate: '2026-02-01',
        reportedBalance: Money.from('950', 'CRC'),
        bankFinalInstallmentDate: '2026-12-01',
        adjustment: {
          id: 'adjustment-original',
          date: '2026-02-01',
          principalAmount: Money.from('5', 'CRC'),
          reason: 'Ajuste confirmado.',
        },
      }),
    };
    const ids = ['loan-copy', 'payment-copy', 'scenario-copy', 'reset-copy', 'adjustment-copy'];
    const duplicate = createDuplicateLoanAggregate(
      source,
      { name: 'Casa de prueba', includePayments: true, includeScenarios: true },
      () => {
        const id = ids.shift();
        if (!id) throw new Error('No hay más identificadores de prueba.');
        return id;
      },
      '2026-08-09T00:00:00.000Z',
    );

    expect(duplicate.loan).toMatchObject({ id: 'loan-copy', name: 'Casa de prueba' });
    expect(duplicate.payments).toMatchObject([
      { id: 'payment-copy', sourcePaymentId: 'bank-payment-original' },
    ]);
    expect(duplicate.scenarios).toMatchObject([
      {
        id: 'scenario-copy',
        loanId: 'loan-copy',
        createdAt: '2026-08-09T00:00:00.000Z',
      },
    ]);
    expect(duplicate.bankReset).toMatchObject({
      id: 'reset-copy',
      adjustment: { id: 'adjustment-copy' },
    });
    expect(source.payments[0]?.id).toBe('payment-original');
    expect(source.scenarios[0]?.loanId).toBe('loan-original');
  });

  test('permite crear solo la configuración del préstamo', () => {
    const loan = createLoan({
      id: 'loan-original',
      name: 'Casa original',
      startDate: '2026-01-01',
      initialBalance: Money.from('1000', 'CRC'),
      ordinaryPayment: Money.from('100', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      roundingPolicy,
    });
    const duplicate = createDuplicateLoanAggregate(
      { loan, payments: [], scenarios: [] },
      { name: 'Solo condiciones', includePayments: false, includeScenarios: false },
      () => 'loan-copy',
    );

    expect(duplicate).toMatchObject({
      loan: { id: 'loan-copy', name: 'Solo condiciones' },
      payments: [],
      scenarios: [],
    });
  });
});
