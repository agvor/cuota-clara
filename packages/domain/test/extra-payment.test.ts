import { describe, expect, test } from 'vitest';

import {
  compareFixedRateAmortizations,
  generateFixedRateAmortization,
} from '../src/amortization/fixed-rate.js';
import { Money } from '../src/money.js';

const roundingPolicy = { scale: 2, mode: 'half_up' } as const;
const commonInput = {
  openingBalance: Money.from('1000.00', 'CRC'),
  annualNominalRate: '0.12',
  periodsPerYear: 12,
  ordinaryPayment: Money.from('340.00', 'CRC'),
  startDate: '2026-01-01',
  periodEndDates: ['2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01'],
  roundingPolicy,
};

describe('pagos extraordinarios únicos', () => {
  test('aplica el pago extra al principal después de la cuota ordinaria', () => {
    const result = generateFixedRateAmortization({
      ...commonInput,
      extraPayments: [
        {
          id: 'bonus-2026',
          date: '2026-02-01',
          amount: Money.from('100.00', 'CRC'),
        },
      ],
    });

    expect(
      result.periods.map((period) => ({
        date: period.date,
        ordinaryPayment: period.ordinaryPayment.toFixed(roundingPolicy),
        extraPayment: period.extraPayment.toFixed(roundingPolicy),
        payment: period.payment.toFixed(roundingPolicy),
        closingBalance: period.closingBalance.toFixed(roundingPolicy),
      })),
    ).toEqual([
      {
        date: '2026-02-01',
        ordinaryPayment: '340.00',
        extraPayment: '100.00',
        payment: '440.00',
        closingBalance: '570.00',
      },
      {
        date: '2026-03-01',
        ordinaryPayment: '340.00',
        extraPayment: '0.00',
        payment: '340.00',
        closingBalance: '235.70',
      },
      {
        date: '2026-04-01',
        ordinaryPayment: '238.06',
        extraPayment: '0.00',
        payment: '238.06',
        closingBalance: '0.00',
      },
    ]);
  });

  test('compara el escenario base y el escenario con pago extra', () => {
    const base = generateFixedRateAmortization(commonInput);
    const extra = generateFixedRateAmortization({
      ...commonInput,
      extraPayments: [
        {
          id: 'bonus-2026',
          date: '2026-02-01',
          amount: Money.from('100.00', 'CRC'),
        },
      ],
    });

    const comparison = compareFixedRateAmortizations(base, extra);

    expect(comparison.interestSaved.toFixed(roundingPolicy)).toBe('2.01');
    expect(comparison.periodsSaved).toBe(1);
    expect(comparison.baseCompletionDate).toBe('2026-05-01');
    expect(comparison.alternativeCompletionDate).toBe('2026-04-01');
  });
});
