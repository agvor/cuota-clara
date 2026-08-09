import { useEffect, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';

import { createBackup, parseBackup } from '@cuotaclara/backup';
import type { Loan, LoanAggregate, LoanRepository } from '@cuotaclara/domain';

type ParsedBackup = Readonly<{ createdAt: string; aggregates: readonly LoanAggregate[] }>;

export function defaultBackupFilename(now = new Date()): string {
  return `cuotaclara-respaldo-${now.toISOString().replaceAll(':', '-').replace('.', '-')}.json`;
}

function normalizeBackupFilename(value: string): string {
  const name = value.trim().replace(/[\\/:*?"<>|]/g, '-');
  return name.endsWith('.json') ? name : `${name}.json`;
}

export function BackupTools({
  repository,
  onRestored,
  refreshToken = 0,
}: Readonly<{
  repository: LoanRepository;
  onRestored: () => Promise<void>;
  refreshToken?: number;
}>) {
  const [loans, setLoans] = useState<readonly Loan[]>([]);
  const [selectedBackupIds, setSelectedBackupIds] = useState<ReadonlySet<string>>(new Set());
  const [backupName, setBackupName] = useState(() => defaultBackupFilename());
  const [pendingRestore, setPendingRestore] = useState<ParsedBackup>();
  const [selectedRestoreIds, setSelectedRestoreIds] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void repository
      .listLoans()
      .then((items) => {
        if (!active) return;
        setLoans(items);
        setSelectedBackupIds((current) =>
          current.size
            ? new Set([...current].filter((id) => items.some((loan) => loan.id === id)))
            : new Set(items.map((loan) => loan.id)),
        );
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los préstamos.');
      });
    return () => {
      active = false;
    };
  }, [refreshToken, repository]);

  const selectedBackupLoans = loans.filter((loan) => selectedBackupIds.has(loan.id));
  const selectedRestoreAggregates =
    pendingRestore?.aggregates.filter((aggregate) => selectedRestoreIds.has(aggregate.loan.id)) ??
    [];

  function toggleSelection(
    id: string,
    selected: boolean,
    setSelection: Dispatch<SetStateAction<ReadonlySet<string>>>,
  ) {
    setSelection((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function downloadBackup() {
    if (!backupName.trim()) {
      setError('Indica un nombre para el respaldo.');
      return;
    }
    try {
      const aggregates = (
        await Promise.all(selectedBackupLoans.map((loan) => repository.loadAggregate(loan.id)))
      ).filter((item): item is LoanAggregate => Boolean(item));
      const blob = new Blob([JSON.stringify(createBackup(aggregates), null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = normalizeBackupFilename(backupName);
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`Se preparó una copia con ${aggregates.length} préstamo(s).`);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear la copia.');
    }
  }

  async function selectRestoreFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      setPendingRestore(backup);
      setSelectedRestoreIds(new Set(backup.aggregates.map((aggregate) => aggregate.loan.id)));
      setMessage(`El respaldo contiene ${backup.aggregates.length} préstamo(s) válidos.`);
      setError(undefined);
    } catch (cause) {
      setPendingRestore(undefined);
      setSelectedRestoreIds(new Set());
      setError(cause instanceof Error ? cause.message : 'No se pudo leer el respaldo.');
    } finally {
      event.target.value = '';
    }
  }

  async function restoreSelected() {
    if (!pendingRestore) return;
    if (
      !window.confirm(
        `¿Restaurar ${selectedRestoreAggregates.length} préstamo(s)? Los préstamos con el mismo identificador serán reemplazados.`,
      )
    )
      return;
    try {
      await Promise.all(
        selectedRestoreAggregates.map((aggregate) => repository.saveAggregate(aggregate)),
      );
      await onRestored();
      setMessage(`Se restauraron ${selectedRestoreAggregates.length} préstamo(s) validados.`);
      setError(undefined);
      setPendingRestore(undefined);
      setSelectedRestoreIds(new Set());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo restaurar la copia.');
    }
  }

  return (
    <section className="backup-tools" aria-labelledby="backup-title">
      <header className="task-page-heading">
        <div>
          <p className="eyebrow">Datos locales</p>
          <h2 id="backup-title">Respaldo local</h2>
          <p>
            Conserva una copia versionada de préstamos, pagos y escenarios en un archivo que tú
            controlas.
          </p>
        </div>
      </header>
      <div className="backup-action-grid">
        <section className="backup-action-card" aria-labelledby="backup-download-title">
          <h3 id="backup-download-title">Descargar una copia</h3>
          <label>
            Nombre del respaldo
            <input value={backupName} onChange={(event) => setBackupName(event.target.value)} />
          </label>
          <BackupSelection
            loans={loans}
            selectedIds={selectedBackupIds}
            title="Créditos incluidos"
            onToggle={(id, selected) => toggleSelection(id, selected, setSelectedBackupIds)}
            onToggleAll={(selected) =>
              setSelectedBackupIds(selected ? new Set(loans.map((loan) => loan.id)) : new Set())
            }
          />
          <button
            type="button"
            onClick={() => void downloadBackup()}
            disabled={selectedBackupLoans.length === 0}
          >
            Descargar respaldo
          </button>
        </section>
        <section className="backup-action-card" aria-labelledby="backup-restore-title">
          <h3 id="backup-restore-title">Restaurar una copia</h3>
          <p>El archivo se valida completo antes de actualizar los datos locales.</p>
          <label className="backup-file-control">
            <span>Seleccionar respaldo</span>
            <input type="file" accept="application/json,.json" onChange={selectRestoreFile} />
          </label>
          {pendingRestore ? (
            <>
              <BackupSelection
                loans={pendingRestore.aggregates.map((aggregate) => aggregate.loan)}
                selectedIds={selectedRestoreIds}
                title="Créditos por restaurar"
                onToggle={(id, selected) => toggleSelection(id, selected, setSelectedRestoreIds)}
                onToggleAll={(selected) =>
                  setSelectedRestoreIds(
                    selected
                      ? new Set(pendingRestore.aggregates.map((aggregate) => aggregate.loan.id))
                      : new Set(),
                  )
                }
              />
              <div className="form-actions">
                <button type="button" onClick={() => setPendingRestore(undefined)}>
                  Cancelar restauración
                </button>
                <button
                  type="button"
                  onClick={() => void restoreSelected()}
                  disabled={selectedRestoreAggregates.length === 0}
                >
                  Restaurar créditos seleccionados
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>
      {message ? <p aria-live="polite">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

function BackupSelection({
  loans,
  selectedIds,
  title,
  onToggle,
  onToggleAll,
}: Readonly<{
  loans: readonly Loan[];
  selectedIds: ReadonlySet<string>;
  title: string;
  onToggle: (id: string, selected: boolean) => void;
  onToggleAll: (selected: boolean) => void;
}>) {
  const allSelected = loans.length > 0 && loans.every((loan) => selectedIds.has(loan.id));
  return (
    <fieldset className="backup-selection">
      <legend>{title}</legend>
      {loans.length ? (
        <>
          <label>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => onToggleAll(event.target.checked)}
            />{' '}
            Seleccionar todos ({loans.length})
          </label>
          {loans.map((loan) => (
            <label key={loan.id}>
              <input
                type="checkbox"
                checked={selectedIds.has(loan.id)}
                onChange={(event) => onToggle(loan.id, event.target.checked)}
              />{' '}
              {loan.name}
            </label>
          ))}
        </>
      ) : (
        <p>No hay créditos disponibles.</p>
      )}
    </fieldset>
  );
}
