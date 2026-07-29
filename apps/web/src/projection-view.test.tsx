// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import { createLoan, Money } from '@cuotaclara/domain';

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
    render(<ProjectionView loan={loan} payments={[]} />);

    expect(screen.getByRole('img', { name: 'Evolución estimada del saldo' })).toBeVisible();
    expect(screen.getByLabelText('Rango del gráfico')).toHaveValue('60');
    fireEvent.change(screen.getByLabelText('Rango del gráfico'), { target: { value: 'all' } });
    expect(screen.getByLabelText('Rango del gráfico')).toHaveValue('all');
    expect(screen.getAllByText('Proyección').length).toBeGreaterThan(1);
    expect(
      screen.getByRole('table', { name: 'Historial y proyección de amortización' }),
    ).toBeVisible();
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
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText(/Página 2 de \d+/)).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Saldo final' })).toBeVisible();
  });
});
