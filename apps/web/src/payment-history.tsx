import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  BankBalanceReconciliation,
  Loan,
  PaymentRecord,
  PaymentSource,
} from '@cuotaclara/domain';

import { formatMoney } from './money-format.js';
import { PaymentForm } from './payment-tools.js';

type PaymentOrder = 'date_desc' | 'date_asc';
type PaymentSourceFilter = 'all' | PaymentSource;

export function PaymentHistoryPage({
  loan,
  payments,
  balanceReconciliations = [],
  onBack,
  onSavePayment,
  onDeletePayments,
}: Readonly<{
  loan: Loan;
  payments: readonly PaymentRecord[];
  balanceReconciliations?: readonly BankBalanceReconciliation[];
  onBack: () => void;
  onSavePayment: (payment: PaymentRecord) => Promise<void>;
  onDeletePayments: (paymentIds: readonly string[]) => Promise<void>;
}>) {
  const [source, setSource] = useState<PaymentSourceFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [order, setOrder] = useState<PaymentOrder>('date_desc');
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [editingPayment, setEditingPayment] = useState<PaymentRecord>();
  const [pendingDeletion, setPendingDeletion] = useState<readonly string[]>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const deletionTrigger = useRef<HTMLButtonElement | null>(null);

  const visiblePayments = useMemo(
    () =>
      [...payments]
        .filter((payment) => source === 'all' || payment.source === source)
        .filter((payment) => !dateFrom || payment.date >= dateFrom)
        .filter((payment) => !dateTo || payment.date <= dateTo)
        .sort((left, right) =>
          order === 'date_desc'
            ? right.date.localeCompare(left.date)
            : left.date.localeCompare(right.date),
        ),
    [dateFrom, dateTo, order, payments, source],
  );
  const visibleIds = visiblePayments.map((payment) => payment.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const adjustments = balanceReconciliations.flatMap((reconciliation) =>
    reconciliation.adjustment ? [reconciliation.adjustment] : [],
  );

  useEffect(() => {
    const availableIds = new Set(payments.map((payment) => payment.id));
    setSelectedIds((current) => new Set([...current].filter((id) => availableIds.has(id))));
  }, [payments]);

  function togglePayment(paymentId: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(paymentId);
      else next.delete(paymentId);
      return next;
    });
  }

  function toggleVisible(selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of visibleIds) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function requestDeletion(ids: readonly string[], trigger: HTMLButtonElement) {
    if (!ids.length) return;
    deletionTrigger.current = trigger;
    setError(undefined);
    setPendingDeletion(ids);
  }

  function closeDeletion() {
    setPendingDeletion(undefined);
    requestAnimationFrame(() => deletionTrigger.current?.focus());
  }

  async function confirmDeletion() {
    if (!pendingDeletion?.length) return;
    const count = pendingDeletion.length;
    try {
      await onDeletePayments(pendingDeletion);
      setSelectedIds(new Set());
      setMessage(`Se eliminaron ${count} ${count === 1 ? 'pago' : 'pagos'}.`);
      setError(undefined);
      closeDeletion();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron eliminar los pagos.');
      closeDeletion();
    }
  }

  return (
    <section className="payment-history-page" aria-labelledby="payment-history-page-title">
      <button className="back-link" type="button" onClick={onBack}>
        ← Volver a Pagos
      </button>
      <header className="task-page-heading">
        <div>
          <p className="eyebrow">Actividad real</p>
          <h2 id="payment-history-page-title">Pagos registrados</h2>
          <p>Consulta, corrige o administra en grupo el historial de este préstamo.</p>
        </div>
        <strong className="payment-history-count">
          {paymentCountLabel(payments.length, 'registrado', 'registrados')}
        </strong>
      </header>

      {message ? (
        <p role="status" aria-label="Resultado de gestión" className="success-message">
          {message}
        </p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}

      {editingPayment ? (
        <PaymentForm
          loan={loan}
          payment={editingPayment}
          onCancel={() => setEditingPayment(undefined)}
          onSave={async (payment) => {
            await onSavePayment(payment);
            setEditingPayment(undefined);
            setMessage('El pago se actualizó correctamente.');
          }}
        />
      ) : null}

      {payments.length ? (
        <>
          <section className="payment-history-filters" aria-labelledby="payment-filters-title">
            <div className="section-heading-action">
              <div>
                <h3 id="payment-filters-title">Buscar y ordenar</h3>
                <p>Acota el registro sin modificar los pagos guardados.</p>
              </div>
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setSource('all');
                  setDateFrom('');
                  setDateTo('');
                  setOrder('date_desc');
                }}
              >
                Limpiar filtros
              </button>
            </div>
            <div className="payment-filter-grid">
              <label>
                Origen
                <select
                  value={source}
                  onChange={(event) => setSource(event.target.value as PaymentSourceFilter)}
                >
                  <option value="all">Todos</option>
                  <option value="manual">Manual</option>
                  <option value="csv_import">CSV importado</option>
                </select>
              </label>
              <label>
                Desde
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
              <label>
                Orden
                <select
                  value={order}
                  onChange={(event) => setOrder(event.target.value as PaymentOrder)}
                >
                  <option value="date_desc">Más recientes primero</option>
                  <option value="date_asc">Más antiguos primero</option>
                </select>
              </label>
            </div>
          </section>

          <section className="payment-selection-tools" aria-labelledby="payment-selection-title">
            <div>
              <h3 id="payment-selection-title">Selección</h3>
              <p role="status" aria-label="Estado de selección">
                {selectedIds.size === 0
                  ? 'Ningún pago seleccionado.'
                  : paymentCountLabel(selectedIds.size, 'seleccionado', 'seleccionados') + '.'}
              </p>
            </div>
            <div className="payment-selection-actions">
              <label className="select-visible-control">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos los pagos visibles"
                  checked={allVisibleSelected}
                  onChange={(event) => toggleVisible(event.target.checked)}
                />
                Todos los visibles ({visiblePayments.length})
              </label>
              <button
                type="button"
                className="secondary-action"
                disabled={selectedIds.size === payments.length}
                onClick={() => setSelectedIds(new Set(payments.map((payment) => payment.id)))}
              >
                Seleccionar todos los pagos
              </button>
              <button
                type="button"
                className="secondary-action"
                disabled={selectedIds.size === 0}
                onClick={() => setSelectedIds(new Set())}
              >
                Limpiar selección
              </button>
              <button
                type="button"
                className="danger-action"
                disabled={selectedIds.size === 0}
                onClick={(event) =>
                  requestDeletion(
                    payments
                      .filter((payment) => selectedIds.has(payment.id))
                      .map((payment) => payment.id),
                    event.currentTarget,
                  )
                }
              >
                {deleteSelectionLabel(selectedIds.size)}
              </button>
            </div>
          </section>

          {visiblePayments.length ? (
            <div className="payment-history-table-container">
              <table className="payment-history-table" aria-label="Pagos registrados">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="visually-hidden">Selección</span>
                    </th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Importe</th>
                    <th scope="col">Origen</th>
                    <th scope="col">Notas</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePayments.map((payment) => (
                    <tr key={payment.id}>
                      <td data-label="Seleccionar">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar pago del ${payment.date}`}
                          checked={selectedIds.has(payment.id)}
                          onChange={(event) => togglePayment(payment.id, event.target.checked)}
                        />
                      </td>
                      <td data-label="Fecha">
                        <time dateTime={payment.date}>{payment.date}</time>
                      </td>
                      <td data-label="Importe">
                        <strong>{formatMoney(payment.totalAmount, loan.roundingPolicy)}</strong>
                      </td>
                      <td data-label="Origen">{paymentSourceLabel(payment.source)}</td>
                      <td data-label="Notas">{payment.notes ?? '—'}</td>
                      <td data-label="Acciones">
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => setEditingPayment(payment)}
                        >
                          Corregir <span className="visually-hidden">pago del {payment.date}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="payment-history-empty" role="status">
              <h3>No hay pagos que coincidan</h3>
              <p>Prueba otro origen o rango de fechas.</p>
            </div>
          )}

          <section className="payment-delete-all" aria-labelledby="delete-all-payments-title">
            <div>
              <h3 id="delete-all-payments-title">Eliminar todo el registro</h3>
              <p>
                Esta acción selecciona todos los pagos, aunque los filtros actuales los oculten.
              </p>
            </div>
            <button
              type="button"
              className="danger-action"
              onClick={(event) =>
                requestDeletion(
                  payments.map((payment) => payment.id),
                  event.currentTarget,
                )
              }
            >
              Eliminar todos los pagos
            </button>
          </section>
        </>
      ) : (
        <div className="payment-history-empty">
          <h3>Aún no hay pagos registrados</h3>
          <p>Vuelve a Pagos para registrar un movimiento manual o importar un archivo CSV.</p>
          <button type="button" onClick={onBack}>
            Ir a registrar pagos
          </button>
        </div>
      )}

      {adjustments.length ? (
        <section className="reconciliation-adjustments" aria-labelledby="adjustments-title">
          <h3 id="adjustments-title">Ajustes de conciliación</h3>
          <p>Se muestran como referencia y se administran desde Conciliaciones del banco.</p>
          <ul className="payment-list">
            {adjustments.map((adjustment) => (
              <li className="reconciliation-history-item" key={adjustment.id}>
                <div>
                  <time dateTime={adjustment.date}>{adjustment.date}</time>
                  <strong>{formatMoney(adjustment.principalAmount, loan.roundingPolicy)}</strong>
                  <span>{adjustment.reason}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pendingDeletion ? (
        <ConfirmPaymentDeletion
          count={pendingDeletion.length}
          onCancel={closeDeletion}
          onConfirm={() => void confirmDeletion()}
        />
      ) : null}
    </section>
  );
}

function ConfirmPaymentDeletion({
  count,
  onCancel,
  onConfirm,
}: Readonly<{ count: number; onCancel: () => void; onConfirm: () => void }>) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButton.current?.focus();
  }, []);

  return (
    <div className="dialog-backdrop">
      <div
        className="confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-payments-dialog-title"
        aria-describedby="delete-payments-dialog-description"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel();
          if (event.key !== 'Tab') return;
          if (event.shiftKey && document.activeElement === cancelButton.current) {
            event.preventDefault();
            confirmButton.current?.focus();
          } else if (!event.shiftKey && document.activeElement === confirmButton.current) {
            event.preventDefault();
            cancelButton.current?.focus();
          }
        }}
      >
        <h3 id="delete-payments-dialog-title">Confirmar eliminación de pagos</h3>
        <div id="delete-payments-dialog-description">
          <p>
            Se eliminarán {count} {count === 1 ? 'pago' : 'pagos'} de este préstamo. Esta acción no
            se puede deshacer.
          </p>
          <p>
            Cambiarán el saldo reconstruido, los resúmenes, los escenarios y las proyecciones. Las
            conciliaciones y sus ajustes se conservarán; revísalos después de modificar el
            historial.
          </p>
        </div>
        <div className="form-actions">
          <button ref={cancelButton} type="button" className="secondary-action" onClick={onCancel}>
            Cancelar
          </button>
          <button ref={confirmButton} type="button" className="danger-action" onClick={onConfirm}>
            Eliminar {count} {count === 1 ? 'pago' : 'pagos'}
          </button>
        </div>
      </div>
    </div>
  );
}

function paymentCountLabel(count: number, singularSuffix: string, pluralSuffix: string): string {
  return `${count} ${count === 1 ? `pago ${singularSuffix}` : `pagos ${pluralSuffix}`}`;
}

function deleteSelectionLabel(count: number): string {
  return count === 1 ? 'Eliminar 1 pago seleccionado' : `Eliminar ${count} pagos seleccionados`;
}

function paymentSourceLabel(source: PaymentSource): string {
  return source === 'manual' ? 'Manual' : 'CSV importado';
}
