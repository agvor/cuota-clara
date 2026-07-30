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

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '#/prestamos');
});

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
    expect(screen.getByRole('heading', { name: 'Hipoteca principal' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true');
  });

  test('separa las tareas del préstamo en vistas navegables', async () => {
    const loan = createLoan({
      id: 'loan-workspace',
      name: 'Préstamo organizado',
      startDate: '2026-01-01',
      initialBalance: Money.from('1000.00', 'CRC'),
      ordinaryPayment: Money.from('100.00', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const repository = createRepository([loan]);
    vi.mocked(repository.loadAggregate).mockResolvedValue({ loan, payments: [], scenarios: [] });
    render(<App repository={repository} />);

    await screen.findByRole('heading', { name: 'Préstamo organizado' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver préstamo' }));

    expect(screen.getByRole('tablist', { name: 'Secciones del préstamo' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Pagos históricos' })).not.toBeInTheDocument();
    const summaryTab = screen.getByRole('tab', { name: 'Resumen' });
    summaryTab.focus();
    fireEvent.keyDown(summaryTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Pagos' })).toHaveAttribute('aria-selected', 'true');
    expect(window.location.hash).toBe('#/prestamos/loan-workspace/payments');
    expect(await screen.findByRole('heading', { name: 'Pagos históricos' })).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Escenarios' }));
    expect(screen.getByRole('heading', { name: 'Configuración de escenarios' })).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Proyección' }));
    expect(screen.getByRole('heading', { name: 'Detalle de amortización' })).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Configuración' }));
    expect(screen.getByRole('heading', { name: 'Zona de riesgo' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '← Todos los préstamos' }));
    expect(screen.getByRole('heading', { name: 'Tus préstamos' })).toBeVisible();
    expect(window.location.hash).toBe('#/prestamos');
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
    expect(screen.getByText('Cuota mensual total')).toBeVisible();
    expect(screen.getByText('2056-01-15')).toBeVisible();
    expect(
      screen.queryByRole('img', { name: 'Evolución estimada del saldo' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Proyección' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle de amortización' }));

    expect(screen.getByRole('img', { name: 'Evolución estimada del saldo' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ocultar detalle de amortización' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
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
    fireEvent.change(screen.getByLabelText('Tasa nominal anual fija (%)'), {
      target: { value: '12' },
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
    const saved = vi.mocked(repository.saveAggregate).mock.calls[0]?.[0];
    expect(saved?.loan).toMatchObject({
      annualNominalRate: '0.12',
      tbpMarginRatePlan: {
        tbpInitialAnnualRate: '0.05',
        marginAnnualRate: '0.02',
      },
    });
  });

  test('muestra la discrepancia de cuota sin alterar el plazo contractual', async () => {
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
    fireEvent.change(screen.getByLabelText('Tasa nominal anual fija (%)'), {
      target: { value: '8.5' },
    });

    expect(await screen.findByText('2056-01-15')).toBeVisible();
    expect(screen.getByText('360')).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Cuota total configurada' })).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Cuota total proyectada inicial' })).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Diferencia inicial de cuota' })).toBeVisible();
    expect(
      screen.getByText(/la cuota proyectada se recalcula para conservar el plazo/i),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Guardar préstamo' })).toBeEnabled();
  });

  test('calcula y conserva una cuota automática sin mostrar cuota proyectada inicial', async () => {
    const repository = createRepository([]);
    render(<App repository={repository} />);
    await screen.findByRole('heading', { name: 'Aún no hay préstamos' });
    fireEvent.click(screen.getByRole('button', { name: 'Crear préstamo' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Automático' } });
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-01-15' } });
    fireEvent.change(screen.getByLabelText('Monto original'), { target: { value: '1000000' } });
    fireEvent.change(screen.getByLabelText('Seguro mensual, incluido en la cuota total'), {
      target: { value: '15000' },
    });
    fireEvent.change(screen.getByLabelText('Número total de cuotas'), {
      target: { value: '120' },
    });
    fireEvent.change(screen.getByLabelText('Tasa nominal anual fija (%)'), {
      target: { value: '8.5' },
    });
    fireEvent.click(screen.getByLabelText('Cuota automática'));

    expect(screen.queryByLabelText('Cuota mensual total, incluido seguro')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('rowheader', { name: 'Cuota mensual automática' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('rowheader', { name: 'Cuota total proyectada inicial' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar préstamo' }));

    await waitFor(() => expect(repository.saveAggregate).toHaveBeenCalledTimes(1));
    expect(vi.mocked(repository.saveAggregate).mock.calls[0]?.[0]?.loan.contract).toMatchObject({
      version: 3,
      paymentMode: 'automatic',
    });
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
    fireEvent.click(screen.getByRole('tab', { name: 'Configuración' }));
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
