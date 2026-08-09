import { useState, type ChangeEvent, type FormEvent } from 'react';

import {
  previewPaymentCsv,
  type PaymentImportDecisions,
  type PaymentImportMatch,
  type PaymentImportMergeResult,
  type PossiblePaymentDuplicate,
} from '@cuotaclara/import-csv';
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
  onImportPayments: (
    payments: readonly PaymentRecord[],
    decisions: PaymentImportDecisions,
  ) => Promise<PaymentImportMergeResult>;
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
  const [importDecisions, setImportDecisions] = useState<PaymentImportDecisions>({});
  const [importSummary, setImportSummary] = useState<string>();
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
  const unresolvedConflicts =
    preview?.classification.conflicts.filter(
      ({ incoming }) => !importDecisions.conflicts?.[paymentDecisionKey(incoming)],
    ) ?? [];
  const unresolvedPossibleDuplicates =
    preview?.classification.possibleDuplicates.filter(
      ({ incoming }) => !importDecisions.possibleDuplicates?.[paymentDecisionKey(incoming)],
    ) ?? [];
  const selectedPossibleImports =
    preview?.classification.possibleDuplicates.filter(
      ({ incoming }) =>
        importDecisions.possibleDuplicates?.[paymentDecisionKey(incoming)] === 'import',
    ).length ?? 0;
  const importCount = (preview?.classification.newRecords.length ?? 0) + selectedPossibleImports;
  const fileAlreadyProcessed = Boolean(
    preview &&
    preview.errors.length === 0 &&
    preview.validRecords.length > 0 &&
    preview.classification.newRecords.length === 0 &&
    preview.classification.alreadyRegistered.length === preview.validRecords.length,
  );
  const canConfirm = Boolean(
    preview &&
    preview.errors.length === 0 &&
    preview.validRecords.length > 0 &&
    unresolvedConflicts.length === 0 &&
    unresolvedPossibleDuplicates.length === 0 &&
    !fileAlreadyProcessed,
  );

  async function readCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(undefined);
    setImportSummary(undefined);
    setCsvText(await file.text());
  }

  function decideConflict(sourcePaymentId: string, decision: 'keep_existing' | 'replace') {
    setImportDecisions((current) => ({
      ...current,
      conflicts: { ...current.conflicts, [sourcePaymentId]: decision },
    }));
  }

  function decidePossibleDuplicate(sourcePaymentId: string, decision: 'omit' | 'import') {
    setImportDecisions((current) => ({
      ...current,
      possibleDuplicates: { ...current.possibleDuplicates, [sourcePaymentId]: decision },
    }));
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
              <div className="csv-preview">
                <ul className="csv-preview-summary" aria-label="Resumen de la importación">
                  <li>
                    {countLabel(
                      preview.classification.newRecords.length,
                      'pago nuevo',
                      'pagos nuevos',
                    )}
                  </li>
                  <li>
                    {countLabel(
                      preview.classification.alreadyRegistered.length,
                      'ya registrado',
                      'ya registrados',
                    )}
                  </li>
                  <li>
                    {countLabel(
                      preview.classification.possibleDuplicates.length,
                      'posible duplicado',
                      'posibles duplicados',
                    )}
                  </li>
                  <li>
                    {countLabel(preview.classification.conflicts.length, 'conflicto', 'conflictos')}
                  </li>
                  <li>{countLabel(preview.errors.length, 'fila inválida', 'filas inválidas')}</li>
                </ul>
                {preview.missingPeriods.length ? (
                  <p>Meses sin pago detectados: {preview.missingPeriods.join(', ')}.</p>
                ) : null}
                {preview.classification.newRecords.length ? (
                  <CsvPaymentGroup
                    id="csv-new-payments"
                    title="Pagos nuevos"
                    records={preview.classification.newRecords}
                    loan={loan}
                  />
                ) : null}
                {preview.classification.alreadyRegistered.length ? (
                  <CsvPaymentGroup
                    id="csv-registered-payments"
                    title="Pagos ya registrados que se omitirán"
                    records={preview.classification.alreadyRegistered.map(
                      ({ incoming }) => incoming,
                    )}
                    loan={loan}
                  />
                ) : null}
                {preview.errors.length ? (
                  <section aria-labelledby="csv-invalid-title">
                    <h4 id="csv-invalid-title">Filas inválidas</h4>
                    <ul>
                      {preview.errors.map((item, index) => (
                        <li key={`${item.rowNumber}-${item.code}-${index}`}>
                          Fila {item.rowNumber ?? '—'}: {item.message}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {preview.classification.conflicts.map((conflict) => (
                  <CsvConflictResolution
                    key={conflict.incoming.id}
                    conflict={conflict}
                    loan={loan}
                    decision={importDecisions.conflicts?.[paymentDecisionKey(conflict.incoming)]}
                    onDecision={decideConflict}
                  />
                ))}
                {preview.classification.possibleDuplicates.map((possible) => (
                  <CsvPossibleDuplicateResolution
                    key={possible.incoming.id}
                    possible={possible}
                    loan={loan}
                    decision={
                      importDecisions.possibleDuplicates?.[paymentDecisionKey(possible.incoming)]
                    }
                    onDecision={decidePossibleDuplicate}
                  />
                ))}
                {fileAlreadyProcessed ? (
                  <p role="status">Este archivo ya fue procesado; no hay pagos nuevos.</p>
                ) : (
                  <button
                    type="button"
                    disabled={!canConfirm}
                    onClick={() =>
                      void onImportPayments(preview.validRecords, importDecisions)
                        .then((result) => {
                          setImportSummary(importResultMessage(result));
                          setCsvText(undefined);
                          setImportDecisions({});
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
                    {importCount > 0
                      ? `Importar ${importCount} ${importCount === 1 ? 'pago nuevo' : 'pagos nuevos'}`
                      : 'Confirmar importación'}
                  </button>
                )}
              </div>
            ) : null}
          </>
        ) : null}
        {importSummary ? <p role="status">{importSummary}</p> : null}
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

function CsvPaymentGroup({
  id,
  title,
  records,
  loan,
}: Readonly<{
  id: string;
  title: string;
  records: readonly PaymentRecord[];
  loan: Loan;
}>) {
  return (
    <section aria-labelledby={id}>
      <h4 id={id}>
        {title} ({records.length})
      </h4>
      <ul>
        {records.map((record) => (
          <li key={record.id}>{paymentImportLabel(record, loan)}</li>
        ))}
      </ul>
    </section>
  );
}

function CsvConflictResolution({
  conflict,
  loan,
  decision,
  onDecision,
}: Readonly<{
  conflict: PaymentImportMatch;
  loan: Loan;
  decision: 'keep_existing' | 'replace' | undefined;
  onDecision: (sourcePaymentId: string, decision: 'keep_existing' | 'replace') => void;
}>) {
  const sourcePaymentId = paymentDecisionKey(conflict.incoming);
  const comparison = paymentComparison(conflict.existing, conflict.incoming, loan);
  return (
    <fieldset className="csv-resolution">
      <legend>Conflicto {sourcePaymentId}</legend>
      <div className="table-scroll">
        <table className="financial-table">
          <caption>Comparación del conflicto {sourcePaymentId}</caption>
          <thead>
            <tr>
              <th scope="col">Campo</th>
              <th scope="col">Registrado</th>
              <th scope="col">CSV</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map(([label, existing, incoming]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{existing}</td>
                <td>{incoming}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label>
        <input
          type="radio"
          name={`conflict-${sourcePaymentId}`}
          checked={decision === 'keep_existing'}
          onChange={() => onDecision(sourcePaymentId, 'keep_existing')}
        />
        Conservar el pago registrado {sourcePaymentId}
      </label>
      <label>
        <input
          type="radio"
          name={`conflict-${sourcePaymentId}`}
          checked={decision === 'replace'}
          onChange={() => onDecision(sourcePaymentId, 'replace')}
        />
        Reemplazar {sourcePaymentId} con los datos del CSV
      </label>
    </fieldset>
  );
}

function CsvPossibleDuplicateResolution({
  possible,
  loan,
  decision,
  onDecision,
}: Readonly<{
  possible: PossiblePaymentDuplicate;
  loan: Loan;
  decision: 'omit' | 'import' | undefined;
  onDecision: (sourcePaymentId: string, decision: 'omit' | 'import') => void;
}>) {
  const sourcePaymentId = paymentDecisionKey(possible.incoming);
  return (
    <fieldset className="csv-resolution">
      <legend>Posible duplicado {sourcePaymentId}</legend>
      <p>{paymentImportLabel(possible.incoming, loan)}</p>
      <p>
        Coincide por fecha e importes con:{' '}
        {possible.matches.map((match) => paymentDecisionKey(match)).join(', ')}.
      </p>
      <label>
        <input
          type="radio"
          name={`possible-${sourcePaymentId}`}
          checked={decision === 'omit'}
          onChange={() => onDecision(sourcePaymentId, 'omit')}
        />
        Omitir {sourcePaymentId}
      </label>
      <label>
        <input
          type="radio"
          name={`possible-${sourcePaymentId}`}
          checked={decision === 'import'}
          onChange={() => onDecision(sourcePaymentId, 'import')}
        />
        Importar {sourcePaymentId} de todas formas
      </label>
    </fieldset>
  );
}

function paymentComparison(
  existing: PaymentRecord,
  incoming: PaymentRecord,
  loan: Loan,
): readonly (readonly [string, string, string])[] {
  const money = (value: PaymentRecord['interestAmount']) =>
    value ? formatMoney(value, loan.roundingPolicy) : '—';
  return [
    ['Fecha', existing.date, incoming.date],
    ['Total', money(existing.totalAmount), money(incoming.totalAmount)],
    ['Interés', money(existing.interestAmount), money(incoming.interestAmount)],
    ['Principal', money(existing.principalAmount), money(incoming.principalAmount)],
    [
      'Principal extraordinario',
      money(existing.extraPrincipalAmount),
      money(incoming.extraPrincipalAmount),
    ],
    ['Seguro', money(existing.insuranceAmount), money(incoming.insuranceAmount)],
    ['Comisión', money(existing.feeAmount), money(incoming.feeAmount)],
    ['Notas', existing.notes?.trim() || '—', incoming.notes?.trim() || '—'],
  ];
}

function paymentDecisionKey(payment: PaymentRecord): string {
  return payment.sourcePaymentId ?? payment.id;
}

function paymentImportLabel(payment: PaymentRecord, loan: Loan): string {
  return `${paymentDecisionKey(payment)} · ${payment.date} · ${formatMoney(
    payment.totalAmount,
    loan.roundingPolicy,
  )}`;
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function importResultMessage(result: PaymentImportMergeResult): string {
  return `Importación completada: ${countLabel(result.imported.length, 'importado')}, ${countLabel(
    result.omitted.length,
    'omitido',
  )} y ${countLabel(result.replaced.length, 'reemplazado')}.`;
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
