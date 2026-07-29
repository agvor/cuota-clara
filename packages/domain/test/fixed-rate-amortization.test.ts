import { describe, expect, test } from 'vitest';

import {
  AmortizationValidationError,
  generateFixedRateAmortization,
} from '../src/amortization/fixed-rate.js';
import { Money } from '../src/money.js';

const roundingPolicy = { scale: 2, mode: 'half_up' } as const;

describe('generateFixedRateAmortization', () => {
  test('reproduce el caso fijo sintético, incluido el pago final limitado', () => {
    const result = generateFixedRateAmortization({
      openingBalance: Money.from('1000.00', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      ordinaryPayment: Money.from('340.00', 'CRC'),
      startDate: '2026-01-01',
      periodEndDates: ['2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01'],
      roundingPolicy,
    });

    expect(
      result.periods.map((period) => ({
        period: period.period,
        date: period.date,
        openingBalance: period.openingBalance.toFixed(roundingPolicy),
        interest: period.interest.toFixed(roundingPolicy),
        principal: period.principal.toFixed(roundingPolicy),
        fees: period.fees.toFixed(roundingPolicy),
        payment: period.payment.toFixed(roundingPolicy),
        closingBalance: period.closingBalance.toFixed(roundingPolicy),
      })),
    ).toEqual([
      {
        period: 1,
        date: '2026-02-01',
        openingBalance: '1000.00',
        interest: '10.00',
        principal: '330.00',
        fees: '0.00',
        payment: '340.00',
        closingBalance: '670.00',
      },
      {
        period: 2,
        date: '2026-03-01',
        openingBalance: '670.00',
        interest: '6.70',
        principal: '333.30',
        fees: '0.00',
        payment: '340.00',
        closingBalance: '336.70',
      },
      {
        period: 3,
        date: '2026-04-01',
        openingBalance: '336.70',
        interest: '3.37',
        principal: '336.63',
        fees: '0.00',
        payment: '340.00',
        closingBalance: '0.07',
      },
      {
        period: 4,
        date: '2026-05-01',
        openingBalance: '0.07',
        interest: '0.00',
        principal: '0.07',
        fees: '0.00',
        payment: '0.07',
        closingBalance: '0.00',
      },
    ]);
    expect(result.summary).toEqual({
      completionDate: '2026-05-01',
      totalInterest: '20.07',
      totalPaid: '1020.07',
      totalPrincipal: '1000.00',
    });
  });

  test('rechaza una lista de fechas insuficiente para cancelar el saldo', () => {
    expect(() =>
      generateFixedRateAmortization({
        openingBalance: Money.from('1000.00', 'CRC'),
        annualNominalRate: '0.12',
        periodsPerYear: 12,
        ordinaryPayment: Money.from('340.00', 'CRC'),
        startDate: '2026-01-01',
        periodEndDates: ['2026-02-01'],
        roundingPolicy,
      }),
    ).toThrow(AmortizationValidationError);
  });
});
