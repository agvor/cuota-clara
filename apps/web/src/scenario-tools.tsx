import { useState, type FormEvent } from 'react';

import {
  createOneTimeExtraPaymentScenario,
  createRecurringExtraPaymentScenario,
  isOneTimeExtraPaymentScenario,
  isRecurringExtraPaymentScenario,
  Money,
  type Loan,
  type ProjectionScenarioSnapshot,
} from '@cuotaclara/domain';

type ScenarioType = 'one_time' | 'constant_extra' | 'constant_principal';
type ComparableScenario = ProjectionScenarioSnapshot;

export function ScenarioTools({
  loan,
  scenarios,
  onSaveScenario,
  onDeleteScenario = async () => undefined,
}: Readonly<{
  loan: Loan;
  scenarios: readonly ProjectionScenarioSnapshot[];
  onSaveScenario: (scenario: ProjectionScenarioSnapshot) => Promise<void>;
  onDeleteScenario?: (scenarioId: string) => Promise<void>;
}>) {
  const [editingScenario, setEditingScenario] = useState<ComparableScenario>();
  const [scenarioType, setScenarioType] = useState<ScenarioType>('one_time');
  const [error, setError] = useState<string>();
  const comparable = scenarios.filter(isComparableScenario);
  const formKey = `${editingScenario?.id ?? 'new'}-${scenarioType}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const scenario = createScenario({
        type: scenarioType,
        loan,
        id: editingScenario?.id ?? crypto.randomUUID(),
        createdAt: editingScenario?.createdAt ?? new Date().toISOString(),
        name: String(form.get('name')),
        date: String(form.get('date') ?? ''),
        amount: String(form.get('amount')),
      });
      await onSaveScenario(scenario);
      setEditingScenario(undefined);
      setScenarioType('one_time');
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el escenario.');
    }
  }

  async function remove(scenario: ComparableScenario) {
    if (!window.confirm(`¿Eliminar el escenario “${scenario.name}”?`)) return;
    await onDeleteScenario(scenario.id);
    if (editingScenario?.id === scenario.id) setEditingScenario(undefined);
  }

  function edit(scenario: ComparableScenario) {
    setEditingScenario(scenario);
    setScenarioType(typeForScenario(scenario));
    setError(undefined);
  }

  const existingValues = editingScenario ? valuesForScenario(editingScenario) : undefined;
  return (
    <section className="scenario-tools" aria-labelledby="scenarios-title">
      <h2 id="scenarios-title">Configuración de escenarios</h2>
      <p>Los escenarios no cambian el préstamo ni sus pagos históricos.</p>
      <form key={formKey} onSubmit={(event) => void submit(event)}>
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
            required
            name="name"
            defaultValue={editingScenario?.name ?? defaultScenarioName(scenarioType)}
          />
        </label>
        {scenarioType === 'one_time' ? (
          <label>
            Fecha del pago extraordinario
            <input required name="date" type="date" defaultValue={existingValues?.date} />
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
          <input required name="amount" inputMode="decimal" defaultValue={existingValues?.amount} />
        </label>
        <div className="form-actions">
          <button type="submit">{editingScenario ? 'Guardar cambios' : 'Crear escenario'}</button>
          {editingScenario ? (
            <button type="button" onClick={() => setEditingScenario(undefined)}>
              Cancelar edición
            </button>
          ) : null}
        </div>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <SavedScenarios scenarios={comparable} onEdit={edit} onDelete={remove} />
    </section>
  );
}

function createScenario({
  type,
  loan,
  id,
  createdAt,
  name,
  date,
  amount,
}: Readonly<{
  type: ScenarioType;
  loan: Loan;
  id: string;
  createdAt: string;
  name: string;
  date: string;
  amount: string;
}>): ComparableScenario {
  const common = { id, loanId: loan.id, name, createdAt };
  const money = Money.from(amount, loan.initialBalance.currency);
  if (type === 'one_time') {
    return createOneTimeExtraPaymentScenario({
      ...common,
      extraPayment: { id: `extra-${id}`, date, amount: money },
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

function isComparableScenario(
  scenario: ProjectionScenarioSnapshot,
): scenario is ComparableScenario {
  return isOneTimeExtraPaymentScenario(scenario) || isRecurringExtraPaymentScenario(scenario);
}

function typeForScenario(scenario: ComparableScenario): ScenarioType {
  if (isOneTimeExtraPaymentScenario(scenario)) return 'one_time';
  return scenario.configuration.mode === 'constant_extra' ? 'constant_extra' : 'constant_principal';
}

function valuesForScenario(
  scenario: ComparableScenario,
): Readonly<{ amount: string; date?: string }> {
  if (isOneTimeExtraPaymentScenario(scenario)) {
    return {
      amount: scenario.configuration.extraPayment.amount,
      date: scenario.configuration.extraPayment.date,
    };
  }
  if (isRecurringExtraPaymentScenario(scenario)) return { amount: scenario.configuration.amount };
  return { amount: '' };
}

function defaultScenarioName(type: ScenarioType): string {
  return {
    one_time: 'Pago extraordinario',
    constant_extra: 'Extraordinario mensual constante',
    constant_principal: 'Aporte mensual al principal',
  }[type];
}

function SavedScenarios({
  scenarios,
  onEdit,
  onDelete,
}: Readonly<{
  scenarios: readonly ComparableScenario[];
  onEdit: (scenario: ComparableScenario) => void;
  onDelete: (scenario: ComparableScenario) => void;
}>) {
  if (!scenarios.length) return <p>No hay escenarios configurados.</p>;
  return (
    <ul aria-label="Escenarios configurados">
      {scenarios.map((scenario) => (
        <li key={scenario.id}>
          <strong>{scenario.name}</strong>
          <span className="scenario-description">{describeScenario(scenario)}</span>
          <button type="button" onClick={() => onEdit(scenario)}>
            Editar escenario
          </button>
          <button type="button" onClick={() => void onDelete(scenario)}>
            Eliminar escenario
          </button>
        </li>
      ))}
    </ul>
  );
}

function describeScenario(scenario: ComparableScenario): string {
  if (isOneTimeExtraPaymentScenario(scenario)) return 'Pago extraordinario único';
  return scenario.configuration.mode === 'constant_extra'
    ? 'Extraordinario constante mensual'
    : 'Aporte constante al principal mensual';
}
