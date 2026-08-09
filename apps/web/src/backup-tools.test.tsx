// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createBackup } from '@cuotaclara/backup';
import { createLoan, Money, type LoanAggregate, type LoanRepository } from '@cuotaclara/domain';

import { BackupTools, defaultBackupFilename } from './backup-tools.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function aggregate(id: string, name: string): LoanAggregate {
  return {
    loan: createLoan({
      id,
      name,
      startDate: '2026-01-01',
      initialBalance: Money.from('1000', 'CRC'),
      ordinaryPayment: Money.from('100', 'CRC'),
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      roundingPolicy: { scale: 2, mode: 'half_up' },
    }),
    payments: [],
    scenarios: [],
  };
}

function repositoryFor(aggregates: readonly LoanAggregate[]): LoanRepository {
  return {
    listLoans: vi.fn().mockResolvedValue(aggregates.map((item) => item.loan)),
    loadAggregate: vi
      .fn()
      .mockImplementation(async (id: string) => aggregates.find((item) => item.loan.id === id)),
    saveAggregate: vi.fn(),
    deleteLoan: vi.fn(),
    deleteLoans: vi.fn(),
  };
}

describe('BackupTools', () => {
  test('genera un respaldo solo con los créditos seleccionados y un nombre editable', async () => {
    const first = aggregate('loan-1', 'Casa');
    const second = aggregate('loan-2', 'Auto');
    const repository = repositoryFor([first, second]);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    });
    render(<BackupTools repository={repository} onRestored={vi.fn()} />);

    expect(await screen.findByLabelText('Casa')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Auto'));
    fireEvent.change(screen.getByLabelText('Nombre del respaldo'), {
      target: { value: 'selección agosto' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Descargar respaldo' }));

    expect(await screen.findByText('Se preparó una copia con 1 préstamo(s).')).toBeVisible();
    expect(repository.loadAggregate).toHaveBeenCalledWith('loan-1');
    expect(repository.loadAggregate).not.toHaveBeenCalledWith('loan-2');
    expect(click).toHaveBeenCalledOnce();
  });

  test('valida un archivo y restaura solo los créditos seleccionados', async () => {
    const first = aggregate('loan-1', 'Casa');
    const second = aggregate('loan-2', 'Auto');
    const repository = repositoryFor([]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<BackupTools repository={repository} onRestored={vi.fn()} />);

    const file = new File([JSON.stringify(createBackup([first, second]))], 'respaldo.json', {
      type: 'application/json',
    });
    fireEvent.change(screen.getByLabelText('Seleccionar respaldo'), {
      target: { files: [file] },
    });

    expect(await screen.findByText('El respaldo contiene 2 préstamo(s) válidos.')).toBeVisible();
    const autoSelections = screen.getAllByLabelText('Auto');
    fireEvent.click(autoSelections.at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar créditos seleccionados' }));

    await waitFor(() => expect(repository.saveAggregate).toHaveBeenCalledTimes(1));
    expect(repository.saveAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ loan: expect.objectContaining({ id: 'loan-1' }) }),
    );
  });

  test('agrega un timestamp al nombre de respaldo predeterminado', () => {
    expect(defaultBackupFilename(new Date('2026-08-09T12:34:56.789Z'))).toBe(
      'cuotaclara-respaldo-2026-08-09T12-34-56-789Z.json',
    );
  });
});
