import { useState, type ChangeEvent, type FormEvent } from 'react';

import { previewPaymentCsv } from '@cuotaclara/import-csv';
import {
  createBankReset,
  createPaymentRecord,
  reconstructHistoricalState,
  Money,
  type BankBalanceReconciliation,
  type BankFinalDateReconciliation,
  type BankReset,
  type Loan,
  type PaymentRecord,
} from '@cuotaclara/domain';

import { formatMoney } from './money-format.js';

type PaymentToolsProps = Readonly<{
  loan: Loan;
  payments: readonly PaymentRecord[];
  balanceReconciliations?: readonly BankBalanceReconciliation[];
  bankFinalDateReconciliation?: BankFinalDateReconciliation;
  /** Compatibilidad temporal con la pantalla de reset v4. */
  bankReset?: BankReset;
  onSavePayment: (payment: PaymentRecord) => Promise<void>;
  onImportPayments: (payments: readonly PaymentRecord[]) => Promise<void>;
  onSaveBalanceReconciliation?: (reconciliation: BankBalanceReconciliation) => Promise<void>;
  onDeleteBalanceReconciliation?: (reconciliationId: string) => Promise<void>;
  onSaveBankFinalDateReconciliation?: (
    reconciliation: BankFinalDateReconciliation,
  ) => Promise<void>;
  onDeleteBankFinalDateReconciliation?: () => Promise<void>;
  onSaveBankReset?: (bankReset: BankReset | undefined) => Promise<void>;
}>;

export function PaymentTools({
  loan,
  payments,
  balanceReconciliations = [],
  bankFinalDateReconciliation,
  bankReset,
  onSavePayment,
  onImportPayments,
  onSaveBalanceReconciliation = async () => undefined,
  onDeleteBalanceReconciliation = async () => undefined,
  onSaveBankFinalDateReconciliation = async () => undefined,
  onDeleteBankFinalDateReconciliation = async () => undefined,
}: PaymentToolsProps) {
  const [payment, setPayment] = useState<PaymentRecord | undefined>();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvText, setCsvText] = useState<string>();
  const [error, setError] = useState<string>();
  const [isResetOpen, setIsResetOpen] = useState(
    Boolean(balanceReconciliations.length || bankFinalDateReconciliation || bankReset),
  );
  const preview = csvText
    ? previewPaymentCsv({
        csvText,
        currency: loan.initialBalance.currency,
        format: { delimiter: ';', decimalSeparator: ',', dateFormat: 'dd/mm/yyyy' },
        existingPayments: payments,
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
            {balanceReconciliations.flatMap((reconciliation) =>
              reconciliation.adjustment
                ? [
                    <li
                      className="reconciliation-history-item"
                      key={`adjustment-${reconciliation.id}`}
                    >
                      <div>
                        <time dateTime={reconciliation.adjustment.date}>
                          {reconciliation.adjustment.date}
                        </time>
                        <strong>
                          {formatMoney(
                            reconciliation.adjustment.principalAmount,
                            loan.roundingPolicy,
                          )}
                        </strong>
                        <span>Ajuste de reconciliación al principal</span>
                      </div>
                    </li>,
                  ]
                : [],
            )}
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
            <h3 id="payment-reconciliation-title">Conciliaciones del banco</h3>
            <p>Registra saldos con su fecha reportada y, de forma independiente, la fecha final.</p>
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
          <BankReconciliationTools
            loan={loan}
            payments={payments}
            balanceReconciliations={
              balanceReconciliations.length
                ? balanceReconciliations
                : bankReset
                  ? [
                      {
                        id: bankReset.id,
                        reportedAt: bankReset.cutoffDate,
                        reportedBalance: bankReset.reportedBalance,
                        ...(bankReset.adjustment ? { adjustment: bankReset.adjustment } : {}),
                      },
                    ]
                  : []
            }
            {...(bankFinalDateReconciliation ? { bankFinalDateReconciliation } : {})}
            onSaveBalanceReconciliation={onSaveBalanceReconciliation}
            onDeleteBalanceReconciliation={onDeleteBalanceReconciliation}
            onSaveBankFinalDateReconciliation={onSaveBankFinalDateReconciliation}
            onDeleteBankFinalDateReconciliation={onDeleteBankFinalDateReconciliation}
            onError={setError}
          />
        ) : null}
      </section>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

