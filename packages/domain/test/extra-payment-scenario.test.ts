import { describe, expect, test } from 'vitest';

import {
  compareLoanWithOneTimeExtraPayment,
  createLoan,
  createOneTimeExtraPaymentScenario,
  Money,
} from '../src/index.js';

const loan = createLoan({
  id: 'loan-001',
  name: 'Préstamo de referencia',
  startDate: '2026-01-01',
  initialBalance: Money.from('1000.00', 'CRC'),
  ordinaryPayment: Money.from('100.00', 'CRC'),
  annualNominalRate: '0.12',
  periodsPerYear: 12,
  roundingPolicy: { scale: 2, mode: 'half_up' },
});

describe('escenario de pago extraordinario', () => {
  test('compara base y alternativa sin mutar el préstamo', () => {
    const scenario = createOneTimeExtraPaymentScenario({
      id: 'scenario-001',
      loanId: loan.id,
      name: 'Aporte de marzo',
      createdAt: '2026-01-01T00:00:00.000Z',
      extraPayment: { id: 'extra-001', date: '2026-03-01', amount: Money.from('100.00', 'CRC') },
    });

    const comparison = compareLoanWithOneTimeExtraPayment({ loan, scenario });

    expect(
      comparison.alternative.summary.completionDate < comparison.base.summary.completionDate,
    ).toBe(true);
    expect(comparison.comparison.interestSaved.isPositive()).toBe(true);
    expect(loan.initialBalance.toFixed(loan.roundingPolicy)).toBe('1000.00');
    expect(scenario.configuration.kind).toBe('one_time_extra_payment_v1');
  });
});
