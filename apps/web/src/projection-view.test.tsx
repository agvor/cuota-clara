// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import { createLoan, createRecurringExtraPaymentScenario, Money } from '@cuotaclara/domain';

import { ProjectionView } from './projection-view.js';

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
  test('separa historial y proyección con gráfico accesible y rango ajustable', () => {
    const { container } = render(<ProjectionView loan={loan} payments={[]} />);

    expect(screen.getByRole('img', { name: 'Evolución estimada del saldo' })).toBeVisible();
    expect(screen.getByLabelText('Rango del gráfico')).toHaveValue('60');
    fireEvent.change(screen.getByLabelText('Rango del gráfico'), { target: { value: 'all' } });
    expect(screen.getByLabelText('Rango del gráfico')).toHaveValue('all');
    expect(screen.getAllByText('Proyección').length).toBeGreaterThan(1);
    expect(
      screen.getByRole('table', { name: 'Historial y proyección de amortización' }),
    ).toBeVisible();
    const firstPoint = screen.getAllByLabelText(/^Cuota \d+, \d{4}-\d{2}-\d{2}$/)[0];
    if (!firstPoint) throw new Error('Se esperaba al menos un punto de proyección.');
    fireEvent.pointerEnter(firstPoint);
    expect(screen.getByText(/Cuota 1 · 2026-02-01/)).toBeVisible();
    const paymentSeries = screen.getByLabelText('Cuota total proyectada');
    expect(paymentSeries).not.toBeChecked();
    fireEvent.click(paymentSeries);
    expect(paymentSeries).toBeChecked();
    expect(container.querySelector('.chart-series-line.payment')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
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
      .getAllByText('Proyección')[0]
      ?.closest('tr')?.textContent;
    fireEvent.click(screen.getByRole('button', { name: /Ordenar cuotas por fecha descendente/ }));
    const firstProjectedRowAfter = screen.getAllByText('Proyección')[0]?.closest('tr')?.textContent;
    expect(firstProjectedRowAfter).not.toBe(firstProjectedRowBefore);
    expect(screen.getByRole('columnheader', { name: /Fecha/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText(/Página 2 de \d+/)).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Saldo final' })).toBeVisible();
  });

  test('superpone y resume hasta dos escenarios en el gráfico principal', () => {
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

    expect(container.querySelector('.chart-scenario-line.scenario-first')).toBeVisible();
    expect(container.querySelector('.chart-scenario-line.scenario-second')).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Resumen de escenarios comparados' }),
    ).not.toBeInTheDocument();
  });
});
