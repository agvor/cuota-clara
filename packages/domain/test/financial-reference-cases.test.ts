import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';

type ExpectedPeriod = {
  period: number;
  date: string;
  openingBalance: string;
  interest: string;
  principal: string;
  payment: string;
  closingBalance: string;
};

type FinancialReferenceCase = {
  caseId: string;
  source: {
    type: string;
    isBankValidated: boolean;
    reference: string;
    containsPersonalData: boolean;
  };
  inputs: {
    openingBalance: string;
    annualNominalRate: string;
    periodsPerYear: number;
    ordinaryPayment: string;
    rounding: { scale: number; mode: string; stage: string };
  };
  expected: {
    periods: ExpectedPeriod[];
    totals: { interest: string; principal: string; paid: string };
  };
};

async function loadCase(): Promise<FinancialReferenceCase> {
  const file = new URL('./fixtures/fixed-rate-monthly-v1.json', import.meta.url);
  return JSON.parse(await readFile(file, 'utf8')) as FinancialReferenceCase;
}

test('el caso fijo sintético conserva entradas, supuestos y resultados trazables', async () => {
  const referenceCase = await loadCase();

  expect(referenceCase.caseId).toBe('fixed-rate-monthly-v1');
  expect(referenceCase.source).toEqual({
    type: 'synthetic',
    isBankValidated: false,
    reference:
      'Caso manual creado para CuotaClara; no representa un contrato ni estado de cuenta bancario.',
    containsPersonalData: false,
  });
  expect(referenceCase.inputs).toMatchObject({
    openingBalance: '1000.00',
    annualNominalRate: '0.12',
    periodsPerYear: 12,
    ordinaryPayment: '340.00',
    rounding: { scale: 2, mode: 'half_up', stage: 'interest_each_period' },
  });
  expect(referenceCase.expected.periods).toEqual([
    {
      period: 1,
      date: '2026-02-01',
      openingBalance: '1000.00',
      interest: '10.00',
      principal: '330.00',
      payment: '340.00',
      closingBalance: '670.00',
    },
    {
      period: 2,
      date: '2026-03-01',
      openingBalance: '670.00',
      interest: '6.70',
      principal: '333.30',
      payment: '340.00',
      closingBalance: '336.70',
    },
    {
      period: 3,
      date: '2026-04-01',
      openingBalance: '336.70',
      interest: '3.37',
      principal: '336.63',
      payment: '340.00',
      closingBalance: '0.07',
    },
    {
      period: 4,
      date: '2026-05-01',
      openingBalance: '0.07',
      interest: '0.00',
      principal: '0.07',
      payment: '0.07',
      closingBalance: '0.00',
    },
  ]);
  expect(referenceCase.expected.totals).toEqual({
    interest: '20.07',
    principal: '1000.00',
    paid: '1020.07',
  });
});
