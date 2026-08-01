import { useState, type ChangeEvent, type FormEvent } from 'react';

import { previewPaymentCsv } from '@cuotaclara/import-csv';
import {
  createBankReset,
  createPaymentRecord,
  reconstructHistoricalState,
  Money,
  type BankReset,
  type HistoricalState,
  type Loan,
  type PaymentRecord,
} from '@cuotaclara/domain';

import { formatMoney } from './money-format.js';

type PaymentToolsProps = Readonly<{
  loan: Loan;
  payments: readonly PaymentRecord[];
  bankReset?: BankReset;
  onSavePayment: (payment: PaymentRecord) => Promise<void>;
  onImportPayments: (payments: readonly PaymentRecord[]) => Promise<void>;
  onSaveBankReset: (bankReset: BankReset | undefined) => Promise<void>;
}>;

export function PaymentTools({
  loan,
  payments,
  bankReset,
  onSavePayment,
  onImportPayments,
  onSaveBankReset,
}: PaymentToolsProps) {
  const [payment, setPayment] = useState<PaymentRecord | undefined>();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvText, setCsvText] = useState<string>();
  const [error, setError] = useState<string>();
  const [isResetOpen, setIsResetOpen] = useState(Boolean(bankReset));
  const preview = csvText
    ? previewPaymentCsv({
        csvText,
        currency: loan.initialBalance.currency,
        format: { delimiter: ';', decimalSeparator: ',', dateFormat: 'dd/mm/yyyy' },
        existingPaymentIds: payments.map((record) => record.id),
      })
    : undefined;

  async function readCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(undefined);
    setCsvText(await file.text());
  }

  return (
    <section className="payment-tools" aria-labelledby="payments-title">
      <header className="task-page-heading">
        <div>
          <p className="eyebrow">Actividad real</p>
          <h2 id="payments-title">Pagos históricos</h2>
          <p>Los pagos reales se guardan separados de las proyecciones.</p>
        </div>
        <button type="button" onClick={() => setPayment(createEmptyPayment(loan))}>
          Registrar pago manual
        </button>
      </header>
      <p className="reconciliation-note">
        El corte proyectado comienza después del último pago histórico. Los meses ausentes se
        señalan durante la importación; si el saldo del banco difiere, deberá registrarse un ajuste
        de reconciliación explícito antes de confiar en la proyección.
      </p>
      {payment ? (
        <PaymentForm
          loan={loan}
          payment={payment}
          onCancel={() => setPayment(undefined)}
          onSave={async (next) => {
            await onSavePayment(next);
            setPayment(undefined);
          }}
        />
      ) : null}
      {payments.length ? (
        <section className="payment-history" aria-labelledby="payment-history-title">
          <div className="section-heading-action">
            <div>
              <h3 id="payment-history-title">Registro de pagos</h3>
              <p>{payments.length} pago(s) guardado(s).</p>
            </div>
          </div>
          <ul className="payment-list" aria-label="Pagos registrados">
            {[...payments]
              .sort((left, right) => right.date.localeCompare(left.date))
              .map((record) => (
                <li key={record.id}>
                  <div>
                    <time dateTime={record.date}>{record.date}</time>
                    <strong>{formatMoney(record.totalAmount, loan.roundingPolicy)}</strong>
                  </div>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setPayment(record)}
                  >
                    Corregir
                  </button>
                </li>
              ))}
            {bankReset?.adjustment ? (
              <li className="reconciliation-history-item">
                <div>
                  <time dateTime={bankReset.adjustment.date}>{bankReset.adjustment.date}</time>
                  <strong>
                    {formatMoney(bankReset.adjustment.principalAmount, loan.roundingPolicy)}
                  </strong>
                  <span>Ajuste de reconciliación al principal</span>
                </div>
              </li>
            ) : null}
          </ul>
        </section>
      ) : (
        <section className="payment-history payment-history-empty" aria-label="Pagos registrados">
          <h3>Registro de pagos</h3>
          <p>No hay pagos registrados.</p>
        </section>
      )}
      <section className="payment-import" aria-labelledby="payment-import-title">
        <div className="section-heading-action">
          <div>
            <h3 id="payment-import-title">Importar CSV</h3>
            <p>Agrega varios pagos después de revisar su previsualización.</p>
          </div>
          <button
            type="button"
            className="secondary-action"
            onClick={() => setIsImportOpen((current) => !current)}
          >
            {isImportOpen ? 'Cerrar importación' : 'Importar CSV'}
          </button>
        </div>
        {isImportOpen ? (
          <>
            <p>
              Formato inicial: encabezados en inglés, punto y coma, importes con coma decimal y
              fechas DD/MM/YYYY.
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="Archivo CSV de pagos"
              onChange={(event) => void readCsv(event)}
            />
            {preview ? (
              <div className="csv-preview" aria-live="polite">
                <p>
                  {preview.validRecords.length} filas válidas; {preview.errors.length} con error.
                </p>
                {preview.missingPeriods.length ? (
                  <p>Meses sin pago detectados: {preview.missingPeriods.join(', ')}.</p>
                ) : null}
                {preview.errors.length ? (
                  <ul>
                    {preview.errors.map((item, index) => (
                      <li key={`${item.rowNumber}-${item.code}-${index}`}>
                        Fila {item.rowNumber ?? '—'}: {item.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>La importación está lista para confirmar.</p>
                )}
                <button
                  type="button"
                  disabled={preview.errors.length > 0 || preview.validRecords.length === 0}
                  onClick={() =>
                    void onImportPayments(preview.validRecords)
                      .then(() => {
                        setCsvText(undefined);
                        setIsImportOpen(false);
                        setIsResetOpen(true);
                      })
                      .catch((cause: unknown) =>
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : 'No se pudo importar el archivo.',
                        ),
                      )
                  }
                >
                  Confirmar importación
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
      <section className="payment-reconciliation" aria-labelledby="payment-reconciliation-title">
        <div className="section-heading-action">
          <div>
            <h3 id="payment-reconciliation-title">Saldo y proyección del banco</h3>
            <p>Compara el historial importado con el saldo principal informado por la entidad.</p>
          </div>
          <button
            type="button"
            className="secondary-action"
            onClick={() => setIsResetOpen((current) => !current)}
          >
            {isResetOpen ? 'Cerrar conciliación' : 'Reconciliar con el banco'}
          </button>
        </div>
        {isResetOpen ? (
          <BankResetForm
            loan={loan}
            payments={payments}
            {...(bankReset ? { bankReset } : {})}
            onSave={onSaveBankReset}
            onError={setError}
          />
        ) : null}
      </section>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

function BankResetForm({
  loan,
  payments,
  bankReset,
  onSave,
  onError,
}: Readonly<{
  loan: Loan;
  payments: readonly PaymentRecord[];
  bankReset?: BankReset;
  onSave: (bankReset: BankReset | undefined) => Promise<void>;
  onError: (error: string | undefined) => void;
}>) {
  const [candidate, setCandidate] = useState<BankReset | undefined>(bankReset);
  const [state, setState] = useState<HistoricalState | undefined>(() =>
    bankReset
      ? reconstructHistoricalState({
          initialBalance: loan.initialBalance,
          payments,
          cutoffDate: bankReset.cutoffDate,
          bankReset,
        })
      : undefined,
  );
  const [acceptAdjustment, setAcceptAdjustment] = useState(Boolean(bankReset?.adjustment));

  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const next = createBankReset({
        id: bankReset?.id ?? crypto.randomUUID(),
        cutoffDate: String(form.get('cutoffDate')),
        reportedBalance: Money.from(
          String(form.get('reportedBalance')),
          loan.initialBalance.currency,
        ),
        bankFinalInstallmentDate: String(form.get('bankFinalInstallmentDate')),
      });
      const nextState = reconstructHistoricalState({
        initialBalance: loan.initialBalance,
        payments,
        cutoffDate: next.cutoffDate,
        bankReset: next,
      });
      setCandidate(next);
      setState(nextState);
      setAcceptAdjustment(Boolean(bankReset?.adjustment));
      onError(undefined);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'No se pudo calcular la conciliación.');
    }
  }

  async function save(): Promise<void> {
    if (!candidate || !state) return;
    try {
      const adjustment =
        acceptAdjustment && state.suggestedPrincipalAdjustment
          ? {
              id: bankReset?.adjustment?.id ?? crypto.randomUUID(),
              date: candidate.cutoffDate,
              principalAmount: state.suggestedPrincipalAdjustment,
              reason: 'Diferencia de principal confirmada durante la reconciliación bancaria.',
            }
          : undefined;
      await onSave(createBankReset({ ...candidate, ...(adjustment ? { adjustment } : {}) }));
      onError(undefined);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'No se pudo guardar el reset bancario.');
    }
  }

  return (
    <div className="bank-reset-form">
      <form className="payment-form" onSubmit={calculate}>
        <label>
          Saldo principal reportado por el banco
          <input
            required
            name="reportedBalance"
            inputMode="decimal"
            defaultValue={bankReset?.reportedBalance.toDecimalString() ?? ''}
          />
        </label>
        <label>
          Fecha de corte del saldo
          <input
            required
            name="cutoffDate"
            type="date"
            defaultValue={bankReset?.cutoffDate ?? ''}
          />
        </label>
        <label>
          Fecha de última cuota proyectada por el banco
          <input
            required
            name="bankFinalInstallmentDate"
            type="date"
            defaultValue={bankReset?.bankFinalInstallmentDate ?? ''}
          />
        </label>
        <div className="form-actions">
          <button type="submit">Calcular discrepancia</button>
          {bankReset ? (
            <button type="button" onClick={() => void onSave(undefined)}>
              Quitar reset
            </button>
          ) : null}
        </div>
      </form>
      {state && candidate ? (
        <div className="reconciliation-result" aria-live="polite">
          <table className="financial-table">
            <tbody>
              <tr>
                <th scope="row">Principal acumulado del historial</th>
                <td>{formatMoney(state.appliedPrincipal, loan.roundingPolicy)}</td>
              </tr>
              <tr>
                <th scope="row">Interés acumulado del historial</th>
                <td>{formatMoney(state.historicalInterest, loan.roundingPolicy)}</td>
              </tr>
              <tr>
                <th scope="row">Saldo reconstruido</th>
                <td>{formatMoney(state.balanceBeforeReconciliation, loan.roundingPolicy)}</td>
              </tr>
              <tr>
                <th scope="row">Saldo principal reportado</th>
                <td>{formatMoney(candidate.reportedBalance, loan.roundingPolicy)}</td>
              </tr>
            </tbody>
          </table>
          {state.suggestedPrincipalAdjustment ? (
            <label className="reconciliation-choice">
              <input
                type="checkbox"
                checked={acceptAdjustment}
                onChange={(event) => setAcceptAdjustment(event.target.checked)}
              />
              Asumir {formatMoney(state.suggestedPrincipalAdjustment, loan.roundingPolicy)} como
              ajuste de reconciliación al principal.
            </label>
          ) : state.balanceBeforeReconciliation.isLessThan(candidate.reportedBalance) ? (
            <p role="status">
              El saldo reportado es mayor. Se guardará como reset, pero no se creará un aporte.
            </p>
          ) : (
            <p role="status">Los saldos coinciden; no se requiere ajuste.</p>
          )}
          <button type="button" onClick={() => void save()}>
            Guardar reset y recalcular proyección
          </button>
        </div>
      ) : null}
    </div>
  );
}

function createEmptyPayment(loan: Loan): PaymentRecord {
  return createPaymentRecord({
    id: crypto.randomUUID(),
    date: loan.startDate,
    totalAmount: Money.from('0', loan.initialBalance.currency),
    principalAmount: Money.from('0', loan.initialBalance.currency),
    source: 'manual',
  });
}

function PaymentForm({
  loan,
  payment,
  onCancel,
  onSave,
}: Readonly<{
  loan: Loan;
  payment: PaymentRecord;
  onCancel: () => void;
  onSave: (payment: PaymentRecord) => Promise<void>;
}>) {
  const [error, setError] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const next = createPaymentRecord({
        id: payment.id,
        date: String(form.get('date')),
        totalAmount: Money.from(String(form.get('totalAmount')), loan.initialBalance.currency),
        principalAmount: Money.from(
          String(form.get('principalAmount')),
          loan.initialBalance.currency,
        ),
        source: payment.source,
        ...(payment.sourceReference ? { sourceReference: payment.sourceReference } : {}),
        ...(String(form.get('interestAmount') ?? '')
          ? {
              interestAmount: Money.from(
                String(form.get('interestAmount')),
                loan.initialBalance.currency,
              ),
            }
          : {}),
        ...(String(form.get('notes') ?? '') ? { notes: String(form.get('notes')) } : {}),
      });
      await onSave(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el pago.');
    }
  }
  return (
    <form className="payment-form" onSubmit={(event) => void submit(event)}>
      <h3>{payment.source === 'manual' ? 'Pago manual' : 'Corregir pago'}</h3>
      <label>
        Fecha de pago
        <input required name="date" type="date" defaultValue={payment.date} />
      </label>
      <label>
        Importe total
        <input
          required
          name="totalAmount"
          inputMode="decimal"
          defaultValue={payment.totalAmount.toDecimalString()}
        />
      </label>
      <label>
        Principal aplicado
        <input
          required
          name="principalAmount"
          inputMode="decimal"
          defaultValue={payment.principalAmount?.toDecimalString() ?? ''}
        />
      </label>
      <label>
        Interés (opcional)
        <input
          name="interestAmount"
          inputMode="decimal"
          defaultValue={payment.interestAmount?.toDecimalString() ?? ''}
        />
      </label>
      <label>
        Notas (opcional)
        <input name="notes" defaultValue={payment.notes ?? ''} />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <div className="form-actions">
        <button type="submit">Guardar pago</button>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
