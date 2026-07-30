import { useMemo, useState, type FormEvent } from 'react';

import {
  createLoanV3,
  estimateLoanContract,
  Money,
  type Loan,
  type LoanContractEstimate,
  type PaymentMode,
  type TbpEvolution,
  type VariableRateReviewFrequency,
} from '@cuotaclara/domain';

import { EstimateSummary } from './estimate-summary.js';
import { decimalRateToPercent, percentToDecimal } from './percentage.js';

export type LoanFormProps = Readonly<{
  loan?: Loan;
  onCancel: () => void;
  onSave: (loan: Loan) => Promise<void>;
}>;

type RateScheme = 'fixed' | 'tbp_margin' | 'manual_series';
type TermMode = 'installments' | 'end_date';
type EstimatePreviewState =
  Readonly<{ loan: Loan; estimate: LoanContractEstimate }> | Readonly<{ error: string }>;

type FormValues = Readonly<{
  name: string;
  startDate: string;
  currency: string;
  originalPrincipal: string;
  paymentMode: PaymentMode;
  monthlyTotalPayment: string;
  monthlyInsurance: string;
  termMode: TermMode;
  totalInstallments: string;
  endDate: string;
  annualNominalRate: string;
  rateScheme: RateScheme;
  fixedPeriods: string;
  reviewFrequency: VariableRateReviewFrequency;
  tbpInitialAnnualRate: string;
  marginAnnualRate: string;
  evolution: TbpEvolution;
  variationPerReview: string;
  variableRates: string;
}>;

function initialValues(loan: Loan | undefined): FormValues {
  const contract = loan?.contract;
  const termMode: TermMode = contract && 'endDate' in contract.term ? 'end_date' : 'installments';
  const rateScheme: RateScheme = loan?.tbpMarginRatePlan
    ? 'tbp_margin'
    : loan?.variableRatePlan
      ? 'manual_series'
      : 'fixed';
  const tbp = loan?.tbpMarginRatePlan;
  return {
    name: loan?.name ?? '',
    startDate: loan?.startDate ?? '',
    currency: loan?.initialBalance.currency ?? 'CRC',
    originalPrincipal:
      contract?.originalPrincipal.toDecimalString() ?? loan?.initialBalance.toDecimalString() ?? '',
    paymentMode: contract?.version === 3 ? contract.paymentMode : 'configured',
    monthlyTotalPayment:
      contract?.version === 3
        ? contract.monthlyTotalPayment.toDecimalString()
        : contract?.version === 2
          ? contract.monthlyInstallment.add(contract.monthlyInsurance).toDecimalString()
          : (loan?.ordinaryPayment.toDecimalString() ?? ''),
    monthlyInsurance: contract?.monthlyInsurance.toDecimalString() ?? '0',
    termMode,
    totalInstallments:
      contract && 'totalInstallments' in contract.term
        ? String(contract.term.totalInstallments)
        : '',
    endDate: contract && 'endDate' in contract.term ? contract.term.endDate : '',
    annualNominalRate: loan ? decimalRateToPercent(loan.annualNominalRate) : '',
    rateScheme,
    fixedPeriods: String(tbp?.fixedPeriods ?? loan?.variableRatePlan?.fixedPeriods ?? 12),
    reviewFrequency: tbp?.reviewFrequency ?? loan?.variableRatePlan?.reviewFrequency ?? 'annual',
    tbpInitialAnnualRate: decimalRateToPercent(tbp?.tbpInitialAnnualRate ?? '0.05'),
    marginAnnualRate: decimalRateToPercent(tbp?.marginAnnualRate ?? '0.02'),
    evolution: tbp?.evolution ?? 'estable',
    variationPerReview: decimalRateToPercent(tbp?.variationPerReview ?? '0'),
    variableRates:
      loan?.variableRatePlan?.variableRates
        .map((rate) => `${rate.effectiveDate},${decimalRateToPercent(rate.annualNominalRate)}`)
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
      return { effectiveDate, annualNominalRate: percentToDecimal(annualNominalRate) };
    });
}

function createConfiguredLoan(values: FormValues, id: string): Loan {
  const monthlyInsurance = Money.from(values.monthlyInsurance, values.currency);
  const createWithPayment = (monthlyTotalPayment: Money) =>
    createLoanV3({
      id,
      name: values.name,
      startDate: values.startDate,
      originalPrincipal: Money.from(values.originalPrincipal, values.currency),
      monthlyTotalPayment,
      monthlyInsurance,
      paymentMode: values.paymentMode,
      term:
        values.termMode === 'installments'
          ? { totalInstallments: Number(values.totalInstallments) }
          : { endDate: values.endDate },
      annualNominalRate: percentToDecimal(values.annualNominalRate),
      roundingPolicy: { scale: 2, mode: 'half_up' },
      ...(values.rateScheme === 'tbp_margin'
        ? {
            tbpMarginRatePlan: {
              kind: 'tbp_margin_v1' as const,
              fixedPeriods: Number(values.fixedPeriods),
              reviewFrequency: values.reviewFrequency,
              tbpInitialAnnualRate: percentToDecimal(values.tbpInitialAnnualRate),
              marginAnnualRate: percentToDecimal(values.marginAnnualRate),
              evolution: values.evolution,
              variationPerReview: percentToDecimal(values.variationPerReview),
            },
          }
        : {}),
      ...(values.rateScheme === 'manual_series'
        ? {
            variableRatePlan: {
              kind: 'manual_series_v1' as const,
              fixedPeriods: Number(values.fixedPeriods),
              reviewFrequency: values.reviewFrequency,
              variableRates: parseVariableRates(values.variableRates),
            },
          }
        : {}),
    });

  if (values.paymentMode === 'configured') {
    return createWithPayment(Money.from(values.monthlyTotalPayment, values.currency));
  }
  const provisionalLoan = createWithPayment(
    monthlyInsurance.add(Money.from('0.01', values.currency)),
  );
  const automaticPayment = estimateLoanContract(provisionalLoan).automaticTotalPayment;
  if (!automaticPayment) throw new Error('No se pudo calcular la cuota automática.');
  return createWithPayment(automaticPayment);
}

