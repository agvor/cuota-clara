import { useState, type FormEvent } from 'react';

import { createLoan, Money, type Loan } from '@cuotaclara/domain';

export type LoanFormProps = Readonly<{
  loan?: Loan;
  onCancel: () => void;
  onSave: (loan: Loan) => Promise<void>;
}>;

type FormValues = Readonly<{
  name: string;
  startDate: string;
  currency: string;
  initialBalance: string;
  ordinaryPayment: string;
  annualNominalRate: string;
  periodsPerYear: string;
  hasVariableRate: boolean;
  fixedPeriods: string;
  reviewFrequency: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  variableRates: string;
}>;

function initialValues(loan: Loan | undefined): FormValues {
  return {
    name: loan?.name ?? '',
    startDate: loan?.startDate ?? '',
    currency: loan?.initialBalance.currency ?? 'CRC',
    initialBalance: loan ? loan.initialBalance.toDecimalString() : '',
    ordinaryPayment: loan ? loan.ordinaryPayment.toDecimalString() : '',
    annualNominalRate: loan?.annualNominalRate ?? '',
    periodsPerYear: String(loan?.periodsPerYear ?? 12),
    hasVariableRate: Boolean(loan?.variableRatePlan),
    fixedPeriods: String(loan?.variableRatePlan?.fixedPeriods ?? 12),
    reviewFrequency: loan?.variableRatePlan?.reviewFrequency ?? 'annual',
    variableRates:
      loan?.variableRatePlan?.variableRates
        .map((rate) => `${rate.effectiveDate},${rate.annualNominalRate}`)
        .join('\n') ?? '',
  };
}

function parseVariableRates(value: string) {
  return value
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [effectiveDate, annualNominalRate, ...rest] = line
        .split(',')
        .map((part) => part.trim());
      if (!effectiveDate || !annualNominalRate || rest.length > 0)
        throw new Error('Cada tasa variable debe usar fecha,tasa.');
      return { effectiveDate, annualNominalRate };
    });
}

export function LoanForm({ loan, onCancel, onSave }: LoanFormProps) {
  const [values, setValues] = useState(() => initialValues(loan));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const update = <Key extends keyof FormValues>(key: Key, value: FormValues[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      const configuredLoan = createLoan({
        id: loan?.id ?? crypto.randomUUID(),
        name: values.name,
        startDate: values.startDate,
        initialBalance: Money.from(values.initialBalance, values.currency),
        ordinaryPayment: Money.from(values.ordinaryPayment, values.currency),
        annualNominalRate: values.annualNominalRate,
        periodsPerYear: Number(values.periodsPerYear),
        roundingPolicy: { scale: 2, mode: 'half_up' },
        ...(values.hasVariableRate
          ? {
              variableRatePlan: {
                fixedPeriods: Number(values.fixedPeriods),
                reviewFrequency: values.reviewFrequency,
                variableRates: parseVariableRates(values.variableRates),
              },
            }
          : {}),
      });
      setSaving(true);
      await onSave(configuredLoan);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el préstamo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="loan-form" aria-labelledby="loan-form-title">
      <h2 id="loan-form-title">{loan ? 'Editar préstamo' : 'Crear préstamo'}</h2>
      <form onSubmit={(event) => void submit(event)}>
        <label>
          Nombre
          <input
            required
            value={values.name}
            onChange={(event) => update('name', event.target.value)}
          />
        </label>
        <label>
          Fecha de inicio
          <input
            required
            type="date"
            value={values.startDate}
            onChange={(event) => update('startDate', event.target.value)}
          />
        </label>
        <label>
          Moneda
          <input
            required
            pattern="[A-Za-z]{3}"
            value={values.currency}
            onChange={(event) => update('currency', event.target.value.toUpperCase())}
          />
        </label>
        <label>
          Saldo inicial
          <input
            required
            inputMode="decimal"
            value={values.initialBalance}
            onChange={(event) => update('initialBalance', event.target.value)}
          />
        </label>
        <label>
          Cuota ordinaria
          <input
            required
            inputMode="decimal"
            value={values.ordinaryPayment}
            onChange={(event) => update('ordinaryPayment', event.target.value)}
          />
        </label>
        <label>
          Tasa nominal anual (ejemplo: 0.12)
          <input
            required
            inputMode="decimal"
            value={values.annualNominalRate}
            onChange={(event) => update('annualNominalRate', event.target.value)}
          />
        </label>
        <label>
          Pagos por año
          <input
            required
            type="number"
            min="1"
            step="1"
            value={values.periodsPerYear}
            onChange={(event) => update('periodsPerYear', event.target.value)}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={values.hasVariableRate}
            onChange={(event) => update('hasVariableRate', event.target.checked)}
          />{' '}
          Después de una fase fija, usar tasa variable manual
        </label>
        {values.hasVariableRate ? (
          <fieldset>
            <legend>Fase variable</legend>
            <label>
              Periodos a tasa fija
              <input
                required
                type="number"
                min="0"
                step="1"
                value={values.fixedPeriods}
                onChange={(event) => update('fixedPeriods', event.target.value)}
              />
            </label>
            <label>
              Frecuencia de revisión
              <select
                value={values.reviewFrequency}
                onChange={(event) =>
                  update('reviewFrequency', event.target.value as FormValues['reviewFrequency'])
                }
              >
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
                <option value="semiannual">Semestral</option>
                <option value="annual">Anual</option>
              </select>
            </label>
            <label>
              Tasas variables (una por línea: YYYY-MM-DD,0.08)
              <textarea
                required
                value={values.variableRates}
                onChange={(event) => update('variableRates', event.target.value)}
              />
            </label>
          </fieldset>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar préstamo'}
          </button>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
