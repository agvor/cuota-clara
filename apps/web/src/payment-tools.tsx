import { useState, type ChangeEvent, type FormEvent } from 'react';

import { previewPaymentCsv } from '@cuotaclara/import-csv';
import { createPaymentRecord, Money, type Loan, type PaymentRecord } from '@cuotaclara/domain';

type PaymentToolsProps = Readonly<{
  loan: Loan;
  payments: readonly PaymentRecord[];
  onSavePayment: (payment: PaymentRecord) => Promise<void>;
  onImportPayments: (payments: readonly PaymentRecord[]) => Promise<void>;
}>;

export function PaymentTools({
  loan,
  payments,
  onSavePayment,
  onImportPayments,
}: PaymentToolsProps) {
  const [payment, setPayment] = useState<PaymentRecord | undefined>();
  const [csvText, setCsvText] = useState<string>();
  const [error, setError] = useState<string>();
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
      <h2 id="payments-title">Pagos históricos</h2>
      <p>Los pagos reales se guardan separados de las proyecciones.</p>
      <p className="reconciliation-note">
        El corte proyectado comienza después del último pago histórico. Los meses ausentes se
        señalan durante la importación; si el saldo del banco difiere, deberá registrarse un ajuste
        de reconciliación explícito antes de confiar en la proyección.
      </p>
      <button type="button" onClick={() => setPayment(createEmptyPayment(loan))}>
        Registrar pago manual
      </button>
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
        <ul aria-label="Pagos registrados">
          {[...payments]
            .sort((left, right) => right.date.localeCompare(left.date))
            .map((record) => (
              <li key={record.id}>
                <time dateTime={record.date}>{record.date}</time> ·{' '}
                {record.totalAmount.toFixed(loan.roundingPolicy)} {record.totalAmount.currency}
                <button type="button" onClick={() => setPayment(record)}>
                  Corregir
                </button>
              </li>
            ))}
        </ul>
      ) : (
        <p>No hay pagos registrados.</p>
      )}
      <h3>Importar CSV</h3>
      <p>
        Formato inicial: encabezados en inglés, punto y coma, importes con coma decimal y fechas
        DD/MM/YYYY.
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
                .then(() => setCsvText(undefined))
                .catch((cause: unknown) =>
                  setError(
                    cause instanceof Error ? cause.message : 'No se pudo importar el archivo.',
                  ),
                )
            }
          >
            Confirmar importación
          </button>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
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