function EstimatePreview({
  estimate,
  loan,
}: Readonly<{ estimate: LoanContractEstimate; loan: Loan }>) {
  return (
    <section className="estimate-preview" aria-live="polite" aria-labelledby="estimate-title">
      <h3 id="estimate-title">Proyección inicial</h3>
      <EstimateSummary loan={loan} estimate={estimate} heading="Resumen financiero estimado" />
    </section>
  );
}

export function LoanForm({ loan, onCancel, onSave }: LoanFormProps) {
  const [values, setValues] = useState(() => initialValues(loan));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const update = <Key extends keyof FormValues>(key: Key, value: FormValues[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const preview: EstimatePreviewState = useMemo(() => {
    try {
      const configuredLoan = createConfiguredLoan(values, loan?.id ?? 'preview');
      return { loan: configuredLoan, estimate: estimateLoanContract(configuredLoan) };
    } catch (cause) {
      return {
        error:
          cause instanceof Error ? cause.message : 'Completa el contrato para ver la proyección.',
      };
    }
  }, [loan?.id, values]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      const configuredLoan = createConfiguredLoan(values, loan?.id ?? crypto.randomUUID());
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
      {loan && !loan.contract ? (
        <p className="inherited-notice" role="status">
          Préstamo heredado: completa plazo y seguro para migrarlo a contrato v3. No se inventarán
          datos.
        </p>
      ) : null}
      {loan?.contract?.version === 2 ? (
        <p className="inherited-notice" role="status">
          Contrato v2 heredado: al guardar se migrará a cuota total, conservando el total efectivo
          actual (cuota base más seguro).
        </p>
      ) : null}
      <form onSubmit={(event) => void submit(event)}>
        <details className="loan-form-section" open>
          <summary>1. Contrato, cuota y plazo</summary>
          <fieldset>
            <legend>Contrato mensual</legend>
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
              Monto original
              <input
                required
                inputMode="decimal"
                value={values.originalPrincipal}
                onChange={(event) => update('originalPrincipal', event.target.value)}
              />
            </label>
            <div className="choice-group" role="radiogroup" aria-label="Modo de cuota mensual">
              <label>
                <input
                  type="radio"
                  name="payment-mode"
                  checked={values.paymentMode === 'configured'}
                  onChange={() => update('paymentMode', 'configured')}
                />{' '}
                Cuota configurada
              </label>
              <label>
                <input
                  type="radio"
                  name="payment-mode"
                  checked={values.paymentMode === 'automatic'}
                  onChange={() => update('paymentMode', 'automatic')}
                />{' '}
                Cuota automática
              </label>
            </div>
            {values.paymentMode === 'configured' ? (
              <label>
                Cuota mensual total, incluido seguro
                <input
                  required
                  inputMode="decimal"
                  value={values.monthlyTotalPayment}
                  onChange={(event) => update('monthlyTotalPayment', event.target.value)}
                />
              </label>
            ) : (
              <p className="field-hint">
                La cuota se calculará con el monto, plazo, seguro y tasas configurados. El resultado
                aparecerá como cuota mensual automática en el resumen.
              </p>
            )}
            <label>
              Seguro mensual, incluido en la cuota total
              <input
                required
                inputMode="decimal"
                value={values.monthlyInsurance}
                onChange={(event) => update('monthlyInsurance', event.target.value)}
              />
            </label>
            <p className="field-hint">
              Periodicidad: mensual (12 pagos por año). Todas las tasas se expresan como porcentaje
              anual; por ejemplo, 8.5 significa 8.5%.
            </p>
            <div className="choice-group" role="radiogroup" aria-label="Definición de plazo">
              <label>
                <input
                  type="radio"
                  name="term"
                  checked={values.termMode === 'installments'}
                  onChange={() => update('termMode', 'installments')}
                />{' '}
                Cantidad total de cuotas
              </label>
              <label>
                <input
                  type="radio"
                  name="term"
                  checked={values.termMode === 'end_date'}
                  onChange={() => update('termMode', 'end_date')}
                />{' '}
                Fecha final
              </label>
            </div>
            {values.termMode === 'installments' ? (
              <label>
                Número total de cuotas
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={values.totalInstallments}
                  onChange={(event) => update('totalInstallments', event.target.value)}
                />
              </label>
            ) : (
              <label>
                Fecha de última cuota
                <input
                  required
                  type="date"
                  value={values.endDate}
                  onChange={(event) => update('endDate', event.target.value)}
                />
              </label>
            )}
          </fieldset>
        </details>
        <details className="loan-form-section">
          <summary>2. Tasas y regla variable</summary>
          <fieldset>
            <legend>Tasa de interés</legend>
            <label>
              Tasa nominal anual fija (%)
              <input
                required
                inputMode="decimal"
                value={values.annualNominalRate}
                onChange={(event) => update('annualNominalRate', event.target.value)}
              />
            </label>
            <div className="choice-group" role="radiogroup" aria-label="Regla de tasa variable">
              <label>
                <input
                  type="radio"
                  name="rate-scheme"
                  checked={values.rateScheme === 'fixed'}
                  onChange={() => update('rateScheme', 'fixed')}
                />{' '}
                Solo tasa fija
              </label>
              <label>
                <input
                  type="radio"
                  name="rate-scheme"
                  checked={values.rateScheme === 'tbp_margin'}
                  onChange={() => update('rateScheme', 'tbp_margin')}
                />{' '}
                TBP + margen (predeterminada)
              </label>
              <label>
                <input
                  type="radio"
                  name="rate-scheme"
                  checked={values.rateScheme === 'manual_series'}
                  onChange={() => update('rateScheme', 'manual_series')}
                />{' '}
                Serie manual heredada
              </label>
            </div>
            {values.rateScheme !== 'fixed' ? (
              <label>
                Cuotas iniciales a tasa fija
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={values.fixedPeriods}
                  onChange={(event) => update('fixedPeriods', event.target.value)}
                />
              </label>
            ) : null}
            {values.rateScheme === 'tbp_margin' ? (
              <TbpFields values={values} update={update} />
            ) : null}
            {values.rateScheme === 'manual_series' ? (
              <ManualRateFields values={values} update={update} />
            ) : null}
          </fieldset>
        </details>
        {'estimate' in preview ? (
          <EstimatePreview estimate={preview.estimate} loan={preview.loan} />
        ) : (
          <p className="field-hint">
            Completa los importes y el plazo para ver la proyección. {preview.error}
          </p>
        )}
        {error ? <p role="alert">{error}</p> : null}
        <div className="form-actions">
          <button type="submit" disabled={saving || !('estimate' in preview)}>
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

function TbpFields({
  values,
  update,
}: Readonly<{
  values: FormValues;
  update: <Key extends keyof FormValues>(key: Key, value: FormValues[Key]) => void;
}>) {
  return (
    <div className="rate-fields">
      <p className="field-hint">Supuesto local reproducible: no se consulta la TBP en internet.</p>
      <label>
        TBP promedio inicial anual (%)
        <input
          required
          inputMode="decimal"
          value={values.tbpInitialAnnualRate}
          onChange={(event) => update('tbpInitialAnnualRate', event.target.value)}
        />
      </label>
      <label>
        Margen anual (%)
        <input
          required
          inputMode="decimal"
          value={values.marginAnnualRate}
          onChange={(event) => update('marginAnnualRate', event.target.value)}
        />
      </label>
      <ReviewFrequency values={values} update={update} />
      <label>
        Evolución de TBP
        <select
          value={values.evolution}
          onChange={(event) => update('evolution', event.target.value as TbpEvolution)}
        >
          <option value="estable">Estable</option>
          <option value="alza_progresiva">Alza progresiva</option>
          <option value="baja_progresiva">Baja progresiva</option>
        </select>
      </label>
      <label>
        Variación por revisión anual (%)
        <input
          required
          inputMode="decimal"
          value={values.variationPerReview}
          onChange={(event) => update('variationPerReview', event.target.value)}
        />
      </label>
    </div>
  );
}

function ManualRateFields({
  values,
  update,
}: Readonly<{
  values: FormValues;
  update: <Key extends keyof FormValues>(key: Key, value: FormValues[Key]) => void;
}>) {
  return (
    <div className="rate-fields">
      <ReviewFrequency values={values} update={update} />
      <label>
        Tasas variables (una por línea: YYYY-MM-DD,8.5)
        <textarea
          required
          value={values.variableRates}
          onChange={(event) => update('variableRates', event.target.value)}
        />
      </label>
    </div>
  );
}

function ReviewFrequency({
  values,
  update,
}: Readonly<{
  values: FormValues;
  update: <Key extends keyof FormValues>(key: Key, value: FormValues[Key]) => void;
}>) {
  return (
    <label>
      Frecuencia de revisión
      <select
        value={values.reviewFrequency}
        onChange={(event) =>
          update('reviewFrequency', event.target.value as VariableRateReviewFrequency)
        }
      >
        <option value="monthly">Mensual</option>
        <option value="quarterly">Trimestral</option>
        <option value="semiannual">Semestral</option>
        <option value="annual">Anual</option>
      </select>
    </label>
  );
}
