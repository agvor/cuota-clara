// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import {
  createBankReset,
  createLoan,
  createLoanV3,
  createPaymentRecord,
  createRecurringExtraPaymentScenario,
  Money,
} from '@cuotaclara/domain';

import { ProjectionView, type ChartConfiguration } from './projection-view.js';

afterEach(cleanup);

const loan = createLoan({
  id: 'loan-001',
  name: 'Préstamo de referencia',
  startDate: '2026-01-01',
  initialBalance: Money.from('1000.00', 'CRC'),
  ordinaryPayment: Money.from('100.00', 'CRC'),
  annualNominalRate: '0.12',
  periodsPerYear: 12,
  roundingPolicy: { scale: 2, mode: 'half_up' },
});

describe('ProjectionView', () => {
  test('separa historial y proyección con gráfico accesible y rango por fechas', () => {
    const { container } = render(<ProjectionView loan={loan} payments={[]} />);

    expect(screen.getByRole('img', { name: 'Evolución estimada del saldo' })).toBeVisible();
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-02-01');
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-12-01');
    expect(screen.getByText('Mostrando 11 periodos: 2026-02-01 a 2026-12-01.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Restablecer todo el plazo' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-09-01' } });
    expect(screen.getByText('Mostrando 6 periodos: 2026-04-01 a 2026-09-01.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer todo el plazo' }));
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-02-01');
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-12-01');
    expect(screen.getAllByRole('cell', { name: 'Proyección base' }).length).toBeGreaterThan(1);
    expect(
      screen.getByRole('table', {
        name: /Historial y proyección de amortización — Configuración base/,
      }),
    ).toBeVisible();
    expect(screen.getByText(/H: histórico · P: proyección/)).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Principal total' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Principal ordinario' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Principal extraordinario' })).toBeVisible();
    expect(screen.getByText('Ppal. total')).toBeVisible();
    const firstPoint = screen.getAllByLabelText(/^Cuota \d+, \d{4}-\d{2}-\d{2}$/)[0];
    if (!firstPoint) throw new Error('Se esperaba al menos un punto de proyección.');
    fireEvent.pointerEnter(firstPoint);
    expect(screen.getByText(/Cuota 1 · 2026-02-01/)).toBeVisible();
    const paymentSeries = screen.getByLabelText('Cuota total');
    expect(paymentSeries).not.toBeChecked();
    fireEvent.click(paymentSeries);
    expect(paymentSeries).toBeChecked();
    expect(container.querySelector('.chart-signal-line.payment.source-base')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
  });

  test('continúa la proyección contractual después del último pago histórico', () => {
    const contractLoan = createLoanV3({
      id: 'loan-history',
      name: 'Préstamo con historial',
      startDate: '2026-01-01',
      originalPrincipal: Money.from('1000.00', 'CRC'),
      monthlyTotalPayment: Money.from('105.00', 'CRC'),
      monthlyInsurance: Money.from('5.00', 'CRC'),
      term: { totalInstallments: 12 },
      annualNominalRate: '0.12',
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const payment = createPaymentRecord({
      id: 'history-001',
      date: '2026-02-01',
      totalAmount: Money.from('105.00', 'CRC'),
      interestAmount: Money.from('10.00', 'CRC'),
      principalAmount: Money.from('50.00', 'CRC'),
      source: 'csv_import',
    });

    render(<ProjectionView loan={contractLoan} payments={[payment]} />);

    expect(
      screen.getByText(/La proyección inicia después del último pago histórico/),
    ).toBeVisible();
    expect(screen.getAllByText('₡950,00')).toHaveLength(2);
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-02-01');
    expect(
      screen.getAllByRole('cell', { name: 'Proyección base' })[0]?.closest('tr'),
    ).toHaveTextContent('2026-03-01');
    expect(document.querySelector('.chart-history-divider')).toBeVisible();
    expect(screen.getByRole('cell', { name: 'Histórico' }).closest('tr')).toHaveTextContent(
      '₡0,00',
    );
  });

  test('ordena los registros históricos y el ajuste de reconciliación por fecha', () => {
    const contractLoan = createLoanV3({
      id: 'loan-reconciliation-order',
      name: 'Préstamo conciliado',
      startDate: '2026-01-01',
      originalPrincipal: Money.from('1000.00', 'CRC'),
      monthlyTotalPayment: Money.from('105.00', 'CRC'),
      monthlyInsurance: Money.from('5.00', 'CRC'),
      term: { totalInstallments: 12 },
      annualNominalRate: '0.12',
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    const payments = [
      createPaymentRecord({
        id: 'history-march',
        date: '2026-03-01',
        totalAmount: Money.from('105.00', 'CRC'),
        interestAmount: Money.from('10.00', 'CRC'),
        principalAmount: Money.from('50.00', 'CRC'),
        source: 'csv_import',
      }),
      createPaymentRecord({
        id: 'history-february',
        date: '2026-02-01',
        totalAmount: Money.from('105.00', 'CRC'),
        interestAmount: Money.from('10.00', 'CRC'),
        principalAmount: Money.from('50.00', 'CRC'),
        source: 'csv_import',
      }),
    ];
    const bankReset = createBankReset({
      id: 'reset-order',
      cutoffDate: '2026-03-01',
      reportedBalance: Money.from('890.00', 'CRC'),
      bankFinalInstallmentDate: '2026-12-01',
      adjustment: {
        id: 'adjustment-order',
        date: '2026-03-01',
        principalAmount: Money.from('10.00', 'CRC'),
        reason: 'Diferencia confirmada.',
      },
    });

    render(<ProjectionView loan={contractLoan} payments={payments} bankReset={bankReset} />);

    const table = screen.getByRole('table', {
      name: /Historial y proyección de amortización — Configuración base/,
    });
    const tableDates = () =>
      [...table.querySelectorAll('tbody tr')].map((row) => row.children[1]?.textContent ?? '');
    const historicalDates = screen
      .getAllByRole('cell', { name: 'Histórico' })
      .map((cell) => cell.closest('tr')?.children[1]?.textContent);
    expect(historicalDates).toEqual(['2026-02-01', '2026-03-01']);
    expect(tableDates()).toEqual([...tableDates()].sort());
    expect(
      screen.getByRole('cell', { name: 'Ajuste de reconciliación' }).closest('tr'),
    ).toHaveTextContent('2026-03-01');

    fireEvent.click(screen.getByRole('button', { name: /Ordenar cuotas por fecha descendente/ }));

    const reversedHistoricalDates = screen
      .getAllByRole('cell', { name: 'Histórico' })
      .map((cell) => cell.closest('tr')?.children[1]?.textContent);
    expect(reversedHistoricalDates).toEqual(['2026-03-01', '2026-02-01']);
    expect(tableDates()).toEqual(
      [...tableDates()].sort((left, right) => right.localeCompare(left)),
    );
  });

  test('pagina un calendario extenso sin perder cabeceras de tabla', () => {
    const longLoan = createLoan({
      id: 'loan-long',
      name: 'Préstamo extenso',
      startDate: '2026-01-01',
      initialBalance: Money.from('100000.00', 'CRC'),
      ordinaryPayment: Money.from('1100.00', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      roundingPolicy: { scale: 2, mode: 'half_up' },
    });
    render(<ProjectionView loan={longLoan} payments={[]} />);

    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
    const firstProjectedRowBefore = screen
      .getAllByRole('cell', { name: 'Proyección base' })[0]
      ?.closest('tr')?.textContent;
    fireEvent.click(screen.getByRole('button', { name: /Ordenar cuotas por fecha descendente/ }));
    const firstProjectedRowAfter = screen
      .getAllByRole('cell', { name: 'Proyección base' })[0]
      ?.closest('tr')?.textContent;
    expect(firstProjectedRowAfter).not.toBe(firstProjectedRowBefore);
    expect(screen.getByRole('columnheader', { name: /Fecha/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText(/Página 2 de \d+/)).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Saldo final' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Principal extraordinario' })).toBeVisible();
  });

  test('aplica cada señal a base y escenarios, agrupa el detalle y permite fijar un punto', () => {
    const scenarios = [
      createRecurringExtraPaymentScenario({
        id: 'scenario-a',
        loanId: loan.id,
        name: 'Extra mensual',
        createdAt: '2026-01-01T00:00:00.000Z',
        recurringExtraPayment: { kind: 'constant_extra', amount: Money.from('20', 'CRC') },
      }),
      createRecurringExtraPaymentScenario({
        id: 'scenario-b',
        loanId: loan.id,
        name: 'Principal objetivo',
        createdAt: '2026-01-01T00:00:00.000Z',
        recurringExtraPayment: { kind: 'constant_principal', amount: Money.from('125', 'CRC') },
      }),
    ];
    const { container } = render(
      <ProjectionView loan={loan} payments={[]} scenarios={scenarios} />,
    );

    fireEvent.change(screen.getByLabelText('Escenario A'), { target: { value: 'scenario-a' } });
    fireEvent.change(screen.getByLabelText('Escenario B'), { target: { value: 'scenario-b' } });
    expect(screen.getByLabelText('Mostrar en la tabla')).toHaveValue('base');
    fireEvent.change(screen.getByLabelText('Mostrar en la tabla'), {
      target: { value: 'scenario-a' },
    });
    expect(
      screen.getByRole('table', { name: /Historial y proyección de amortización — Extra mensual/ }),
    ).toBeVisible();
    expect(screen.getAllByRole('cell', { name: 'Proyección de escenario' }).length).toBeGreaterThan(
      1,
    );
    expect(
      screen.getAllByRole('row', {
        name: /Proyección de escenario.*₡20,00/,
      }).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('Cuota total'));
    fireEvent.click(screen.getByLabelText('Aporte extraordinario a principal'));

    expect(container.querySelector('.chart-signal-line.payment.source-base')).toBeVisible();
    expect(
      container.querySelector('.chart-signal-line.payment.source-scenario-first'),
    ).toBeVisible();
    expect(
      container.querySelector('.chart-signal-line.payment.source-scenario-second'),
    ).toBeVisible();
    expect(container.querySelector('.chart-signal-line.extra.source-scenario-first')).toBeVisible();
    const firstPoint = screen.getAllByLabelText(/^Cuota \d+, \d{4}-\d{2}-\d{2}$/)[0];
    if (!firstPoint) throw new Error('Se esperaba al menos un punto de proyección.');
    fireEvent.pointerEnter(firstPoint);
    expect(screen.getByRole('columnheader', { name: 'Configuración base' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Extra mensual' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Principal objetivo' })).toBeVisible();
    expect(
      screen.getByRole('row', { name: /Aporte extraordinario a principal.*₡20,00/ }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('img', { name: 'Evolución estimada del saldo' }));
    expect(screen.getByText(/Punto fijado en cuota/)).toBeVisible();
    fireEvent.click(screen.getByRole('img', { name: 'Evolución estimada del saldo' }));
    expect(screen.getByText('Punto móvil: haz clic en el gráfico para fijarlo.')).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Resumen de escenarios comparados' }),
    ).not.toBeInTheDocument();
  });

  test('restaura las selecciones del gráfico después de volver a montarlo', () => {
    const scenario = createRecurringExtraPaymentScenario({
      id: 'scenario-persistent',
      loanId: loan.id,
      name: 'Extra persistente',
      createdAt: '2026-01-01T00:00:00.000Z',
      recurringExtraPayment: { kind: 'constant_extra', amount: Money.from('20', 'CRC') },
    });
    let configuration: ChartConfiguration | undefined;
    const onChartConfigurationChange = (next: ChartConfiguration) => {
      configuration = next;
    };
    const firstRender = render(
      <ProjectionView
        loan={loan}
        payments={[]}
        scenarios={[scenario]}
        onChartConfigurationChange={onChartConfigurationChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Cuota total'));
    fireEvent.change(screen.getByLabelText('Escenario A'), {
      target: { value: scenario.id },
    });
    const firstPoint = screen.getAllByLabelText(/^Cuota \d+, \d{4}-\d{2}-\d{2}$/)[0];
    if (!firstPoint) throw new Error('Se esperaba al menos un punto de proyección.');
    fireEvent.pointerEnter(firstPoint);
    fireEvent.click(screen.getByRole('img', { name: 'Evolución estimada del saldo' }));
    expect(configuration?.lockedPeriodNumber).toBe(1);
    firstRender.unmount();

    render(
      <ProjectionView
        loan={loan}
        payments={[]}
        scenarios={[scenario]}
        {...(configuration ? { chartConfiguration: configuration } : {})}
        onChartConfigurationChange={onChartConfigurationChange}
      />,
    );

    expect(screen.getByLabelText('Cuota total')).toBeChecked();
    expect(screen.getByLabelText('Escenario A')).toHaveValue(scenario.id);
    expect(
      screen.getByText('Punto fijado en cuota 1. Haz clic en el gráfico para liberarlo.'),
    ).toBeVisible();
  });
});
