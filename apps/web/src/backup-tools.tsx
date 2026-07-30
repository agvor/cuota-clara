import { useState, type ChangeEvent } from 'react';

import { createBackup, parseBackup } from '@cuotaclara/backup';
import type { LoanRepository } from '@cuotaclara/domain';

export function BackupTools({
  repository,
  onRestored,
}: Readonly<{ repository: LoanRepository; onRestored: () => Promise<void> }>) {
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  async function downloadBackup() {
    try {
      const loans = await repository.listLoans();
      const aggregates = (
        await Promise.all(loans.map((loan) => repository.loadAggregate(loan.id)))
      ).filter((item): item is NonNullable<typeof item> => Boolean(item));
      const blob = new Blob([JSON.stringify(createBackup(aggregates), null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cuotaclara-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`Se preparó una copia con ${aggregates.length} préstamo(s).`);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear la copia.');
    }
  }
  async function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      if (
        !window.confirm(
          `¿Restaurar ${backup.aggregates.length} préstamo(s)? Los préstamos con el mismo identificador serán reemplazados.`,
        )
      )
        return;
      await Promise.all(backup.aggregates.map((aggregate) => repository.saveAggregate(aggregate)));
      await onRestored();
      setMessage(`Se restauraron ${backup.aggregates.length} préstamo(s) validados.`);
      setError(undefined);
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
          <p>Genera un archivo JSON para guardar fuera de este dispositivo.</p>
          <button type="button" onClick={() => void downloadBackup()}>
            Descargar respaldo
          </button>
        </section>
        <section className="backup-action-card" aria-labelledby="backup-restore-title">
          <h3 id="backup-restore-title">Restaurar una copia</h3>
          <p>El archivo se valida antes de actualizar los datos locales.</p>
          <label className="backup-file-control">
            <span>Seleccionar respaldo</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void restore(event)}
            />
          </label>
        </section>
      </div>
      {message ? <p aria-live="polite">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
