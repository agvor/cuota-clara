import { describe, expect, test } from 'vitest';

import {
  compareLoanWithRecurringExtraPayment,
  createLoan,
  createRecurringExtraPaymentScenario,
  Money,
} from '../src/index.js';

const loan = createLoan({
  id: 'loan-recurring',
  name: 'Préstamo recurrente',
  startDate: '2026-01-01',
  initialBalance: Money.from('1000.00', 'CRC'),
  ordinaryPayment: Money.from('100.00', 'CRC'),
  annualNominalRate: '0',
  periodsPerYear: 12,
  roundingPolicy: { scale: 2, mode: 'half_up' },
});

describe('escenarios de aporte recurrente', () => {
  test('aplica un extraordinario fijo todos los meses', () => {
    const scenario = createRecurringExtraPaymentScenario({
      id: 'recurring-extra',
      loanId: loan.id,
      name: 'Extra fijo',
      createdAt: '2026-01-01T00:00:00.000Z',
      recurringExtraPayment: { kind: 'constant_extra', amount: Money.from('50', 'CRC') },
    });

    const comparison = compareLoanWithRecurringExtraPayment({ loan, scenario });
    expect(comparison.alternative.periods).toHaveLength(7);
    expect(comparison.alternative.periods[0]?.extraPayment.toFixed(loan.roundingPolicy)).toBe(
      '50.00',
    );
    expect(comparison.comparison.periodsSaved).toBe(3);
  });

  test('completa un aporte fijo al principal tras la cuota ordinaria', () => {
    const scenario = createRecurringExtraPaymentScenario({
      id: 'recurring-principal',
      loanId: loan.id,
      name: 'Principal objetivo',
      createdAt: '2026-01-01T00:00:00.000Z',
      recurringExtraPayment: { kind: 'constant_principal', amount: Money.from('200', 'CRC') },
    });

    const comparison = compareLoanWithRecurringExtraPayment({ loan, scenario });
    expect(comparison.alternative.periods).toHaveLength(5);
    expect(comparison.alternative.periods[0]?.extraPayment.toFixed(loan.roundingPolicy)).toBe(
      '100.00',
    );
    expect(comparison.alternative.periods[0]?.principal.toFixed(loan.roundingPolicy)).toBe(
      '200.00',
    );
  });
});
