// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  createLoan,
  createLoanV2,
  createLoanV3,
  createPaymentRecord,
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
    deleteLoans: vi.fn(),
  };
}

describe('App', () => {
  test('muestra un estado vacío accesible cuando no hay préstamos', async () => {
    render(<App repository={createRepository([])} />);

    expect(await screen.findByRole('heading', { name: 'Aún no hay préstamos' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeVisible();
    expect(screen.getByText(/Las estimaciones son informativas/)).toBeVisible();
  });

  test('muestra una salida recuperable si la ruta apunta a un préstamo no disponible', async () => {
    window.history.replaceState(null, '', '#/prestamos/no-disponible/summary');
    render(<App repository={createRepository([])} />);

    expect(
      await screen.findByRole('heading', { name: 'No se pudo abrir el préstamo seleccionado' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '← Todos los préstamos' }));
    expect(await screen.findByRole('heading', { name: 'Aún no hay préstamos' })).toBeVisible();
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
    const loanCard = screen.getByRole('button', { name: 'Abrir préstamo Hipoteca principal' });
    loanCard.focus();
    fireEvent.keyDown(loanCard, { key: 'Enter' });
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
    fireEvent.click(screen.getByRole('button', { name: 'Abrir préstamo Préstamo organizado' }));

    expect(screen.getByRole('tablist', { name: 'Secciones del préstamo' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Pagos históricos' })).not.toBeInTheDocument();
    const summaryTab = screen.getByRole('tab', { name: 'Resumen' });
    summaryTab.focus();
    fireEvent.keyDown(summaryTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Pagos' })).toHaveAttribute('aria-selected', 'true');
    expect(window.location.hash).toBe('#/prestamos/loan-workspace/payments');
    expect(await screen.findByRole('heading', { name: 'Pagos históricos' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Ver pagos registrados' }));
    expect(window.location.hash).toBe('#/prestamos/loan-workspace/payments/history');
    expect(screen.getByRole('heading', { name: 'Pagos registrados' })).toBeVisible();
    window.history.pushState(null, '', '#/prestamos/loan-workspace/payments');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(await screen.findByRole('heading', { name: 'Pagos históricos' })).toBeVisible();
    window.history.pushState(null, '', '#/prestamos/loan-workspace/payments/history');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(await screen.findByRole('heading', { name: 'Pagos registrados' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '← Volver a Pagos' }));
    expect(window.location.hash).toBe('#/prestamos/loan-workspace/payments');
    fireEvent.click(screen.getByRole('tab', { name: 'Escenarios' }));
    expect(screen.getByRole('heading', { name: 'Configuración de escenarios' })).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Proyección' }));
    expect(screen.getByRole('heading', { name: 'Evolución del saldo' })).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Configuración' }));
    expect(screen.getByRole('heading', { name: 'Zona de riesgo' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '← Todos los préstamos' }));
    expect(screen.getByRole('heading', { name: 'Tus préstamos' })).toBeVisible();
    expect(window.location.hash).toBe('#/prestamos');
  });

  test('elimina pagos seleccionados en un guardado y conserva las conciliaciones', async () => {
    const loan = createLoan({
      id: 'loan-payment-management',
      name: 'Préstamo con historial',
      startDate: '2026-01-01',
      initialBalance: Money.from('1000.00', 'CRC'),
      ordinaryPayment: Money.from('100.00', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const first = createPaymentRecord({
      id: 'payment-1',
      date: '2026-02-01',
      totalAmount: Money.from('100.00', 'CRC'),
      principalAmount: Money.from('90.00', 'CRC'),
      source: 'manual',
    });
    const second = createPaymentRecord({
      id: 'payment-2',
      date: '2026-03-01',
      totalAmount: Money.from('100.00', 'CRC'),
      principalAmount: Money.from('90.00', 'CRC'),
      source: 'manual',
    });
    const reconciliation = {
      id: 'balance-1',
      reportedAt: '2026-03-01',
      reportedBalance: Money.from('800.00', 'CRC'),
    };
    const aggregate = {
      loan,
      payments: [first, second],
      scenarios: [],
      balanceReconciliations: [reconciliation],
    };
    const repository = createRepository([loan]);
    vi.mocked(repository.loadAggregate).mockResolvedValue(aggregate);
    vi.mocked(repository.saveAggregate).mockResolvedValue(undefined);
    window.history.replaceState(null, '', '#/prestamos/loan-payment-management/payments/history');
    render(<App repository={repository} />);

    expect(await screen.findByRole('heading', { name: 'Pagos registrados' })).toBeVisible();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar pago del 2026-02-01' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar 1 pago seleccionado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar 1 pago' }));

    await waitFor(() => expect(repository.saveAggregate).toHaveBeenCalledOnce());
    expect(repository.saveAggregate).toHaveBeenCalledWith({
      ...aggregate,
      payments: [second],
    });
  });

  test('revalida la importación contra el agregado vigente antes de guardar', async () => {
    const loan = createLoan({
      id: 'loan-revalidate-import',
      name: 'Préstamo con importación concurrente',
      startDate: '2026-01-01',
      initialBalance: Money.from('1000.00', 'CRC'),
      ordinaryPayment: Money.from('100.00', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const paymentStoredAfterPreview = createPaymentRecord({
      id: 'stored-internal-id',
      sourcePaymentId: 'bank-1',
      date: '2026-02-01',
      totalAmount: Money.from('100.00', 'CRC'),
      principalAmount: Money.from('90.00', 'CRC'),
      source: 'csv_import',
    });
    const repository = createRepository([loan]);
    vi.mocked(repository.loadAggregate)
      .mockResolvedValueOnce({ loan, payments: [], scenarios: [] })
      .mockResolvedValueOnce({ loan, payments: [], scenarios: [] })
      .mockResolvedValueOnce({ loan, payments: [paymentStoredAfterPreview], scenarios: [] });
    render(<App repository={repository} />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Abrir préstamo Préstamo con importación concurrente',
      }),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Pagos' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Importar CSV' }));
    const csv = `id;date;total_amount;principal_amount
bank-1;01/02/2026;100,00;90,00
bank-2;01/03/2026;100,00;90,00`;
    fireEvent.change(screen.getByLabelText('Archivo CSV de pagos'), {
      target: { files: [{ text: async () => csv }] },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Importar 2 pagos nuevos' }));

    await waitFor(() => expect(repository.saveAggregate).toHaveBeenCalled());
    const saved = vi.mocked(repository.saveAggregate).mock.calls[0]?.[0];
    expect(saved?.payments).toMatchObject([
      { id: 'stored-internal-id', sourcePaymentId: 'bank-1' },
      { sourcePaymentId: 'bank-2' },
    ]);
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
    fireEvent.click(screen.getByRole('button', { name: 'Abrir préstamo Hipoteca formateada' }));

    expect(
      await screen.findByRole('heading', { name: 'Resumen financiero estimado' }),
    ).toBeVisible();
    expect(screen.getByText('Fecha final vigente')).toBeVisible();
    expect(screen.getByText('Cuotas restantes')).toBeVisible();
    fireEvent.click(screen.getByText('Proyección pendiente'));
    expect(screen.getByRole('rowheader', { name: 'Principal estimado' })).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Interés estimado' })).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Total proyectado' })).toBeVisible();
    fireEvent.click(screen.getByText('Condiciones acordadas'));
    expect(screen.getByText('Cuota mensual acordada')).toBeVisible();
    expect(screen.getByText('2056-01-15')).toBeVisible();
    expect(
      screen.queryByRole('img', { name: 'Evolución estimada del saldo' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Proyección' }));

    expect(screen.getByRole('img', { name: 'Evolución estimada del saldo' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Ver detalle de amortización' }),
    ).not.toBeInTheDocument();
  });

  test('usa la fecha final bancaria reconciliada en el resumen contractual', async () => {
    const loan = createLoanV3({
      id: 'loan-reconciled-summary',
      name: 'Hipoteca reconciliada',
      startDate: '2026-01-15',
      originalPrincipal: Money.from('100000', 'CRC'),
      monthlyTotalPayment: Money.from('1200', 'CRC'),
      monthlyInsurance: Money.from('50', 'CRC'),
      term: { endDate: '2036-01-15' },
      annualNominalRate: '0.08',
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const aggregate = {
      loan,
      payments: [],
      balanceReconciliations: [
        {
          id: 'balance-reconciled',
          reportedAt: '2026-02-15',
          reportedBalance: Money.from('90000', 'CRC'),
        },
      ],
      bankFinalDateReconciliation: { bankFinalInstallmentDate: '2034-01-15' },
      scenarios: [],
    };
    const repository = createRepository([loan]);
    vi.mocked(repository.loadAggregate).mockResolvedValue(aggregate);
    render(<App repository={repository} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Abrir préstamo Hipoteca reconciliada' }),
    );

    const finalDateHighlight = (await screen.findByText('Fecha final vigente')).closest('div');
    expect(finalDateHighlight).toHaveTextContent('2034-01-15');
    expect(finalDateHighlight).not.toHaveTextContent('2036-01-15');
  });

  test('muestra saldo actual, fecha final y cuota en la tarjeta del préstamo', async () => {
    const loan = createLoanV3({
      id: 'loan-portfolio-position',
      name: 'Hipoteca vigente',
      startDate: '2026-01-15',
      originalPrincipal: Money.from('100000', 'CRC'),
      monthlyTotalPayment: Money.from('1200', 'CRC'),
      monthlyInsurance: Money.from('50', 'CRC'),
      term: { endDate: '2036-01-15' },
      annualNominalRate: '0.08',
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const aggregate = {
      loan,
      payments: [],
      balanceReconciliations: [
        {
          id: 'portfolio-balance',
          reportedAt: '2026-02-15',
          reportedBalance: Money.from('90000', 'CRC'),
        },
      ],
      bankFinalDateReconciliation: { bankFinalInstallmentDate: '2034-01-15' },
      scenarios: [],
    };
    const repository = createRepository([loan]);
    vi.mocked(repository.loadAggregate).mockResolvedValue(aggregate);
    render(<App repository={repository} />);

    const card = await screen.findByRole('button', { name: 'Abrir préstamo Hipoteca vigente' });
    expect(within(card).getByText('Saldo actual')).toBeVisible();
    expect(within(card).getByText('Fecha final')).toBeVisible();
    expect(within(card).getByText('Cuota mensual actual')).toBeVisible();
    expect(within(card).getByText('Recalculada al corte')).toBeVisible();
    expect(within(card).getByText('2034-01-15')).toBeVisible();
    expect(
      within(card).getByText((content) => content.replaceAll('\u00a0', ' ') === '₡90 000,00'),
    ).toBeVisible();
    expect(
      within(card).getByText((content) => content.replaceAll('\u00a0', ' ') === '₡1 331,88'),
    ).toBeVisible();
    expect(
      within(card).queryByText((content) => content.replaceAll('\u00a0', ' ') === '₡1 200,00'),
    ).not.toBeInTheDocument();
    card.focus();
    fireEvent.keyDown(card, { key: ' ' });
    expect(await screen.findByRole('tab', { name: 'Resumen' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('explica cuando un pago no permite reconstruir el saldo actual', async () => {
    const loan = createLoanV3({
      id: 'loan-unavailable-balance',
      name: 'Hipoteca sin desglose',
      startDate: '2026-01-15',
      originalPrincipal: Money.from('100000', 'CRC'),
      monthlyTotalPayment: Money.from('1200', 'CRC'),
      monthlyInsurance: Money.from('50', 'CRC'),
      term: { endDate: '2036-01-15' },
      annualNominalRate: '0.08',
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const payment = createPaymentRecord({
      id: 'payment-without-principal',
      date: '2026-02-15',
      totalAmount: Money.from('1200', 'CRC'),
      source: 'manual',
    });
    const repository = createRepository([loan]);
    vi.mocked(repository.loadAggregate).mockResolvedValue({
      loan,
      payments: [payment],
      scenarios: [],
    });
    render(<App repository={repository} />);

    const card = await screen.findByRole('button', {
      name: 'Abrir préstamo Hipoteca sin desglose',
    });
    await waitFor(() => {
      expect(within(card).getByText('Cuota mensual actual')).toBeVisible();
      expect(within(card).getByText('Revisa los datos del préstamo')).toBeVisible();
    });
    fireEvent.click(card);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'no contiene principal para reconstruir el saldo',
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
    fireEvent.click(screen.getByText('Proyección pendiente'));
    expect(screen.getByRole('rowheader', { name: 'Cuota mensual acordada' })).toBeVisible();
    expect(
      screen.getByRole('rowheader', { name: 'Cuota mensual inicial proyectada' }),
    ).toBeVisible();
    expect(
      screen.getByRole('rowheader', { name: 'Diferencia frente a la cuota acordada' }),
    ).toBeVisible();
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
    fireEvent.click(screen.getByText('Proyección pendiente'));
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
    const card = screen.getByRole('button', { name: 'Abrir préstamo Préstamo anterior' });
    expect(within(card).getByText('Cuota registrada')).toBeVisible();
    expect(within(card).getByText('Contrato heredado')).toBeVisible();
    expect(within(card).queryByText('Cuota mensual actual')).not.toBeInTheDocument();
    expect(
      screen.getByText('Préstamo heredado: abre Configuración para completar plazo y seguro'),
    ).toBeVisible();
    fireEvent.click(card);
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
    fireEvent.click(screen.getByRole('button', { name: 'Abrir préstamo Préstamo anterior' }));
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

  test('permite elegir los datos incluidos al duplicar sin reutilizar registros', async () => {
    const loan = createLoan({
      id: 'loan-duplicate',
      name: 'Casa original',
      startDate: '2026-01-01',
      initialBalance: Money.from('1000.00', 'CRC'),
      ordinaryPayment: Money.from('100.00', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const aggregate = {
      loan,
      payments: [
        createPaymentRecord({
          id: 'payment-original',
          date: '2026-02-01',
          totalAmount: Money.from('100.00', 'CRC'),
          principalAmount: Money.from('50.00', 'CRC'),
          source: 'csv_import',
          sourcePaymentId: 'payment-original',
        }),
      ],
      scenarios: [
        {
          id: 'scenario-original',
          loanId: loan.id,
          name: 'Aporte extra',
          configuration: { kind: 'constant_extra' },
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    const repository = createRepository([loan]);
    vi.mocked(repository.loadAggregate).mockResolvedValue(aggregate);
    render(<App repository={repository} />);

    await screen.findByRole('heading', { name: 'Casa original' });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir préstamo Casa original' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Configuración' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar préstamo' }));

    expect(await screen.findByRole('dialog', { name: 'Duplicar préstamo' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Nombre de la copia'), {
      target: { value: 'Casa para comparar' },
    });
    fireEvent.click(screen.getByLabelText('Copiar pagos registrados (1)'));
    fireEvent.click(screen.getByLabelText('Copiar escenarios (1)'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear copia' }));

    await waitFor(() => expect(repository.saveAggregate).toHaveBeenCalledTimes(1));
    const saved = vi.mocked(repository.saveAggregate).mock.calls[0]?.[0];
    expect(saved).toMatchObject({
      loan: { name: 'Casa para comparar' },
      payments: [{ id: expect.any(String) }],
      scenarios: [{ id: expect.any(String) }],
    });
    expect(saved?.loan.id).not.toBe(loan.id);
    expect(saved?.payments[0]?.id).not.toBe('payment-original');
    expect(saved?.scenarios[0]?.id).not.toBe('scenario-original');
    expect(saved?.scenarios[0]?.loanId).toBe(saved?.loan.id);
  });
});
