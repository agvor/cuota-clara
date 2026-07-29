import { describe, expect, test } from 'vitest';

import {
  calculateFixedNominalInterest,
  InterestValidationError,
} from '../src/interest/fixed-rate.js';
import { Money } from '../src/money.js';

const roundingPolicy = { scale: 2, mode: 'half_up' } as const;

describe('calculateFixedNominalInterest', () => {
  test('calcula interés nominal mensual y conserva su trazabilidad', () => {
    const result = calculateFixedNominalInterest({
      openingBalance: Money.from('1000.00', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      periodStartDate: '2026-01-01',
      periodEndDate: '2026-02-01',
      roundingPolicy,
    });

    expect(result.interest.toFixed(roundingPolicy)).toBe('10.00');
    expect(result.trace).toEqual({
      model: 'nominal_annual_divided_by_periods',
      annualNominalRate: '0.12',
      periodicRate: '0.01',
      periodStartDate: '2026-01-01',
      periodEndDate: '2026-02-01',
      roundingPolicy,
    });
  });

  test('aplica la política de redondeo al interés de cada periodo', () => {
    const result = calculateFixedNominalInterest({
      openingBalance: Money.from('336.70', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      periodStartDate: '2026-03-01',
      periodEndDate: '2026-04-01',
      roundingPolicy,
    });

    expect(result.interest.toFixed(roundingPolicy)).toBe('3.37');
  });

  test('rechaza tasas negativas y frecuencias no válidas', () => {
    const base = {
      openingBalance: Money.from('1000.00', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      periodStartDate: '2026-01-01',
      periodEndDate: '2026-02-01',
      roundingPolicy,
    };

    expect(() => calculateFixedNominalInterest({ ...base, annualNominalRate: '-0.01' })).toThrow(
      InterestValidationError,
    );
    expect(() => calculateFixedNominalInterest({ ...base, periodsPerYear: 0 })).toThrow(
      InterestValidationError,
    );
  });
});
