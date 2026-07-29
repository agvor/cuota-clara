import { describe, expect, test } from 'vitest';

import {
  createLoan,
  createTbpMarginScenario,
  Money,
  projectLoanWithTbpMarginScenario,
  resolveTbpMarginRateForPeriod,
  TbpMarginRatePlanError,
  type TbpMarginRatePlan,
} from '../src/index.js';

const plan: TbpMarginRatePlan = {
  kind: 'tbp_margin_v1',
  fixedPeriods: 2,
  marginAnnualRate: '0.02',
  tbpInitialAnnualRate: '0.05',
  reviewFrequency: 'quarterly',
  evolution: 'alza_progresiva',
  variationPerReview: '0.001',
};

describe('TBP + margen', () => {
  test('resuelve fase fija y evolución estable, al alza o a la baja sin red', () => {
    expect(
      resolveTbpMarginRateForPeriod({
        fixedAnnualNominalRate: '0.12',
        plan,
        periodNumber: 1,
      }),
    ).toEqual({ phase: 'fixed', annualNominalRate: '0.12', tbpAnnualRate: '0.05' });
    expect(
      resolveTbpMarginRateForPeriod({
        fixedAnnualNominalRate: '0.12',
        plan,
        periodNumber: 3,
      }),
    ).toEqual({ phase: 'variable', annualNominalRate: '0.07', tbpAnnualRate: '0.05' });
    expect(
      resolveTbpMarginRateForPeriod({
        fixedAnnualNominalRate: '0.12',
        plan,
        periodNumber: 6,
      }),
    ).toEqual({ phase: 'variable', annualNominalRate: '0.071', tbpAnnualRate: '0.051' });

    const stable = { ...plan, evolution: 'estable' as const };
    expect(
      resolveTbpMarginRateForPeriod({
        fixedAnnualNominalRate: '0.12',
        plan: stable,
        periodNumber: 20,
      }).annualNominalRate,
    ).toBe('0.07');

    const decrease = {
      ...plan,
      reviewFrequency: 'monthly' as const,
      evolution: 'baja_progresiva' as const,
      tbpInitialAnnualRate: '0.001',
    };
    expect(
      resolveTbpMarginRateForPeriod({
        fixedAnnualNominalRate: '0.12',
        plan: decrease,
        periodNumber: 4,
      }),
    ).toEqual({ phase: 'variable', annualNominalRate: '0.02', tbpAnnualRate: '0' });
  });

  test('conserva el supuesto completo en el escenario y lo usa para proyectar', () => {
    const loan = createLoan({
      id: 'loan-001',
      name: 'Hipoteca',
      startDate: '2026-01-01',
      initialBalance: Money.from('1000.00', 'CRC'),
      ordinaryPayment: Money.from('340.00', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const scenario = createTbpMarginScenario({
      id: 'scenario-tbp',
      loanId: loan.id,
      name: 'TBP al alza',
      createdAt: '2026-01-01T00:00:00.000Z',
      plan,
    });
    const projection = projectLoanWithTbpMarginScenario({ loan, scenario });

    expect(scenario.configuration).toEqual(plan);
    expect(projection.periods.slice(0, 3).map((period) => period.annualNominalRate)).toEqual([
      '0.12',
      '0.12',
      '0.07',
    ]);
  });

  test('rechaza un plan TBP inválido sin reinterpretar una serie manual', () => {
    expect(() =>
      resolveTbpMarginRateForPeriod({
        fixedAnnualNominalRate: '0.12',
        plan: { ...plan, variationPerReview: '-0.001' },
        periodNumber: 3,
      }),
    ).toThrow(TbpMarginRatePlanError);
  });
});