function BankReconciliationTools({
  loan,
  payments,
  balanceReconciliations,
  bankFinalDateReconciliation,
  onSaveBalanceReconciliation,
  onDeleteBalanceReconciliation,
  onSaveBankFinalDateReconciliation,
  onDeleteBankFinalDateReconciliation,
  onError,
}: Readonly<{
  loan: Loan;
  payments: readonly PaymentRecord[];
  balanceReconciliations: readonly BankBalanceReconciliation[];
  bankFinalDateReconciliation?: BankFinalDateReconciliation;
  onSaveBalanceReconciliation: (reconciliation: BankBalanceReconciliation) => Promise<void>;
  onDeleteBalanceReconciliation: (reconciliationId: string) => Promise<void>;
  onSaveBankFinalDateReconciliation: (reconciliation: BankFinalDateReconciliation) => Promise<void>;
  onDeleteBankFinalDateReconciliation: () => Promise<void>;
  onError: (error: string | undefined) => void;
}>) {
  const [editingBalance, setEditingBalance] = useState<BankBalanceReconciliation>();
  return (
    <div className="bank-reset-form">
      <BalanceReconciliationForm
        key={editingBalance?.id ?? balanceReconciliations.map((item) => item.id).join(',')}
        loan={loan}
        payments={payments}
        {...(editingBalance ? { existing: editingBalance } : {})}
        onSave={onSaveBalanceReconciliation}
        onDone={() => setEditingBalance(undefined)}
        onError={onError}
      />
      {balanceReconciliations.length ? (
        <ul className="payment-list" aria-label="Saldos conciliados">
          {[...balanceReconciliations]
            .sort((left, right) => right.reportedAt.localeCompare(left.reportedAt))
            .map((item) => (
              <li key={item.id}>
                <div>
                  <time dateTime={item.reportedAt}>{item.reportedAt}</time>
                  <strong>{formatMoney(item.reportedBalance, loan.roundingPolicy)}</strong>
                  <span>Saldo reportado por el banco</span>
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setEditingBalance(item)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => void onDeleteBalanceReconciliation(item.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
        </ul>
      ) : null}
      <BankFinalDateForm
        key={bankFinalDateReconciliation?.bankFinalInstallmentDate ?? 'empty'}
        {...(bankFinalDateReconciliation
          ? { value: bankFinalDateReconciliation.bankFinalInstallmentDate }
          : {})}
        onSave={onSaveBankFinalDateReconciliation}
        onDelete={onDeleteBankFinalDateReconciliation}
        onError={onError}
      />
    </div>
  );
}

function BalanceReconciliationForm({
  loan,
  payments,
  existing,
  onSave,
  onDone,
  onError,
}: Readonly<{
  loan: Loan;
  payments: readonly PaymentRecord[];
  existing?: BankBalanceReconciliation;
  onSave: (reconciliation: BankBalanceReconciliation) => Promise<void>;
  onDone: () => void;
  onError: (error: string | undefined) => void;
}>) {
  const [candidate, setCandidate] = useState<BankBalanceReconciliation>();
  const [balanceBefore, setBalanceBefore] = useState<Money>();
  const [acceptAdjustment, setAcceptAdjustment] = useState(false);
  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const reportedAt = String(form.get('reportedAt'));
      const reportedBalance = Money.from(
        String(form.get('reportedBalance')),
        loan.initialBalance.currency,
      );
      createBankReset({
        id: 'balance-validation',
        cutoffDate: reportedAt,
        reportedBalance,
        bankFinalInstallmentDate: '9999-12-31',
      });
      const reconstructed = reconstructHistoricalState({
        initialBalance: loan.initialBalance,
        payments: payments.filter((payment) => payment.date <= reportedAt),
        cutoffDate: reportedAt,
      });
      setCandidate({
        id: existing?.id ?? crypto.randomUUID(),
        reportedAt,
        reportedBalance,
        ...(existing?.adjustment ? { adjustment: existing.adjustment } : {}),
      });
      setBalanceBefore(reconstructed.balanceBeforeReconciliation);
      setAcceptAdjustment(false);
      onError(undefined);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'No se pudo calcular la conciliación.');
    }
  }
  async function save() {
    if (!candidate || !balanceBefore) return;
    const difference = balanceBefore.subtract(candidate.reportedBalance);
    await onSave({
      ...candidate,
      ...(acceptAdjustment && difference.isPositive()
        ? {
            adjustment: {
              id: existing?.adjustment?.id ?? crypto.randomUUID(),
              date: candidate.reportedAt,
              principalAmount: difference,
              reason: 'Diferencia de principal confirmada durante la conciliación bancaria.',
            },
          }
        : {}),
    });
    setCandidate(undefined);
    setBalanceBefore(undefined);
    onDone();
  }
  return (
    <div className="reconciliation-result">
      <h4>{existing ? 'Editar saldo conciliado' : 'Conciliar saldo reportado'}</h4>
      <form className="payment-form" onSubmit={calculate}>
        <label>
          Saldo principal reportado por el banco
          <input
            required
            name="reportedBalance"
            inputMode="decimal"
            defaultValue={existing?.reportedBalance.toDecimalString() ?? ''}
          />
        </label>
        <label>
          Fecha en que el banco reportó ese saldo
          <input required name="reportedAt" type="date" defaultValue={existing?.reportedAt ?? ''} />
        </label>
        <div className="form-actions">
          <button type="submit">Calcular discrepancia</button>
        </div>
      </form>
      {candidate && balanceBefore ? (
        <div aria-live="polite">
          <table className="financial-table">
            <tbody>
              <tr>
                <th scope="row">Saldo reconstruido al corte</th>
                <td>{formatMoney(balanceBefore, loan.roundingPolicy)}</td>
              </tr>
              <tr>
                <th scope="row">Saldo reportado</th>
                <td>{formatMoney(candidate.reportedBalance, loan.roundingPolicy)}</td>
              </tr>
            </tbody>
          </table>
          {balanceBefore.subtract(candidate.reportedBalance).isPositive() ? (
            <label className="reconciliation-choice">
              <input
                type="checkbox"
                checked={acceptAdjustment}
                onChange={(event) => setAcceptAdjustment(event.target.checked)}
              />
              Asumir{' '}
              {formatMoney(balanceBefore.subtract(candidate.reportedBalance), loan.roundingPolicy)}{' '}
              como ajuste al principal.
            </label>
          ) : null}
          <button type="button" onClick={() => void save()}>
            Guardar saldo conciliado
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BankFinalDateForm({
  value,
  onSave,
  onDelete,
  onError,
}: Readonly<{
  value?: string;
  onSave: (reconciliation: BankFinalDateReconciliation) => Promise<void>;
  onDelete: () => Promise<void>;
  onError: (error: string | undefined) => void;
}>) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const bankFinalInstallmentDate = String(
      new FormData(event.currentTarget).get('bankFinalInstallmentDate'),
    );
    try {
      createBankReset({
        id: 'final-date-validation',
        cutoffDate: '1900-01-01',
        reportedBalance: Money.from('0', 'CRC'),
        bankFinalInstallmentDate,
      });
      await onSave({ bankFinalInstallmentDate });
      onError(undefined);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'No se pudo guardar la fecha final.');
    }
  }
  return (
    <div className="reconciliation-result">
      <h4>Fecha final reportada por el banco</h4>
      <form className="payment-form" onSubmit={(event) => void submit(event)}>
        <label>
          Fecha de última cuota proyectada
          <input required name="bankFinalInstallmentDate" type="date" defaultValue={value ?? ''} />
        </label>
        <div className="form-actions">
          <button type="submit">{value ? 'Actualizar fecha final' : 'Guardar fecha final'}</button>
          {value ? (
            <button type="button" className="secondary-action" onClick={() => void onDelete()}>
              Eliminar
            </button>
          ) : null}
        </div>
      </form>
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
