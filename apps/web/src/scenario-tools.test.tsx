// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createLoan, Money } from '@cuotaclara/domain';

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
});
