import { describe, expect, test } from 'vitest';

import { createLoan, LoanValidationError } from '../src/loan/loan.js';
import { Money } from '../src/money.js';

const roundingPolicy = { scale: 2, mode: 'half_up' } as const;

describe('Loan', () => {
  test('crea un préstamo mínimo con configuración financiera independiente', () => {
    const loan = createLoan({
      id: 'loan-001',
      name: 'Hipoteca principal',
      startDate: '2026-01-01',
      initialBalance: Money.from('100000.00', 'CRC'),
      ordinaryPayment: Money.from('1000.00', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      roundingPolicy,
    });

    expect(loan.id).toBe('loan-001');
    expect(loan.initialBalance.currency).toBe('CRC');
    expect(loan.roundingPolicy).toEqual(roundingPolicy);
  });

  test('rechaza una cuota de moneda distinta al saldo', () => {
    expect(() =>
      createLoan({
        id: 'loan-001',
        name: 'Hipoteca principal',
        startDate: '2026-01-01',
        initialBalance: Money.from('100000.00', 'CRC'),
        ordinaryPayment: Money.from('1000.00', 'USD'),
        annualNominalRate: '0.12',
        periodsPerYear: 12,
        roundingPolicy,
      }),
    ).toThrow(LoanValidationError);
  });
});
