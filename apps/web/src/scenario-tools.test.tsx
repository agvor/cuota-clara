// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createLoan, createRecurringExtraPaymentScenario, Money } from '@cuotaclara/domain';

import { ScenarioTools } from './scenario-tools.js';

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

describe('ScenarioTools', () => {
  test('guarda un escenario alternativo y muestra su comparación', async () => {
    const onSaveScenario = vi.fn().mockResolvedValue(undefined);
    render(<ScenarioTools loan={loan} scenarios={[]} onSaveScenario={onSaveScenario} />);
    fireEvent.change(screen.getByLabelText('Fecha del pago extraordinario'), {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByLabelText('Importe adicional al principal'), {
      target: { value: '100.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Comparar y guardar escenario' }));

    await waitFor(() => expect(onSaveScenario).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading', { name: 'Comparación con escenario base' })).toBeVisible();
    expect(screen.getByText('Interés ahorrado')).toBeVisible();
  });

  test('configura un extraordinario mensual constante', async () => {
    const onSaveScenario = vi.fn().mockResolvedValue(undefined);
    render(<ScenarioTools loan={loan} scenarios={[]} onSaveScenario={onSaveScenario} />);
    fireEvent.change(screen.getByLabelText('Tipo de escenario'), {
      target: { value: 'constant_extra' },
    });
    expect(screen.queryByLabelText('Fecha del pago extraordinario')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Extraordinario mensual'), {
      target: { value: '50.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Comparar y guardar escenario' }));

    await waitFor(() => expect(onSaveScenario).toHaveBeenCalledTimes(1));
    expect(onSaveScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: expect.objectContaining({
          kind: 'recurring_extra_payment_v1',
          mode: 'constant_extra',
        }),
      }),
    );
  });

  test('permite seleccionar dos escenarios en el gráfico comparativo', () => {
    const scenarios = [
      createRecurringExtraPaymentScenario({
        id: 'scenario-a',
        loanId: loan.id,
        name: 'Extra A',
        createdAt: '2026-01-01T00:00:00.000Z',
        recurringExtraPayment: { kind: 'constant_extra', amount: Money.from('25', 'CRC') },
      }),
      createRecurringExtraPaymentScenario({
        id: 'scenario-b',
        loanId: loan.id,
        name: 'Principal B',
        createdAt: '2026-01-01T00:00:00.000Z',
        recurringExtraPayment: { kind: 'constant_principal', amount: Money.from('125', 'CRC') },
      }),
    ];
    render(<ScenarioTools loan={loan} scenarios={scenarios} onSaveScenario={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Escenario A'), { target: { value: 'scenario-a' } });
    fireEvent.change(screen.getByLabelText('Escenario B'), { target: { value: 'scenario-b' } });

    expect(screen.getByRole('img', { name: 'Comparar saldos de escenarios' })).toBeVisible();
    const chart = screen.getByRole('heading', {
      name: 'Comparar saldos de escenarios',
    }).parentElement;
    if (!chart) throw new Error('No se encontró el gráfico de escenarios.');
    expect(within(chart).getByText('Extra A', { selector: 'span' })).toBeVisible();
    expect(within(chart).getByText('Principal B', { selector: 'span' })).toBeVisible();
  });
});
