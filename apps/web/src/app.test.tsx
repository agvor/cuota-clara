// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createLoan, Money, type LoanRepository } from '@cuotaclara/domain';

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

  test('guarda contrato v2, estimación y escenario TBP en un agregado nuevo', async () => {
    const repository = createRepository([]);
    render(<App repository={repository} />);
    await screen.findByRole('heading', { name: 'Aún no hay préstamos' });
    fireEvent.click(screen.getByRole('button', { name: 'Crear préstamo' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Préstamo mixto' } });
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Monto original'), { target: { value: '100000.00' } });
    fireEvent.change(screen.getByLabelText('Cuota mensual, sin seguro'), {
      target: { value: '1100.00' },
    });
    fireEvent.change(screen.getByLabelText('Seguro mensual, separado'), {
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
          contract: expect.objectContaining({ monthlyInsurance: expect.anything() }),
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
});
