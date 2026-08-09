// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createLoan, createPaymentRecord, Money } from '@cuotaclara/domain';
import { mergePaymentImports } from '@cuotaclara/import-csv';

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

function importedPayment(id: string, sourcePaymentId: string, totalAmount = '100.00') {
  return createPaymentRecord({
    id,
    sourcePaymentId,
    date: '2026-02-01',
    totalAmount: Money.from(totalAmount, 'CRC'),
    principalAmount: Money.from('90.00', 'CRC'),
    source: 'csv_import',
  });
}

async function loadCsv(csv: string): Promise<void> {
  fireEvent.change(screen.getByLabelText('Archivo CSV de pagos'), {
    target: { files: [{ text: async () => csv }] },
  });
  await screen.findByRole('list', { name: 'Resumen de la importación' });
}

describe('PaymentTools', () => {
  test('importa las filas nuevas de un archivo mixto y anuncia las omitidas', async () => {
    const existing = importedPayment('stored-1', 'p-001');
    const onImportPayments = vi.fn(async (incoming, decisions) =>
      mergePaymentImports([existing], incoming, decisions),
    );
    render(
      <PaymentTools
        loan={loan}
        payments={[existing]}
        onSavePayment={vi.fn()}
        onImportPayments={onImportPayments}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Importar CSV' }));
    await loadCsv(`id;date;total_amount;principal_amount
p-001;01/02/2026;100,00;90,00
p-002;01/03/2026;100,00;90,00`);

    expect(screen.getByText('1 pago nuevo')).toBeVisible();
    expect(screen.getByText('1 ya registrado')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Importar 1 pago nuevo' }));

    await waitFor(() => expect(onImportPayments).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText('Importación completada: 1 importado, 1 omitido y 0 reemplazados.'),
    ).toBeVisible();
  });

  test('compara y resuelve conflictos y posibles duplicados conservando las decisiones', async () => {
    const existing = importedPayment('stored-1', 'p-001');
    const onImportPayments = vi.fn(async (incoming, decisions) =>
      mergePaymentImports([existing], incoming, decisions),
    );
    render(
      <PaymentTools
        loan={loan}
        payments={[existing]}
        onSavePayment={vi.fn()}
        onImportPayments={onImportPayments}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Importar CSV' }));
    const csv = `id;date;total_amount;principal_amount
p-001;01/02/2026;105,00;90,00
p-002;01/02/2026;100,00;90,00`;
    await loadCsv(csv);

    expect(screen.getByRole('table', { name: 'Comparación del conflicto p-001' })).toBeVisible();
    const confirm = screen.getByRole('button', { name: 'Confirmar importación' });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Reemplazar p-001 con los datos del CSV' }));
    await loadCsv(csv);
    expect(
      screen.getByRole('radio', { name: 'Reemplazar p-001 con los datos del CSV' }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Importar p-002 de todas formas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Importar 1 pago nuevo' }));

    await waitFor(() => expect(onImportPayments).toHaveBeenCalledTimes(1));
    expect(onImportPayments).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        conflicts: { 'p-001': 'replace' },
        possibleDuplicates: { 'p-002': 'import' },
      }),
    );
    expect(
      await screen.findByText('Importación completada: 1 importado, 0 omitidos y 1 reemplazado.'),
    ).toBeVisible();
  });

  test('informa cuando el archivo completo ya fue procesado', async () => {
    const existing = importedPayment('stored-1', 'p-001');
    render(
      <PaymentTools
        loan={loan}
        payments={[existing]}
        onSavePayment={vi.fn()}
        onImportPayments={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Importar CSV' }));
    await loadCsv(`id;date;total_amount;principal_amount
p-001;01/02/2026;100,00;90,00`);

    expect(screen.getByText('Este archivo ya fue procesado; no hay pagos nuevos.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Importar \d+ pago/ })).not.toBeInTheDocument();
  });

  test('conserva la previsualización y muestra un error recuperable si falla la persistencia', async () => {
    const onImportPayments = vi.fn().mockRejectedValue(new Error('IndexedDB no disponible.'));
    render(
      <PaymentTools
        loan={loan}
        payments={[]}
        onSavePayment={vi.fn()}
        onImportPayments={onImportPayments}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Importar CSV' }));
    await loadCsv(`id;date;total_amount;principal_amount
p-001;01/02/2026;100,00;90,00`);
    fireEvent.click(screen.getByRole('button', { name: 'Importar 1 pago nuevo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('IndexedDB no disponible.');
    expect(screen.getByRole('list', { name: 'Resumen de la importación' })).toBeVisible();
  });

  test('registra un pago manual con principal para el historial', async () => {
    const onSavePayment = vi.fn().mockResolvedValue(undefined);
    render(
      <PaymentTools
        loan={loan}
        payments={[]}
        onSavePayment={onSavePayment}
        onImportPayments={vi.fn()}
        onSaveBankReset={vi.fn()}
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

  test('propone y guarda un ajuste de principal al conciliar un saldo bancario menor', async () => {
    const onSaveBalanceReconciliation = vi.fn().mockResolvedValue(undefined);
    const payment = createPaymentRecord({
      id: 'csv-001',
      date: '2026-02-01',
      totalAmount: Money.from('1000.00', 'CRC'),
      interestAmount: Money.from('950.00', 'CRC'),
      principalAmount: Money.from('50.00', 'CRC'),
      source: 'csv_import',
      sourcePaymentId: 'payment-001',
    });
    render(
      <PaymentTools
        loan={loan}
        payments={[payment]}
        onSavePayment={vi.fn()}
        onImportPayments={vi.fn()}
        onSaveBalanceReconciliation={onSaveBalanceReconciliation}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reconciliar con el banco' }));
    fireEvent.change(screen.getByLabelText('Saldo principal reportado por el banco'), {
      target: { value: '99900.00' },
    });
    fireEvent.change(screen.getByLabelText('Fecha en que el banco reportó ese saldo'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Calcular discrepancia' }));

    expect(screen.getByText(/₡50/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar saldo conciliado' }));

    await waitFor(() => expect(onSaveBalanceReconciliation).toHaveBeenCalledTimes(1));
    expect(onSaveBalanceReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({
        reportedBalance: expect.objectContaining({ currency: 'CRC' }),
        adjustment: expect.objectContaining({ principalAmount: expect.objectContaining({}) }),
      }),
    );
  });
});
