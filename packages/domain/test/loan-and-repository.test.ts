import { describe, expect, test } from 'vitest';

import {
  createLoan,
  createLoanV2,
  createLoanV3,
  isLegacyLoan,
  LoanValidationError,
  requiresContractMigration,
} from '../src/loan/loan.js';
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

  test('conserva una configuración variable manual validada', () => {
    const loan = createLoan({
      id: 'loan-001',
      name: 'Hipoteca principal',
      startDate: '2026-01-01',
      initialBalance: Money.from('100000.00', 'CRC'),
      ordinaryPayment: Money.from('1000.00', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      roundingPolicy,
      variableRatePlan: {
        fixedPeriods: 12,
        reviewFrequency: 'annual',
        variableRates: [{ effectiveDate: '2027-01-01', annualNominalRate: '0.08' }],
      },
    });
    expect(loan.variableRatePlan?.fixedPeriods).toBe(12);
  });

  test('crea un contrato v2 con plazo y seguro mensual separado', () => {
    const loan = createLoanV2({
      id: 'loan-v2',
      name: 'Hipoteca v2',
      startDate: '2026-01-01',
      originalPrincipal: Money.from('100000.00', 'CRC'),
      monthlyInstallment: Money.from('1000.00', 'CRC'),
      monthlyInsurance: Money.from('15.00', 'CRC'),
      term: { totalInstallments: 180 },
      annualNominalRate: '0.12',
      roundingPolicy,
    });

    expect(loan.contract?.term).toEqual({ totalInstallments: 180 });
    expect(loan.contract?.monthlyInsurance.toFixed(roundingPolicy)).toBe('15.00');
    expect(isLegacyLoan(loan)).toBe(false);
  });

  test('reconoce el préstamo v1 como heredado sin inventar plazo ni seguro', () => {
    const legacyLoan = createLoan({
      id: 'legacy',
      name: 'Préstamo heredado',
      startDate: '2026-01-01',
      initialBalance: Money.from('1000.00', 'CRC'),
      ordinaryPayment: Money.from('100.00', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      roundingPolicy,
    });

    expect(isLegacyLoan(legacyLoan)).toBe(true);
    expect(legacyLoan.contract).toBeUndefined();
  });

  test('deriva cuota base de una cuota total v3 incluida con seguro', () => {
    const loan = createLoanV3({
      id: 'loan-v3',
      name: 'Hipoteca v3',
      startDate: '2026-01-01',
      originalPrincipal: Money.from('115000000', 'CRC'),
      monthlyTotalPayment: Money.from('900000', 'CRC'),
      monthlyInsurance: Money.from('150000', 'CRC'),
      term: { totalInstallments: 360 },
      annualNominalRate: '0.085',
      roundingPolicy,
    });

    expect(loan.contract).toMatchObject({ version: 3 });
    expect(loan.ordinaryPayment.toFixed(roundingPolicy)).toBe('750000.00');
    expect(requiresContractMigration(loan)).toBe(false);
  });

  test('rechaza una cuota total que no deja cuota base', () => {
    expect(() =>
      createLoanV3({
        id: 'loan-invalid',
        name: 'Inválido',
        startDate: '2026-01-01',
        originalPrincipal: Money.from('1000', 'CRC'),
        monthlyTotalPayment: Money.from('10', 'CRC'),
        monthlyInsurance: Money.from('10', 'CRC'),
        term: { totalInstallments: 12 },
        annualNominalRate: '0.12',
        roundingPolicy,
      }),
    ).toThrow(LoanValidationError);
  });
});
