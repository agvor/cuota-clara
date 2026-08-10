// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createLoan, createPaymentRecord, Money } from '@cuotaclara/domain';

import { PaymentHistoryPage } from './payment-history.js';

afterEach(cleanup);

const loan = createLoan({
  id: 'loan-history',
  name: 'Hipoteca principal',
  startDate: '2026-01-01',
  initialBalance: Money.from('100000.00', 'CRC'),
  ordinaryPayment: Money.from('1000.00', 'CRC'),
  annualNominalRate: '0.12',
  periodsPerYear: 12,
  roundingPolicy: { scale: 2, mode: 'half_up' },
});

function payment(id: string, date: string, source: 'manual' | 'csv_import', notes?: string) {
  return createPaymentRecord({
    id,
    date,
    totalAmount: Money.from('1000.00', 'CRC'),
    principalAmount: Money.from('100.00', 'CRC'),
    source,
    ...(source === 'csv_import' ? { sourcePaymentId: `bank-${id}` } : {}),
    ...(notes ? { notes } : {}),
  });
}

const payments = [
  payment('manual-old', '2026-02-01', 'manual', 'Caja'),
  payment('csv-middle', '2026-03-01', 'csv_import'),
  payment('manual-new', '2026-04-01', 'manual'),
];

describe('PaymentHistoryPage', () => {
  test('presenta un registro semántico ordenable y filtrable con corrección', async () => {
    const onSavePayment = vi.fn().mockResolvedValue(undefined);
    render(
      <PaymentHistoryPage
        loan={loan}
        payments={payments}
        onBack={vi.fn()}
        onSavePayment={onSavePayment}
        onDeletePayments={vi.fn()}
      />,
    );

    const table = screen.getByRole('table', { name: 'Pagos registrados' });
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('2026-04-01');
    fireEvent.change(screen.getByLabelText('Origen'), { target: { value: 'csv_import' } });
    expect(within(table).getByText('2026-03-01')).toBeVisible();
    expect(within(table).queryByText('2026-04-01')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Corregir pago del 2026-03-01' }));
    expect(screen.getByRole('heading', { name: 'Corregir pago' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Notas (opcional)'), { target: { value: 'Revisado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar pago' }));
    await waitFor(() => expect(onSavePayment).toHaveBeenCalledOnce());
    expect(onSavePayment).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePaymentId: 'bank-csv-middle', notes: 'Revisado' }),
    );
  });

  test('selecciona resultados visibles y exige confirmación antes de eliminarlos', async () => {
    const onDeletePayments = vi.fn().mockResolvedValue(undefined);
    render(
      <PaymentHistoryPage
        loan={loan}
        payments={payments}
        onBack={vi.fn()}
        onSavePayment={vi.fn()}
        onDeletePayments={onDeletePayments}
      />,
    );

    fireEvent.change(screen.getByLabelText('Origen'), { target: { value: 'manual' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar todos los pagos visibles' }));
    expect(screen.getByRole('status', { name: 'Estado de selección' })).toHaveTextContent(
      '2 pagos seleccionados',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar 2 pagos seleccionados' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Confirmar eliminación de pagos' });
    expect(dialog).toHaveTextContent('Se eliminarán 2 pagos');
    expect(dialog).toHaveTextContent('conciliaciones');
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(onDeletePayments).not.toHaveBeenCalled();
    expect(screen.getByRole('status', { name: 'Estado de selección' })).toHaveTextContent(
      '2 pagos seleccionados',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar 2 pagos seleccionados' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar 2 pagos' }),
    );
    await waitFor(() =>
      expect(onDeletePayments).toHaveBeenCalledWith(['manual-old', 'manual-new']),
    );
    expect(await screen.findByRole('status', { name: 'Resultado de gestión' })).toHaveTextContent(
      'Se eliminaron 2 pagos',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar todos los pagos' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar 3 pagos' }),
    );
    await waitFor(() =>
      expect(onDeletePayments).toHaveBeenLastCalledWith(['manual-old', 'csv-middle', 'manual-new']),
    );
  });

  test('permite seleccionar todos, conserva la selección ante errores y separa los ajustes', async () => {
    const onDeletePayments = vi.fn().mockRejectedValue(new Error('IndexedDB no disponible.'));
    render(
      <PaymentHistoryPage
        loan={loan}
        payments={payments}
        balanceReconciliations={[
          {
            id: 'balance-1',
            reportedAt: '2026-03-01',
            reportedBalance: Money.from('99800.00', 'CRC'),
            adjustment: {
              id: 'adjustment-1',
              date: '2026-03-01',
              principalAmount: Money.from('50.00', 'CRC'),
              reason: 'Diferencia confirmada.',
            },
          },
        ]}
        onBack={vi.fn()}
        onSavePayment={vi.fn()}
        onDeletePayments={onDeletePayments}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Ajustes de conciliación' })).toBeVisible();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar todos los pagos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar 3 pagos seleccionados' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar 3 pagos' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('IndexedDB no disponible.');
    expect(screen.getByRole('status', { name: 'Estado de selección' })).toHaveTextContent(
      '3 pagos seleccionados',
    );
  });
});
