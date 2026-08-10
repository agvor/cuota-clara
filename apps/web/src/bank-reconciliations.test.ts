import {
  createBankReset,
  createLoan,
  createPaymentRecord,
  Money,
  type LoanAggregate,
} from '@cuotaclara/domain';
import { describe, expect, test } from 'vitest';

import {
  activeBalanceReconciliation,
  resolveLoanPosition,
  resolveLoanProjectionContext,
} from './bank-reconciliations.js';

function loanAggregate(overrides: Partial<LoanAggregate> = {}): LoanAggregate {
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
  return { loan, payments: [], scenarios: [], ...overrides };
}

describe('activeBalanceReconciliation', () => {
  test('descuenta el principal de pagos posteriores al saldo bancario conciliado', () => {
    const payments = [
      createPaymentRecord({
        id: 'after-reset',
        date: '2026-03-15',
        totalAmount: Money.from('1200', 'CRC'),
        principalAmount: Money.from('150', 'CRC'),
        extraPrincipalAmount: Money.from('50', 'CRC'),
        source: 'csv_import',
        sourcePaymentId: 'payment-after-reset',
      }),
    ];
    const aggregate = loanAggregate({
      payments,
      balanceReconciliations: [
        {
          id: 'balance-february',
          reportedAt: '2026-02-15',
          reportedBalance: Money.from('150000', 'CRC'),
        },
      ],
      bankFinalDateReconciliation: { bankFinalInstallmentDate: '2036-01-15' },
    });

    const active = activeBalanceReconciliation(aggregate);

    expect(active).toMatchObject({ cutoffDate: '2026-03-15' });
    expect(active?.reportedBalance.toDecimalString()).toBe('149800');
    const position = resolveLoanPosition(aggregate);
    expect(position).toMatchObject({
      status: 'available',
      cutoffDate: '2026-03-15',
      source: 'bank_reconciliation',
    });
    expect(position.status === 'available' && position.currentBalance.toDecimalString()).toBe(
      '149800',
    );
  });

  test('resuelve un saldo conciliado para lectura aunque no exista fecha final bancaria', () => {
    const aggregate = loanAggregate({
      balanceReconciliations: [
        {
          id: 'balance-only',
          reportedAt: '2026-02-15',
          reportedBalance: Money.from('150000', 'CRC'),
        },
      ],
    });

    expect(resolveLoanPosition(aggregate)).toMatchObject({
      status: 'available',
      cutoffDate: '2026-02-15',
      source: 'bank_reconciliation',
    });
    const position = resolveLoanPosition(aggregate);
    expect(position.status === 'available' && position.currentBalance.toDecimalString()).toBe(
      '150000',
    );
    expect(activeBalanceReconciliation(aggregate)).toBeUndefined();
  });

  test('reconstruye el saldo al último pago cuando no existe conciliación', () => {
    const aggregate = loanAggregate({
      payments: [
        createPaymentRecord({
          id: 'historical-payment',
          date: '2026-02-15',
          totalAmount: Money.from('1200', 'CRC'),
          principalAmount: Money.from('200', 'CRC'),
          source: 'manual',
        }),
      ],
    });

    const position = resolveLoanPosition(aggregate);
    expect(position).toMatchObject({
      status: 'available',
      cutoffDate: '2026-02-15',
      source: 'historical_payments',
    });
    expect(position.status === 'available' && position.currentBalance.toDecimalString()).toBe(
      '199800',
    );
  });

  test('usa el saldo inicial cuando no existe actividad', () => {
    const position = resolveLoanPosition(loanAggregate());

    expect(position).toMatchObject({
      status: 'available',
      cutoffDate: '2026-01-15',
      source: 'initial_balance',
    });
    expect(position.status === 'available' && position.currentBalance.toDecimalString()).toBe(
      '200000',
    );
  });

  test('no infiere saldo si un pago necesario no contiene principal', () => {
    const aggregate = loanAggregate({
      payments: [
        createPaymentRecord({
          id: 'payment-without-principal',
          date: '2026-02-15',
          totalAmount: Money.from('1200', 'CRC'),
          source: 'manual',
        }),
      ],
    });

    expect(resolveLoanPosition(aggregate)).toMatchObject({
      status: 'unavailable',
      reason: expect.stringContaining('no contiene principal'),
    });
  });

  test('conserva el reset heredado y la fecha final independiente en el contexto común', () => {
    const bankReset = createBankReset({
      id: 'legacy-reset',
      cutoffDate: '2026-02-15',
      reportedBalance: Money.from('150000', 'CRC'),
      bankFinalInstallmentDate: '2035-01-15',
    });
    const aggregate = loanAggregate({
      bankReset,
      bankFinalDateReconciliation: { bankFinalInstallmentDate: '2036-01-15' },
    });

    expect(resolveLoanProjectionContext(aggregate)).toMatchObject({
      bankReset,
      bankFinalInstallmentDate: '2036-01-15',
    });
    const position = resolveLoanPosition(aggregate);
    expect(position).toMatchObject({
      status: 'available',
      cutoffDate: '2026-02-15',
      source: 'bank_reconciliation',
    });
  });
});
