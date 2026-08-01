// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import {
  createBankReset,
  createLoanV3,
  createPaymentRecord,
  estimateLoanContract,
  Money,
} from '@cuotaclara/domain';

import { EstimateSummary } from './estimate-summary.js';

afterEach(cleanup);

describe('EstimateSummary', () => {
  test('agrupa la proyección, la actividad y la conciliación sin mezclar sus importes', () => {
    const loan = createLoanV3({
      id: 'summary-history',
      name: 'Préstamo con actividad',
      startDate: '2026-01-01',
      originalPrincipal: Money.from('1000.00', 'CRC'),
      monthlyTotalPayment: Money.from('105.00', 'CRC'),
      monthlyInsurance: Money.from('5.00', 'CRC'),
      term: { totalInstallments: 12 },
      annualNominalRate: '0.12',
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const payment = createPaymentRecord({
      id: 'payment-001',
      date: '2026-02-01',
      totalAmount: Money.from('105.00', 'CRC'),
      interestAmount: Money.from('10.00', 'CRC'),
      principalAmount: Money.from('50.00', 'CRC'),
      insuranceAmount: Money.from('45.00', 'CRC'),
      source: 'csv_import',
    });
    const bankReset = createBankReset({
      id: 'reset-001',
      cutoffDate: '2026-02-01',
      reportedBalance: Money.from('940.00', 'CRC'),
      bankFinalInstallmentDate: '2026-12-01',
      adjustment: {
        id: 'adjustment-001',
        date: '2026-02-01',
        principalAmount: Money.from('10.00', 'CRC'),
        reason: 'Diferencia confirmada.',
      },
    });
    const estimate = estimateLoanContract(loan, { bankReset });

    render(
      <EstimateSummary
        loan={loan}
        estimate={estimate}
        aggregate={{ loan, payments: [payment], bankReset, scenarios: [] }}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Proyección pendiente' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Actividad registrada' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Conciliación del saldo' })).toBeVisible();
    expect(
      screen.getByRole('columnheader', { name: 'Totales pagados y proyectados' }),
    ).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Principal restante proyectado' })).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Interés futuro estimado' })).toBeVisible();
    expect(
      screen.getByRole('rowheader', { name: 'Cuota mensual recalculada al corte' }),
    ).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Principal registrado' })).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Interés registrado' })).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Seguro registrado' })).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Aporte extraordinario asumido' })).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Total pagado y proyectado' })).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Seguro pagado y proyectado' })).toBeVisible();
    expect(screen.queryByRole('rowheader', { name: 'Principal total' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('rowheader', { name: 'Interés histórico CSV' }),
    ).not.toBeInTheDocument();
  });
});
