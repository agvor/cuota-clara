// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  createLoan,
  createLoanV2,
  createLoanV3,
  Money,
  type LoanRepository,
} from '@cuotaclara/domain';

import { App } from './app.js';

afterEach(cleanup);

function createRepository(loans: Awaited<ReturnType<LoanRepository['listLoans']>>): LoanRepository {
  return {
    listLoans: vi.fn().mockResolvedValue(loans),
    loadAggregate: vi.fn(),
    saveAggregate: vi.fn(),
    deleteLoan: vi.fn(),
  };
}

describe('App', () => {
  test('muestra un estado vacío accesible cuando no hay préstamos', async () => {
    render(<App repository={createRepository([])} />);

    expect(await screen.findByRole('heading', { name: 'Aún no hay préstamos' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeVisible();
  });

  test('muestra el resumen de cada préstamo sin recalcularlo en la interfaz', async () => {
    const loan = createLoan({
      id: 'loan-001',
      name: 'Hipoteca principal',
      startDate: '2026-01-01',
      initialBalance: Money.from('100000.00', 'CRC'),
      ordinaryPayment: Money.from('1000.00', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    render(<App repository={createRepository([loan])} />);

    expect(await screen.findByRole('heading', { name: 'Hipoteca principal' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Ver préstamo' }));
    expect(screen.getByRole('heading', { name: 'Resumen de Hipoteca principal' })).toBeVisible();
  });

  test('muestra importes grandes formateados y el resumen financiero contractual', async () => {
    const loan = createLoanV3({
      id: 'loan-summary',
      name: 'Hipoteca formateada',
      startDate: '2026-01-15',
      originalPrincipal: Money.from('115000000', 'CRC'),
      monthlyTotalPayment: Money.from('1000000', 'CRC'),
      monthlyInsurance: Money.from('150000', 'CRC'),
      term: { totalInstallments: 360 },
      annualNominalRate: '0.085',
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const repository = createRepository([loan]);
    vi.mocked(repository.loadAggregate).mockResolvedValue({ loan, payments: [], scenarios: [] });
    render(<App repository={repository} />);

    expect(
      await screen.findByText((content) => content.replaceAll('\u00a0', ' ') === '₡115 000 000,00'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Ver préstamo' }));

    expect(
      await screen.findByRole('heading', { name: 'Resumen financiero estimado' }),
    ).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Última cuota estimada' })).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Principal estimado' })).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Interés estimado' })).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Total proyectado' })).toBeVisible();
    expect(screen.getByText('2056-01-15')).toBeVisible();
  });

  test('guarda contrato v3 con cuota total, estimación y escenario TBP en un agregado nuevo', async () => {
    const repository = createRepository([]);
    render(<App repository={repository} />);
    await screen.findByRole('heading', { name: 'Aún no hay préstamos' });
    fireEvent.click(screen.getByRole('button', { name: 'Crear préstamo' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Préstamo mixto' } });
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Monto original'), { target: { value: '100000.00' } });
    fireEvent.change(screen.getByLabelText('Cuota mensual total, incluido seguro'), {
      target: { value: '1115.00' },
    });
    fireEvent.change(screen.getByLabelText('Seguro mensual, incluido en la cuota total'), {
      target: { value: '15.00' },
    });
    fireEvent.change(screen.getByLabelText('Número total de cuotas'), {
      target: { value: '180' },
    });
    fireEvent.change(screen.getByLabelText('Tasa nominal anual fija'), {
      target: { value: '0.12' },
    });
    fireEvent.click(screen.getByLabelText('TBP + margen (predeterminada)'));
    expect(await screen.findByRole('heading', { name: 'Proyección inicial' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar préstamo' }));

    await waitFor(() => expect(repository.saveAggregate).toHaveBeenCalledTimes(1));
    expect(repository.saveAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        loan: expect.objectContaining({
          name: 'Préstamo mixto',
          ordinaryPayment: expect.objectContaining({}),
          contract: expect.objectContaining({
            version: 3,
            monthlyTotalPayment: expect.anything(),
            monthlyInsurance: expect.anything(),
          }),
          tbpMarginRatePlan: expect.objectContaining({ kind: 'tbp_margin_v1', fixedPeriods: 12 }),
        }),
        scenarios: [
          expect.objectContaining({
            configuration: expect.objectContaining({ kind: 'tbp_margin_v1' }),
          }),
        ],
      }),
    );
  });

  test('muestra el error de cuota base insuficiente antes de guardar', async () => {
    render(<App repository={createRepository([])} />);
    await screen.findByRole('heading', { name: 'Aún no hay préstamos' });
    fireEvent.click(screen.getByRole('button', { name: 'Crear préstamo' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Cuota insuficiente' } });
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-01-15' } });
    fireEvent.change(screen.getByLabelText('Monto original'), { target: { value: '115000000' } });
    fireEvent.change(screen.getByLabelText('Cuota mensual total, incluido seguro'), {
      target: { value: '900000' },
    });
    fireEvent.change(screen.getByLabelText('Seguro mensual, incluido en la cuota total'), {
      target: { value: '150000' },
    });
    fireEvent.change(screen.getByLabelText('Número total de cuotas'), {
      target: { value: '360' },
    });
    fireEvent.change(screen.getByLabelText('Tasa nominal anual fija'), {
      target: { value: '0.085' },
    });

    expect(
      await screen.findByText(/cuota base derivada de cuota total menos seguro/i),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Guardar préstamo' })).toBeDisabled();
  });

  test('identifica préstamos sin contrato como heredados', async () => {
    const legacyLoan = createLoan({
      id: 'legacy-001',
      name: 'Préstamo anterior',
      startDate: '2026-01-01',
      initialBalance: Money.from('1000.00', 'CRC'),
      ordinaryPayment: Money.from('100.00', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    render(<App repository={createRepository([legacyLoan])} />);

    await screen.findByRole('heading', { name: 'Préstamo anterior' });
    expect(screen.getByText('Préstamo heredado: falta plazo y seguro')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Ver préstamo' }));
    expect(screen.getByText(/Este préstamo es heredado/)).toBeVisible();
  });

  test('migra un contrato v2 a cuota total v3 únicamente al guardarlo', async () => {
    const v2Loan = createLoanV2({
      id: 'loan-v2',
      name: 'Préstamo anterior',
      startDate: '2026-01-01',
      originalPrincipal: Money.from('100000.00', 'CRC'),
      monthlyInstallment: Money.from('1100.00', 'CRC'),
      monthlyInsurance: Money.from('15.00', 'CRC'),
      term: { totalInstallments: 180 },
      annualNominalRate: '0.12',
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const repository = createRepository([v2Loan]);
    vi.mocked(repository.loadAggregate).mockResolvedValue({
      loan: v2Loan,
      payments: [],
      scenarios: [],
    });
    render(<App repository={repository} />);

    await screen.findByRole('heading', { name: 'Préstamo anterior' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver préstamo' }));
    expect(await screen.findByRole('button', { name: 'Editar préstamo' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Editar préstamo' }));
    expect(screen.getByText(/Contrato v2 heredado/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar préstamo' }));

    await waitFor(() => expect(repository.saveAggregate).toHaveBeenCalledTimes(1));
    const saved = vi.mocked(repository.saveAggregate).mock.calls[0]?.[0];
    expect(saved?.loan.contract).toMatchObject({ version: 3 });
    if (!saved?.loan.contract || saved.loan.contract.version !== 3) {
      throw new Error('No se guardó el contrato v3 esperado.');
    }
    expect(saved.loan.contract.monthlyTotalPayment.toFixed(saved.loan.roundingPolicy)).toBe(
      '1115.00',
    );
    expect(saved.loan.ordinaryPayment.toFixed(saved.loan.roundingPolicy)).toBe('1100.00');
  });
});
