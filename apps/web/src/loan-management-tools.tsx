import { useEffect, useState } from 'react';

import type { Loan, LoanRepository } from '@cuotaclara/domain';

export function LoanManagementTools({
  repository,
  onChanged,
}: Readonly<{ repository: LoanRepository; onChanged: () => Promise<void> }>) {
  const [loans, setLoans] = useState<readonly Loan[]>([]);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  async function loadLoans() {
    const items = await repository.listLoans();
    setLoans(items);
    setSelectedIds(
      (current) => new Set([...current].filter((id) => items.some((loan) => loan.id === id))),
    );
  }

  useEffect(() => {
    void loadLoans().catch((cause) => {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los créditos.');
    });
  }, [repository]);

  const allSelected = loans.length > 0 && loans.every((loan) => selectedIds.has(loan.id));

  function toggleSelection(id: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function deleteLoans(loanIds: readonly string[]) {
    if (!loanIds.length) return;
    if (
      !window.confirm(
        `¿Eliminar ${loanIds.length} crédito(s) y toda su actividad? Esta acción no se puede deshacer.`,
      )
    )
      return;
    try {
      await repository.deleteLoans(loanIds);
      await loadLoans();
      await onChanged();
      setMessage(`Se eliminaron ${loanIds.length} crédito(s).`);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron eliminar los créditos.');
    }
  }

  return (
    <section className="loan-management-tools" aria-labelledby="loan-management-title">
      <header className="task-page-heading">
        <div>
          <p className="eyebrow">Administración local</p>
          <h2 id="loan-management-title">Gestionar créditos</h2>
          <p>Selecciona uno o varios créditos para eliminarlos junto con sus pagos y escenarios.</p>
        </div>
      </header>
      {loans.length ? (
        <fieldset className="loan-management-selection">
          <legend>Créditos guardados</legend>
          <label>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) =>
                setSelectedIds(
                  event.target.checked ? new Set(loans.map((loan) => loan.id)) : new Set(),
                )
              }
            />{' '}
            Seleccionar todos ({loans.length})
          </label>
          {loans.map((loan) => (
            <div className="loan-management-row" key={loan.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selectedIds.has(loan.id)}
                  onChange={(event) => toggleSelection(loan.id, event.target.checked)}
                />{' '}
                {loan.name}
              </label>
              <button type="button" onClick={() => void deleteLoans([loan.id])}>
                Eliminar
              </button>
            </div>
          ))}
        </fieldset>
      ) : (
        <p>No hay créditos guardados para administrar.</p>
      )}
      <div className="form-actions loan-management-actions">
        <button
          type="button"
          onClick={() => void deleteLoans([...selectedIds])}
          disabled={selectedIds.size === 0}
        >
          Eliminar créditos seleccionados ({selectedIds.size})
        </button>
        <button
          type="button"
          onClick={() => void deleteLoans(loans.map((loan) => loan.id))}
          disabled={loans.length === 0}
        >
          Eliminar todos los créditos ({loans.length})
        </button>
      </div>
      {message ? <p aria-live="polite">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
