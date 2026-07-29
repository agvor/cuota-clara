import { useMemo, useState, type FormEvent } from 'react';

import {
  compareLoanWithOneTimeExtraPayment,
  compareLoanWithRecurringExtraPayment,
  createOneTimeExtraPaymentScenario,
  createRecurringExtraPaymentScenario,
  isOneTimeExtraPaymentScenario,
  isRecurringExtraPaymentScenario,
  Money,
  projectLoanAmortization,
  type FixedRateAmortizationResult,
  type Loan,
  type OneTimeExtraPaymentComparison,
  type ProjectionScenarioSnapshot,
  type RecurringExtraPaymentComparison,
} from '@cuotaclara/domain';

import { formatDecimalMoney, formatMoney } from './money-format.js';

type ScenarioType = 'one_time' | 'constant_extra' | 'constant_principal';
type ScenarioComparison = OneTimeExtraPaymentComparison | RecurringExtraPaymentComparison;
type ComparableScenario = ProjectionScenarioSnapshot;

export function ScenarioTools({
  loan,
  scenarios,
  onSaveScenario,
}: Readonly<{
  loan: Loan;
  scenarios: readonly ProjectionScenarioSnapshot[];
  onSaveScenario: (scenario: ProjectionScenarioSnapshot) => Promise<void>;
}>) {
  const [scenarioType, setScenarioType] = useState<ScenarioType>('one_time');
  const [comparison, setComparison] = useState<ScenarioComparison>();
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const scenario = createScenario({
        type: scenarioType,
        loan,
        name: String(form.get('name')),
        date: String(form.get('date') ?? ''),
        amount: String(form.get('amount')),
      });
      const nextComparison = compareScenario(loan, scenario);
      await onSaveScenario(scenario);
      setComparison(nextComparison);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el escenario.');
    }
  }

  const comparable = scenarios.filter(isComparableScenario);
  return (
    <section className="scenario-tools" aria-labelledby="scenarios-title">
      <h2 id="scenarios-title">Escenarios</h2>
      <p>Los escenarios no cambian el préstamo ni sus pagos históricos.</p>
      <form onSubmit={(event) => void submit(event)}>
        <label>
          Tipo de escenario
          <select
            value={scenarioType}
            onChange={(event) => setScenarioType(event.target.value as ScenarioType)}
          >
            <option value="one_time">Pago extraordinario único</option>
            <option value="constant_extra">Extraordinario constante mensual</option>
            <option value="constant_principal">Aporte constante al principal mensual</option>
          </select>
        </label>
        <label>
          Nombre del escenario
          <input
            key={scenarioType}
            required
            name="name"
            defaultValue={defaultScenarioName(scenarioType)}
          />
        </label>
        {scenarioType === 'one_time' ? (
          <label>
            Fecha del pago extraordinario
            <input required name="date" type="date" />
          </label>
        ) : (
          <p className="field-hint">
            El aporte se aplica después de cada cuota ordinaria, desde la primera cuota proyectada.
          </p>
        )}
        <label>
          {scenarioType === 'constant_principal'
            ? 'Aporte total al principal por mes'
            : scenarioType === 'constant_extra'
              ? 'Extraordinario mensual'
              : 'Importe adicional al principal'}
          <input required name="amount" inputMode="decimal" />
        </label>
        <button type="submit">Comparar y guardar escenario</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <SavedScenarios loan={loan} scenarios={comparable} onSelect={setComparison} />
      <ScenarioComparisonChart loan={loan} scenarios={comparable} />
      {comparison ? <ComparisonResult loan={loan} comparison={comparison} /> : null}
    </section>
  );
}

function createScenario({
  type,
  loan,
  name,
  date,
  amount,
}: Readonly<{
  type: ScenarioType;
  loan: Loan;
  name: string;
  date: string;
  amount: string;
}>): ComparableScenario {
  const common = {
    id: crypto.randomUUID(),
    loanId: loan.id,
    name,
    createdAt: new Date().toISOString(),
  };
  const money = Money.from(amount, loan.initialBalance.currency);
  if (type === 'one_time') {
    return createOneTimeExtraPaymentScenario({
      ...common,
      extraPayment: { id: crypto.randomUUID(), date, amount: money },
    });
  }
  return createRecurringExtraPaymentScenario({
    ...common,
    recurringExtraPayment: {
      kind: type === 'constant_extra' ? 'constant_extra' : 'constant_principal',
      amount: money,
    },
  });
}

function compareScenario(loan: Loan, scenario: ComparableScenario): ScenarioComparison {
  if (isOneTimeExtraPaymentScenario(scenario)) {
    return compareLoanWithOneTimeExtraPayment({ loan, scenario });
  }
  if (isRecurringExtraPaymentScenario(scenario)) {
    return compareLoanWithRecurringExtraPayment({ loan, scenario });
  }
  throw new Error('El escenario no es compatible con la comparación.');
}

function isComparableScenario(scenario: ProjectionScenarioSnapshot): boolean {
  return isOneTimeExtraPaymentScenario(scenario) || isRecurringExtraPaymentScenario(scenario);
}

function defaultScenarioName(type: ScenarioType): string {
  return {
    one_time: 'Pago extraordinario',
    constant_extra: 'Extraordinario mensual constante',
    constant_principal: 'Aporte mensual al principal',
  }[type];
}

