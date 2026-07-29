import { useState, type FormEvent } from 'react';

import {
  compareLoanWithOneTimeExtraPayment,
  createOneTimeExtraPaymentScenario,
  isOneTimeExtraPaymentScenario,
  Money,
  type Loan,
  type OneTimeExtraPaymentComparison,
  type ProjectionScenarioSnapshot,
} from '@cuotaclara/domain';

import { formatDecimalMoney, formatMoney } from './money-format.js';

export function ScenarioTools({
  loan,
  scenarios,
  onSaveScenario,
}: Readonly<{
  loan: Loan;
  scenarios: readonly ProjectionScenarioSnapshot[];
  onSaveScenario: (scenario: ProjectionScenarioSnapshot) => Promise<void>;
}>) {
  const [comparison, setComparison] = useState<OneTimeExtraPaymentComparison>();
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const scenario = createOneTimeExtraPaymentScenario({
        id: crypto.randomUUID(),
        loanId: loan.id,
        name: String(form.get('name')),
        createdAt: new Date().toISOString(),
        extraPayment: {
          id: crypto.randomUUID(),
          date: String(form.get('date')),
          amount: Money.from(String(form.get('amount')), loan.initialBalance.currency),
        },
      });
      const nextComparison = compareLoanWithOneTimeExtraPayment({ loan, scenario });
      await onSaveScenario(scenario);
      setComparison(nextComparison);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el escenario.');
    }
  }

  return (
    <section className="scenario-tools" aria-labelledby="scenarios-title">
      <h2 id="scenarios-title">Escenarios</h2>
      <p>Los escenarios no cambian el préstamo ni sus pagos históricos.</p>
      <form onSubmit={(event) => void submit(event)}>
        <label>
          Nombre del escenario
          <input required name="name" defaultValue="Pago extraordinario" />
        </label>
        <label>
          Fecha del pago extraordinario
          <input required name="date" type="date" />
        </label>
        <label>
          Importe adicional al principal
          <input required name="amount" inputMode="decimal" />
        </label>
        <button type="submit">Comparar y guardar escenario</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <SavedScenarios loan={loan} scenarios={scenarios} onSelect={setComparison} />
      {comparison ? <ComparisonResult loan={loan} comparison={comparison} /> : null}
    </section>
  );
}

function SavedScenarios({
  loan,
  scenarios,
  onSelect,
}: Readonly<{
  loan: Loan;
  scenarios: readonly ProjectionScenarioSnapshot[];
  onSelect: (comparison: OneTimeExtraPaymentComparison) => void;
}>) {
  const compatible = scenarios.filter(isOneTimeExtraPaymentScenario);
  if (!compatible.length) return <p>No hay escenarios guardados.</p>;
  return (
    <ul aria-label="Escenarios guardados">
      {compatible.map((scenario) => (
        <li key={scenario.id}>
          {scenario.name}
          <button
            type="button"
            onClick={() => onSelect(compareLoanWithOneTimeExtraPayment({ loan, scenario }))}
          >
            Ver comparación
          </button>
        </li>
      ))}
    </ul>
  );
}

function ComparisonResult({
  loan,
  comparison,
}: Readonly<{ loan: Loan; comparison: OneTimeExtraPaymentComparison }>) {
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
