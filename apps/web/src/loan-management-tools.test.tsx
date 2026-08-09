// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createLoan, Money, type LoanRepository } from '@cuotaclara/domain';

import { LoanManagementTools } from './loan-management-tools.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function loan(id: string, name: string) {
  return createLoan({
    id,
    name,
    startDate: '2026-01-01',
    initialBalance: Money.from('1000', 'CRC'),
    ordinaryPayment: Money.from('100', 'CRC'),
    annualNominalRate: '0.12',
    periodsPerYear: 12,
    roundingPolicy: { scale: 2, mode: 'half_up' },
  });
}

function repositoryFor(loans: readonly ReturnType<typeof loan>[]): LoanRepository {
  return {
    listLoans: vi.fn().mockResolvedValue(loans),
    loadAggregate: vi.fn(),
    saveAggregate: vi.fn(),
    deleteLoan: vi.fn(),
    deleteLoans: vi.fn(),
  };
}

describe('LoanManagementTools', () => {
  test('elimina una selección o todos los créditos tras confirmación explícita', async () => {
    const first = loan('loan-1', 'Casa');
    const second = loan('loan-2', 'Auto');
    const repository = repositoryFor([first, second]);
    const onChanged = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<LoanManagementTools repository={repository} onChanged={onChanged} />);

    expect(await screen.findByLabelText('Casa')).not.toBeChecked();
    fireEvent.click(screen.getByLabelText('Casa'));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar créditos seleccionados (1)' }));

    await waitFor(() => expect(repository.deleteLoans).toHaveBeenCalledWith(['loan-1']));
    expect(onChanged).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar todos los créditos (2)' }));
    await waitFor(() =>
      expect(repository.deleteLoans).toHaveBeenLastCalledWith(['loan-1', 'loan-2']),
    );
  });
});
