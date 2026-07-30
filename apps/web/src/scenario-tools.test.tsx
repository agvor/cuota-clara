// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  test('guarda un escenario alternativo para compararlo desde la amortización', async () => {
    const onSaveScenario = vi.fn().mockResolvedValue(undefined);
    render(<ScenarioTools loan={loan} scenarios={[]} onSaveScenario={onSaveScenario} />);
    expect(screen.queryByLabelText('Tipo de escenario')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo escenario' }));
    fireEvent.change(screen.getByLabelText('Fecha del pago extraordinario'), {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByLabelText('Importe adicional al principal'), {
      target: { value: '100.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear escenario' }));

    await waitFor(() => expect(onSaveScenario).toHaveBeenCalledTimes(1));
  });

  test('configura un extraordinario mensual constante', async () => {
    const onSaveScenario = vi.fn().mockResolvedValue(undefined);
    render(<ScenarioTools loan={loan} scenarios={[]} onSaveScenario={onSaveScenario} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo escenario' }));
    fireEvent.change(screen.getByLabelText('Tipo de escenario'), {
      target: { value: 'constant_extra' },
    });
    expect(screen.queryByLabelText('Fecha del pago extraordinario')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Extraordinario mensual'), {
      target: { value: '50.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear escenario' }));

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

  test('permite editar y eliminar escenarios sin mostrar un gráfico duplicado', async () => {
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
    const onSaveScenario = vi.fn().mockResolvedValue(undefined);
    const onDeleteScenario = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <ScenarioTools
        loan={loan}
        scenarios={scenarios}
        onSaveScenario={onSaveScenario}
        onDeleteScenario={onDeleteScenario}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar escenario' })[0]!);
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver resumen' })[0]!);
    expect(screen.getByRole('heading', { name: 'Resumen de Extra A' })).toBeVisible();
    expect(screen.getByText('Interés ahorrado')).toBeVisible();
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar escenario' })[1]!);

    await waitFor(() => expect(onDeleteScenario).toHaveBeenCalledWith('scenario-b'));
    expect(
      screen.queryByRole('img', { name: 'Comparar saldos de escenarios' }),
    ).not.toBeInTheDocument();
  });
});
