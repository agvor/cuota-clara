// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createLoan, Money } from '@cuotaclara/domain';

import { PaymentTools } from './payment-tools.js';

afterEach(cleanup);

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

describe('PaymentTools', () => {
  test('registra un pago manual con principal para el historial', async () => {
    const onSavePayment = vi.fn().mockResolvedValue(undefined);
    render(
      <PaymentTools
        loan={loan}
        payments={[]}
        onSavePayment={onSavePayment}
        onImportPayments={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago manual' }));
    fireEvent.change(screen.getByLabelText('Fecha de pago'), { target: { value: '2026-02-01' } });
    fireEvent.change(screen.getByLabelText('Importe total'), { target: { value: '1000.00' } });
    fireEvent.change(screen.getByLabelText('Principal aplicado'), { target: { value: '50.00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar pago' }));

    await waitFor(() => expect(onSavePayment).toHaveBeenCalledTimes(1));
    expect(onSavePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-02-01',
        principalAmount: expect.objectContaining({ currency: 'CRC' }),
      }),
    );
  });
});