function SavedScenarios({
  loan,
  scenarios,
  onSelect,
}: Readonly<{
  loan: Loan;
  scenarios: readonly ComparableScenario[];
  onSelect: (comparison: ScenarioComparison) => void;
}>) {
  if (!scenarios.length) return <p>No hay escenarios guardados.</p>;
  return (
    <ul aria-label="Escenarios guardados">
      {scenarios.map((scenario) => (
        <li key={scenario.id}>
          {scenario.name}
          <button type="button" onClick={() => onSelect(compareScenario(loan, scenario))}>
            Ver comparación
          </button>
        </li>
      ))}
    </ul>
  );
}

function ScenarioComparisonChart({
  loan,
  scenarios,
}: Readonly<{ loan: Loan; scenarios: readonly ComparableScenario[] }>) {
  const [firstScenarioId, setFirstScenarioId] = useState('');
  const [secondScenarioId, setSecondScenarioId] = useState('');
  const results = useMemo(() => {
    const base = projectLoanAmortization(loan);
    const selected = [firstScenarioId, secondScenarioId]
      .map((id) => scenarios.find((scenario) => scenario.id === id))
      .filter((scenario): scenario is ComparableScenario => Boolean(scenario))
      .map((scenario) => ({
        label: scenario.name,
        result: compareScenario(loan, scenario).alternative,
      }));
    return { base, selected };
  }, [firstScenarioId, loan, scenarios, secondScenarioId]);

  if (!scenarios.length) return null;
  const series = [
    { label: 'Base', result: results.base, className: 'base' },
    ...results.selected.map((item, index) => ({
      ...item,
      className: index === 0 ? 'first' : 'second',
    })),
  ];
  const maximum = series.reduce(
    (current, item) => maximumBalance(current, item.result),
    loan.initialBalance.subtract(loan.initialBalance),
  );
  const maximumAsNumber = Math.max(Number(maximum.toDecimalString()), 1);

  return (
    <section className="scenario-chart" aria-labelledby="scenario-chart-title">
      <h3 id="scenario-chart-title">Comparar saldos de escenarios</h3>
      <p>Selecciona hasta dos escenarios; la línea base permanece visible.</p>
      <div className="scenario-selectors">
        <label>
          Escenario A
          <select
            value={firstScenarioId}
            onChange={(event) => setFirstScenarioId(event.target.value)}
          >
            <option value="">No mostrar</option>
            {scenarios.map((scenario) => (
              <option
                key={scenario.id}
                value={scenario.id}
                disabled={scenario.id === secondScenarioId}
              >
                {scenario.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Escenario B
          <select
            value={secondScenarioId}
            onChange={(event) => setSecondScenarioId(event.target.value)}
          >
            <option value="">No mostrar</option>
            {scenarios.map((scenario) => (
              <option
                key={scenario.id}
                value={scenario.id}
                disabled={scenario.id === firstScenarioId}
              >
                {scenario.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <svg viewBox="0 0 700 260" role="img" aria-labelledby="scenario-chart-title">
        <line className="scenario-axis" x1="55" y1="220" x2="675" y2="220" />
        <line className="scenario-axis" x1="55" y1="20" x2="55" y2="220" />
        <text className="scenario-label" x="48" y="26" textAnchor="end">
          {formatMoney(maximum, loan.roundingPolicy)}
        </text>
        <text className="scenario-label" x="55" y="244">
          Inicio
        </text>
        <text className="scenario-label" x="675" y="244" textAnchor="end">
          Final
        </text>
        {series.map((item) => (
          <polyline
            className={`scenario-line ${item.className}`}
            key={item.className}
            points={scenarioPoints(item.result, maximumAsNumber)}
          />
        ))}
      </svg>
      <p className="scenario-legend">
        {series.map((item) => (
          <span className={item.className} key={item.className}>
            {item.label}
          </span>
        ))}
      </p>
    </section>
  );
}

function maximumBalance(current: Loan['initialBalance'], result: FixedRateAmortizationResult) {
  return result.periods.reduce(
    (maximum, period) =>
      maximum.isLessThan(period.openingBalance) ? period.openingBalance : maximum,
    current,
  );
}

function scenarioPoints(result: FixedRateAmortizationResult, maximum: number): string {
  const denominator = Math.max(result.periods.length - 1, 1);
  return result.periods
    .map((period, index) => {
      const x = 55 + (index / denominator) * 620;
      const y = 20 + (1 - Number(period.closingBalance.toDecimalString()) / maximum) * 200;
      return `${x},${y}`;
    })
    .join(' ');
}

function ComparisonResult({
  loan,
  comparison,
}: Readonly<{ loan: Loan; comparison: ScenarioComparison }>) {
  return (
    <section className="comparison-result" aria-live="polite" aria-labelledby="comparison-title">
      <h3 id="comparison-title">Comparación con escenario base</h3>
      <dl>
        <div>
          <dt>Fecha final base</dt>
          <dd>{comparison.base.summary.completionDate}</dd>
        </div>
        <div>
          <dt>Fecha final alternativa</dt>
          <dd>{comparison.alternative.summary.completionDate}</dd>
        </div>
        <div>
          <dt>Plazo ahorrado</dt>
          <dd>{comparison.comparison.periodsSaved} periodos</dd>
        </div>
        <div>
          <dt>Interés ahorrado</dt>
          <dd>{formatMoney(comparison.comparison.interestSaved, loan.roundingPolicy)}</dd>
        </div>
        <div>
          <dt>Total pagado base</dt>
          <dd>
            {formatDecimalMoney(
              comparison.base.summary.totalPaid,
              loan.initialBalance.currency,
              loan.roundingPolicy,
            )}
          </dd>
        </div>
        <div>
          <dt>Total pagado alternativa</dt>
          <dd>
            {formatDecimalMoney(
              comparison.alternative.summary.totalPaid,
              loan.initialBalance.currency,
              loan.roundingPolicy,
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
