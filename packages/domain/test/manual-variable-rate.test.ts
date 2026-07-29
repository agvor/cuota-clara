import { expect, test } from 'vitest';

import { generateFixedRateAmortization } from '../src/amortization/fixed-rate.js';
import { VariableRatePlanError } from '../src/interest/manual-variable-rate.js';
import { Money } from '../src/money.js';

const roundingPolicy = { scale: 2, mode: 'half_up' } as const;

test('mantiene la cuota y aplica una serie manual después del periodo fijo', () => {
  const result = generateFixedRateAmortization({
    openingBalance: Money.from('1000.00', 'CRC'),
    annualNominalRate: '0.12',
    periodsPerYear: 12,
    ordinaryPayment: Money.from('340.00', 'CRC'),
    startDate: '2026-01-01',
    periodEndDates: ['2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01'],
    roundingPolicy,
    variableRatePlan: {
      fixedPeriods: 2,
      reviewFrequency: 'monthly',
      variableRates: [{ effectiveDate: '2026-04-01', annualNominalRate: '0.24' }],
    },
  });

  expect(
    result.periods.map((period) => ({
      date: period.date,
      phase: period.ratePhase,
      annualNominalRate: period.annualNominalRate,
      interest: period.interest.toFixed(roundingPolicy),
      ordinaryPayment: period.ordinaryPayment.toFixed(roundingPolicy),
      closingBalance: period.closingBalance.toFixed(roundingPolicy),
    })),
  ).toEqual([
    {
      date: '2026-02-01',
      phase: 'fixed',
      annualNominalRate: '0.12',
      interest: '10.00',
      ordinaryPayment: '340.00',
      closingBalance: '670.00',
    },
    {
      date: '2026-03-01',
      phase: 'fixed',
      annualNominalRate: '0.12',
      interest: '6.70',
      ordinaryPayment: '340.00',
      closingBalance: '336.70',
    },
    {
      date: '2026-04-01',
      phase: 'variable',
      annualNominalRate: '0.24',
      interest: '6.73',
      ordinaryPayment: '340.00',
      closingBalance: '3.43',
    },
    {
      date: '2026-05-01',
      phase: 'variable',
      annualNominalRate: '0.24',
      interest: '0.07',
      ordinaryPayment: '3.50',
      closingBalance: '0.00',
    },
  ]);
});

test('rechaza un periodo variable sin una tasa manual vigente', () => {
  expect(() =>
    generateFixedRateAmortization({
      openingBalance: Money.from('1000.00', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      ordinaryPayment: Money.from('340.00', 'CRC'),
      startDate: '2026-01-01',
      periodEndDates: ['2026-02-01', '2026-03-01'],
      roundingPolicy,
      variableRatePlan: {
        fixedPeriods: 1,
        reviewFrequency: 'monthly',
        variableRates: [{ effectiveDate: '2026-04-01', annualNominalRate: '0.24' }],
      },
    }),
  ).toThrow(VariableRatePlanError);
});
