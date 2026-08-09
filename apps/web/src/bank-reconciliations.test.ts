import { createLoan, createPaymentRecord, Money, type LoanAggregate } from '@cuotaclara/domain';
import { describe, expect, test } from 'vitest';

import { activeBalanceReconciliation } from './bank-reconciliations.js';

describe('activeBalanceReconciliation', () => {
  test('descuenta el principal de pagos posteriores al saldo bancario conciliado', () => {
    const loan = createLoan({
      id: 'loan-reconciliation',
      name: 'Saldo compuesto',
      startDate: '2026-01-15',
      initialBalance: Money.from('200000', 'CRC'),
      ordinaryPayment: Money.from('1000', 'CRC'),
      annualNominalRate: '0.08',
      periodsPerYear: 12,
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const payments = [
      createPaymentRecord({
        id: 'after-reset',
        date: '2026-03-15',
        totalAmount: Money.from('1200', 'CRC'),
        principalAmount: Money.from('150', 'CRC'),
        extraPrincipalAmount: Money.from('50', 'CRC'),
        source: 'csv_import',
      }),
    ];
    const aggregate: LoanAggregate = {
      loan,
      payments,
      balanceReconciliations: [
        {
          id: 'balance-february',
          reportedAt: '2026-02-15',
          reportedBalance: Money.from('150000', 'CRC'),
        },
      ],
      bankFinalDateReconciliation: { bankFinalInstallmentDate: '2036-01-15' },
      scenarios: [],
    };

    const active = activeBalanceReconciliation(aggregate);

    expect(active).toMatchObject({ cutoffDate: '2026-03-15' });
    expect(active?.reportedBalance.toDecimalString()).toBe('149800');
  });
});
