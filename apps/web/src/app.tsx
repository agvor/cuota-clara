import { useEffect, useMemo, useState } from 'react';

import {
  createTbpMarginScenario,
  estimateLoanContract,
  isTbpMarginScenario,
} from '@cuotaclara/domain';
import type {
  Loan,
  LoanAggregate,
  LoanRepository,
  PaymentRecord,
  ProjectionScenarioSnapshot,
} from '@cuotaclara/domain';

import { LoanForm } from './loan-form.js';
import { BackupTools } from './backup-tools.js';
import { EstimateSummary } from './estimate-summary.js';
import { formatMoney } from './money-format.js';
import { PaymentTools } from './payment-tools.js';
import { decimalRateToPercent } from './percentage.js';
import { ProjectionView } from './projection-view.js';
import { ScenarioTools } from './scenario-tools.js';
import './styles.css';

export type AppProps = Readonly<{
  repository: LoanRepository;
}>;

type LoadState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; loans: readonly Loan[] }>
  | Readonly<{ status: 'error' }>;

export function App({ repository }: AppProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [selectedLoanId, setSelectedLoanId] = useState<string>();
  const [formLoan, setFormLoan] = useState<Loan | null | undefined>(undefined);
  const [selectedAggregate, setSelectedAggregate] = useState<LoanAggregate>();

  async function reloadLoans() {
    const loans = await repository.listLoans();
    setState({ status: 'ready', loans });
  }

  useEffect(() => {
    let active = true;
    void repository
      .listLoans()
      .then((loans) => {
        if (active) setState({ status: 'ready', loans });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [repository]);

  async function saveLoan(loan: Loan) {
    const existing = await repository.loadAggregate(loan.id);
    const scenarios = saveTbpScenario(loan, existing?.scenarios ?? []);
    const aggregate: LoanAggregate = {
      loan,
      payments: existing?.payments ?? [],
      scenarios,
    };
    await repository.saveAggregate(aggregate);
    await reloadLoans();
    setSelectedLoanId(loan.id);
    setFormLoan(undefined);
  }

  async function duplicateLoan(loan: Loan) {
    if (!window.confirm(`¿Duplicar el préstamo “${loan.name}” sin sus pagos ni escenarios?`))
      return;
    const duplicate = { ...loan, id: crypto.randomUUID(), name: `${loan.name} (copia)` };
    await repository.saveAggregate({ loan: duplicate, payments: [], scenarios: [] });
    await reloadLoans();
    setSelectedLoanId(duplicate.id);
  }

  async function deleteLoan(loan: Loan) {
    if (
      !window.confirm(
        `¿Eliminar “${loan.name}” y sus pagos y escenarios? Esta acción no se puede deshacer.`,
      )
    )
      return;
    await repository.deleteLoan(loan.id);
    await reloadLoans();
    setSelectedLoanId(undefined);
    setSelectedAggregate(undefined);
  }

  async function selectLoan(loanId: string) {
    setSelectedLoanId(loanId);
    setSelectedAggregate(await repository.loadAggregate(loanId));
  }

  async function savePayment(payment: PaymentRecord) {
    if (!selectedAggregate) return;
    const existing = selectedAggregate.payments.find((record) => record.id === payment.id);
    const payments = existing
      ? selectedAggregate.payments.map((record) => (record.id === payment.id ? payment : record))
      : [...selectedAggregate.payments, payment];
    const aggregate = { ...selectedAggregate, payments };
    await repository.saveAggregate(aggregate);
    setSelectedAggregate(aggregate);
  }

  async function importPayments(payments: readonly PaymentRecord[]) {
    if (!selectedAggregate) return;
    const aggregate = {
      ...selectedAggregate,
      payments: [...selectedAggregate.payments, ...payments],
    };
    await repository.saveAggregate(aggregate);
    setSelectedAggregate(aggregate);
  }

  async function saveScenario(scenario: ProjectionScenarioSnapshot) {
    if (!selectedAggregate) return;
    const existing = selectedAggregate.scenarios.some((item) => item.id === scenario.id);
    const aggregate = {
      ...selectedAggregate,
      scenarios: existing
        ? selectedAggregate.scenarios.map((item) => (item.id === scenario.id ? scenario : item))
        : [...selectedAggregate.scenarios, scenario],
    };
    await repository.saveAggregate(aggregate);
    setSelectedAggregate(aggregate);
  }

  async function deleteScenario(scenarioId: string) {
    if (!selectedAggregate) return;
    const aggregate = {
      ...selectedAggregate,
      scenarios: selectedAggregate.scenarios.filter((scenario) => scenario.id !== scenarioId),
    };
    await repository.saveAggregate(aggregate);
    setSelectedAggregate(aggregate);
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#loans">
        Ir a préstamos
      </a>
      <header className="site-header">
        <a className="brand" href="#loans" aria-label="CuotaClara, inicio">
          CuotaClara
        </a>
        <nav aria-label="Principal">
          <a href="#loans">Préstamos</a>
          <a href="#about">Acerca de</a>
        </nav>
      </header>
      <main>
        <section id="loans" aria-labelledby="loans-title">
          <p className="eyebrow">Local-first · sin cuenta</p>
          <h1 id="loans-title">Tus préstamos</h1>
          <p className="section-introduction">
            Consulta cada préstamo por separado y conserva los datos en este dispositivo.
          </p>
          <button type="button" onClick={() => setFormLoan(null)}>
            Crear préstamo
          </button>
          {state.status === 'loading' ? <p aria-live="polite">Cargando préstamos…</p> : null}
          {state.status === 'error' ? (
            <p role="alert">
              No fue posible leer los préstamos locales. Intenta recargar la página.
            </p>
          ) : null}
          {state.status === 'ready' && state.loans.length === 0 ? <EmptyLoans /> : null}
          {formLoan !== undefined ? (
            <LoanForm
              {...(formLoan ? { loan: formLoan } : {})}
              onCancel={() => setFormLoan(undefined)}
              onSave={saveLoan}
            />
          ) : null}
          {state.status === 'ready' && state.loans.length > 0 ? (
            <>
              <ul className="loan-list" aria-label="Préstamos guardados">
                {state.loans.map((loan) => (
                  <li key={loan.id}>
                    <article className="loan-card">
                      <h2>{loan.name}</h2>
                      <dl>
                        <div>
                          <dt>Saldo inicial</dt>
                          <dd>{formatMoney(loan.initialBalance, loan.roundingPolicy)}</dd>
                        </div>
                        <div>
                          <dt>Cuota mensual</dt>
                          <dd>
                            {formatMoney(
                              loan.contract?.version === 3
                                ? loan.contract.monthlyTotalPayment
                                : loan.ordinaryPayment,
                              loan.roundingPolicy,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>Tasa nominal anual</dt>
                          <dd>{decimalRateToPercent(loan.annualNominalRate)}%</dd>
                        </div>
                      </dl>
                      {!loan.contract ? (
                        <p className="inherited-notice">Préstamo heredado: falta plazo y seguro</p>
                      ) : null}
                      <button type="button" onClick={() => void selectLoan(loan.id)}>
                        Ver préstamo
                      </button>
                    </article>
                  </li>
                ))}
              </ul>
              {selectedLoanId ? (
                <LoanDetail
                  loan={state.loans.find((loan) => loan.id === selectedLoanId)}
                  onEdit={() => setFormLoan(state.loans.find((loan) => loan.id === selectedLoanId))}
                  onDuplicate={duplicateLoan}
                  onDelete={deleteLoan}
                  aggregate={selectedAggregate}
                  onSavePayment={savePayment}
                  onImportPayments={importPayments}
                  onSaveScenario={saveScenario}
                  onDeleteScenario={deleteScenario}
                />
              ) : null}
            </>
          ) : null}
        </section>
        <section id="about" className="about" aria-labelledby="about-title">
          <h2 id="about-title">Datos bajo tu control</h2>
          <p>CuotaClara guarda los préstamos localmente y no requiere una cuenta para el MVP.</p>
        </section>
        <BackupTools repository={repository} onRestored={reloadLoans} />
      </main>
    </div>
  );
}

function EmptyLoans() {
  return (
    <div className="empty-state">
      <h2>Aún no hay préstamos</h2>
      <p>Usa “Crear préstamo” para registrar tu primera configuración financiera.</p>
    </div>
  );
}

function LoanDetail({
  loan,
  onEdit,
  onDuplicate,
  onDelete,
  aggregate,
  onSavePayment,
  onImportPayments,
  onSaveScenario,
  onDeleteScenario,
}: Readonly<{
  loan: Loan | undefined;
  onEdit: () => void;
  onDuplicate: (loan: Loan) => Promise<void>;
  onDelete: (loan: Loan) => Promise<void>;
  aggregate: LoanAggregate | undefined;
  onSavePayment: (payment: PaymentRecord) => Promise<void>;
  onImportPayments: (payments: readonly PaymentRecord[]) => Promise<void>;
  onSaveScenario: (scenario: ProjectionScenarioSnapshot) => Promise<void>;
  onDeleteScenario: (scenarioId: string) => Promise<void>;
}>) {
  if (!loan) return null;
  return (
    <section className="loan-detail" aria-labelledby="loan-detail-title" aria-live="polite">
      <h2 id="loan-detail-title">Resumen de {loan.name}</h2>
      <p>
        Inicio: <time dateTime={loan.startDate}>{loan.startDate}</time>
      </p>
      <p>Periodicidad: {loan.periodsPerYear} pagos por año.</p>
      {!loan.contract ? (
        <p className="inherited-notice" role="status">
          Este préstamo es heredado. Puedes consultarlo, pero completa plazo y seguro al editarlo
          para habilitar su estimación contractual.
        </p>
      ) : null}
      {loan.contract ? (
        <dl className="contract-summary">
          <div>
            <dt>Plazo</dt>
            <dd>
              {'endDate' in loan.contract.term
                ? loan.contract.term.endDate
                : `${loan.contract.term.totalInstallments} cuotas`}
            </dd>
          </div>
          <div>
            <dt>Seguro mensual</dt>
            <dd>{formatMoney(loan.contract.monthlyInsurance, loan.roundingPolicy)}</dd>
          </div>
          <div>
            <dt>Cuota mensual total</dt>
            <dd>
              {formatMoney(
                loan.contract.version === 3
                  ? loan.contract.monthlyTotalPayment
                  : loan.contract.monthlyInstallment.add(loan.contract.monthlyInsurance),
                loan.roundingPolicy,
              )}
            </dd>
          </div>
        </dl>
      ) : null}
      {loan.contract ? <ContractEstimateSummary loan={loan} /> : null}
      <div className="form-actions">
        <button type="button" onClick={onEdit}>
          Editar préstamo
        </button>
        <button type="button" onClick={() => void onDuplicate(loan)}>
          Duplicar préstamo
        </button>
        <button type="button" onClick={() => void onDelete(loan)}>
          Eliminar préstamo
        </button>
      </div>
      {aggregate?.loan.id === loan.id ? (
        <PaymentTools
          loan={loan}
          payments={aggregate.payments}
          onSavePayment={onSavePayment}
          onImportPayments={onImportPayments}
        />
      ) : (
        <p aria-live="polite">Cargando pagos…</p>
      )}
      {aggregate?.loan.id === loan.id ? (
        <ScenarioTools
          loan={loan}
          scenarios={aggregate.scenarios}
          onSaveScenario={onSaveScenario}
          onDeleteScenario={onDeleteScenario}
        />
      ) : null}
      {aggregate?.loan.id === loan.id ? <TbpScenarios scenarios={aggregate.scenarios} /> : null}
      {aggregate?.loan.id === loan.id ? (
        <AmortizationDetail
          loan={loan}
          payments={aggregate.payments}
          scenarios={aggregate.scenarios}
        />
      ) : null}
    </section>
  );
}

function AmortizationDetail({
  loan,
  payments,
  scenarios,
}: Readonly<{
  loan: Loan;
  payments: readonly PaymentRecord[];
  scenarios: readonly ProjectionScenarioSnapshot[];
}>) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <section className="amortization-detail" aria-labelledby="amortization-detail-title">
      <h3 id="amortization-detail-title">Detalle de amortización</h3>
      <p>Abre la tabla paginada y el gráfico solo cuando necesites revisar cada cuota.</p>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="amortization-projection"
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? 'Ocultar detalle de amortización' : 'Ver detalle de amortización'}
      </button>
      <div id="amortization-projection" hidden={!isOpen}>
        {isOpen ? <ProjectionView loan={loan} payments={payments} scenarios={scenarios} /> : null}
      </div>
    </section>
  );
}

function ContractEstimateSummary({ loan }: Readonly<{ loan: Loan }>) {
  const result = useMemo(() => {
    try {
      return { estimate: estimateLoanContract(loan) };
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : 'No se pudo estimar el préstamo.' };
    }
  }, [loan]);

  if ('error' in result) return <p role="alert">{result.error}</p>;
  return <EstimateSummary loan={loan} estimate={result.estimate} />;
}

function saveTbpScenario(
  loan: Loan,
  scenarios: readonly ProjectionScenarioSnapshot[],
): readonly ProjectionScenarioSnapshot[] {
  if (!loan.tbpMarginRatePlan) return scenarios;
  const current = scenarios.find(isTbpMarginScenario);
  const scenario = createTbpMarginScenario({
    id: current?.id ?? crypto.randomUUID(),
    loanId: loan.id,
    name: current?.name ?? 'Supuesto TBP + margen',
    createdAt: current?.createdAt ?? new Date().toISOString(),
    plan: loan.tbpMarginRatePlan,
  });
  return current
    ? scenarios.map((item) => (item.id === current.id ? scenario : item))
    : [...scenarios, scenario];
}

function TbpScenarios({
  scenarios,
}: Readonly<{ scenarios: readonly ProjectionScenarioSnapshot[] }>) {
  const tbpScenarios = scenarios.filter(isTbpMarginScenario);
  if (!tbpScenarios.length) return null;
  return (
    <section className="tbp-scenarios" aria-labelledby="tbp-scenarios-title">
      <h2 id="tbp-scenarios-title">Supuestos TBP guardados</h2>
      {tbpScenarios.map((scenario) => (
        <article key={scenario.id}>
          <h3>{scenario.name}</h3>
          <p>
            TBP {decimalRateToPercent(scenario.configuration.tbpInitialAnnualRate)}% + margen{' '}
            {decimalRateToPercent(scenario.configuration.marginAnnualRate)}%;{' '}
            {scenario.configuration.evolution.replace('_', ' ')} cada{' '}
            {scenario.configuration.reviewFrequency}.
          </p>
        </article>
      ))}
    </section>
  );
}
