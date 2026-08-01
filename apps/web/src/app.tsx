import { useCallback, useEffect, useMemo, useState } from 'react';

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
  BankReset,
  ProjectionScenarioSnapshot,
} from '@cuotaclara/domain';

import { LoanForm } from './loan-form.js';
import { BackupTools } from './backup-tools.js';
import { EstimateSummary } from './estimate-summary.js';
import { formatMoney } from './money-format.js';
import { PaymentTools } from './payment-tools.js';
import { decimalRateToPercent } from './percentage.js';
import { ProjectionView, type ChartConfiguration } from './projection-view.js';
import { ScenarioTools } from './scenario-tools.js';
import './styles.css';

export type AppProps = Readonly<{
  repository: LoanRepository;
}>;

type LoadState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; loans: readonly Loan[] }>
  | Readonly<{ status: 'error' }>;

type AppView = 'loans' | 'backup';
type LoanTab = 'summary' | 'payments' | 'scenarios' | 'projection' | 'settings';
type AppRoute = Readonly<{ view: 'loans' | 'backup'; loanId?: string; tab?: LoanTab }>;

const LOAN_TABS: readonly Readonly<{ id: LoanTab; label: string }>[] = [
  { id: 'summary', label: 'Resumen' },
  { id: 'payments', label: 'Pagos' },
  { id: 'scenarios', label: 'Escenarios' },
  { id: 'projection', label: 'Proyección' },
  { id: 'settings', label: 'Configuración' },
];

function parseRoute(hash: string): AppRoute | undefined {
  if (hash === '#/prestamos' || hash === '') return { view: 'loans' };
  if (hash === '#/datos') return { view: 'backup' };
  const match = /^#\/prestamos\/([^/]+)\/(summary|payments|scenarios|projection|settings)$/.exec(
    hash,
  );
  if (!match?.[1] || !match[2]) return undefined;
  return { view: 'loans', loanId: decodeURIComponent(match[1]), tab: match[2] as LoanTab };
}

function routeForLoan(loanId: string, tab: LoanTab): string {
  return `#/prestamos/${encodeURIComponent(loanId)}/${tab}`;
}

export function App({ repository }: AppProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [appView, setAppView] = useState<AppView>('loans');
  const [selectedLoanId, setSelectedLoanId] = useState<string>();
  const [activeLoanTab, setActiveLoanTab] = useState<LoanTab>('summary');
  const [formLoan, setFormLoan] = useState<Loan | null | undefined>(undefined);
  const [selectedAggregate, setSelectedAggregate] = useState<LoanAggregate>();
  const [chartConfigurations, setChartConfigurations] = useState<
    Readonly<Record<string, ChartConfiguration>>
  >({});

  const saveChartConfiguration = useCallback(
    (loanId: string, configuration: ChartConfiguration) => {
      setChartConfigurations((current) => ({ ...current, [loanId]: configuration }));
    },
    [],
  );
  const saveSelectedChartConfiguration = useCallback(
    (configuration: ChartConfiguration) => {
      if (selectedLoanId) saveChartConfiguration(selectedLoanId, configuration);
    },
    [saveChartConfiguration, selectedLoanId],
  );

  async function reloadLoans() {
    const loans = await repository.listLoans();
    setState({ status: 'ready', loans });
  }

  function writeRoute(route: string) {
    if (window.location.hash === route) return;
    window.history.pushState(null, '', route);
  }

  function showLoanLibrary() {
    setAppView('loans');
    setSelectedLoanId(undefined);
    setSelectedAggregate(undefined);
    writeRoute('#/prestamos');
  }

  function showBackup() {
    setAppView('backup');
    setSelectedLoanId(undefined);
    setSelectedAggregate(undefined);
    writeRoute('#/datos');
  }

  function changeLoanTab(tab: LoanTab) {
    if (!selectedLoanId) return;
    setActiveLoanTab(tab);
    writeRoute(routeForLoan(selectedLoanId, tab));
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

  useEffect(() => {
    let active = true;
    async function applyRoute() {
      const route = parseRoute(window.location.hash);
      if (!route) return;
      if (route.view === 'backup') {
        if (active) {
          setAppView('backup');
          setSelectedLoanId(undefined);
          setSelectedAggregate(undefined);
        }
        return;
      }
      if (!route.loanId || !route.tab) {
        if (active) {
          setAppView('loans');
          setSelectedLoanId(undefined);
          setSelectedAggregate(undefined);
        }
        return;
      }
      if (active) {
        setAppView('loans');
        setSelectedLoanId(route.loanId);
        setActiveLoanTab(route.tab);
        setSelectedAggregate(undefined);
      }
      const aggregate = await repository.loadAggregate(route.loanId);
      if (active) setSelectedAggregate(aggregate);
    }
    void applyRoute();
    window.addEventListener('popstate', applyRoute);
    window.addEventListener('hashchange', applyRoute);
    return () => {
      active = false;
      window.removeEventListener('popstate', applyRoute);
      window.removeEventListener('hashchange', applyRoute);
    };
  }, [repository]);

  async function saveLoan(loan: Loan) {
    const existing = await repository.loadAggregate(loan.id);
    const scenarios = saveTbpScenario(loan, existing?.scenarios ?? []);
    const aggregate: LoanAggregate = {
      loan,
      payments: existing?.payments ?? [],
      ...(existing?.bankReset ? { bankReset: existing.bankReset } : {}),
      scenarios,
    };
    await repository.saveAggregate(aggregate);
    await reloadLoans();
    setSelectedLoanId(loan.id);
    setSelectedAggregate(aggregate);
    setActiveLoanTab('summary');
    setAppView('loans');
    writeRoute(routeForLoan(loan.id, 'summary'));
    setFormLoan(undefined);
  }

  async function duplicateLoan(loan: Loan) {
    if (!window.confirm(`¿Duplicar el préstamo “${loan.name}” sin sus pagos ni escenarios?`))
      return;
    const duplicate = { ...loan, id: crypto.randomUUID(), name: `${loan.name} (copia)` };
    const aggregate: LoanAggregate = { loan: duplicate, payments: [], scenarios: [] };
    await repository.saveAggregate(aggregate);
    await reloadLoans();
    setSelectedLoanId(duplicate.id);
    setSelectedAggregate(aggregate);
    setActiveLoanTab('summary');
    setAppView('loans');
    writeRoute(routeForLoan(duplicate.id, 'summary'));
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
    setActiveLoanTab('summary');
    writeRoute('#/prestamos');
  }

  async function selectLoan(loanId: string, tab: LoanTab = 'summary') {
    setSelectedLoanId(loanId);
    setSelectedAggregate(undefined);
    setActiveLoanTab(tab);
    setAppView('loans');
    writeRoute(routeForLoan(loanId, tab));
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

  async function saveBankReset(bankReset: BankReset | undefined) {
    if (!selectedAggregate) return;
    const aggregateWithoutReset = {
      loan: selectedAggregate.loan,
      payments: selectedAggregate.payments,
      scenarios: selectedAggregate.scenarios,
    };
    const aggregate: LoanAggregate = bankReset
      ? { ...aggregateWithoutReset, bankReset }
      : aggregateWithoutReset;
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
      <a className="skip-link" href="#main-content">
        Ir al contenido principal
      </a>
      <header className="site-header">
        <button
          className="brand"
          type="button"
          aria-label="CuotaClara, préstamos"
          onClick={() => {
            showLoanLibrary();
          }}
        >
          CuotaClara
        </button>
        <nav aria-label="Principal">
          <button
            type="button"
            aria-current={appView === 'loans' ? 'page' : undefined}
            onClick={() => {
              showLoanLibrary();
            }}
          >
            Préstamos
          </button>
          <button
            type="button"
            aria-current={appView === 'backup' ? 'page' : undefined}
            onClick={() => {
              showBackup();
            }}
          >
            Datos y respaldo
          </button>
        </nav>
      </header>
      <main id="main-content">
        {formLoan !== undefined ? (
          <LoanEditor
            {...(formLoan ? { loan: formLoan } : {})}
            onCancel={() => setFormLoan(undefined)}
            onSave={saveLoan}
          />
        ) : appView === 'backup' ? (
          <section className="data-workspace" aria-labelledby="data-workspace-title">
            <p className="eyebrow">Datos locales</p>
            <h1 id="data-workspace-title">Datos y respaldo</h1>
            <p className="section-introduction">
              Tu información permanece en este dispositivo. Puedes crear una copia o restaurar una
              previamente validada.
            </p>
            <BackupTools repository={repository} onRestored={reloadLoans} />
          </section>
        ) : selectedLoanId && state.status === 'ready' ? (
          <LoanWorkspace
            loan={state.loans.find((loan) => loan.id === selectedLoanId)}
            activeTab={activeLoanTab}
            onChangeTab={changeLoanTab}
            onBack={showLoanLibrary}
            onEdit={() => setFormLoan(state.loans.find((loan) => loan.id === selectedLoanId))}
            onDuplicate={duplicateLoan}
            onDelete={deleteLoan}
            aggregate={selectedAggregate}
            {...(chartConfigurations[selectedLoanId]
              ? { chartConfiguration: chartConfigurations[selectedLoanId] }
              : {})}
            onChartConfigurationChange={saveSelectedChartConfiguration}
            onSavePayment={savePayment}
            onImportPayments={importPayments}
            onSaveBankReset={saveBankReset}
            onSaveScenario={saveScenario}
            onDeleteScenario={deleteScenario}
          />
        ) : (
          <LoanLibrary
            state={state}
            onCreate={() => setFormLoan(null)}
            onOpen={(loanId) => void selectLoan(loanId)}
          />
        )}
      </main>
      <footer className="site-footer">
        <p>CuotaClara guarda tus datos localmente y no requiere cuenta.</p>
        <p>
          Las estimaciones son informativas, se calculan localmente y no constituyen una promesa ni
          liquidación bancaria.
        </p>
      </footer>
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

function LoanLibrary({
  state,
  onCreate,
  onOpen,
}: Readonly<{
  state: LoadState;
  onCreate: () => void;
  onOpen: (loanId: string) => void;
}>) {
  return (
    <section id="loans" className="loan-library" aria-labelledby="loans-title">
      <p className="eyebrow">Local-first · sin cuenta</p>
      <div className="workspace-title-row">
        <div>
          <h1 id="loans-title">Tus préstamos</h1>
          <p className="section-introduction">
            Consulta cada préstamo por separado y conserva los datos en este dispositivo.
          </p>
        </div>
        <button type="button" onClick={onCreate}>
          Crear préstamo
        </button>
      </div>
      {state.status === 'loading' ? <p aria-live="polite">Cargando préstamos…</p> : null}
      {state.status === 'error' ? (
        <p role="alert">No fue posible leer los préstamos locales. Intenta recargar la página.</p>
      ) : null}
      {state.status === 'ready' && state.loans.length === 0 ? <EmptyLoans /> : null}
      {state.status === 'ready' && state.loans.length > 0 ? (
        <ul className="loan-list" aria-label="Préstamos guardados">
          {state.loans.map((loan) => (
            <li key={loan.id}>
              <article
                className="loan-card loan-card-selectable"
                role="button"
                tabIndex={0}
                aria-label={`Abrir préstamo ${loan.name}`}
                onClick={() => onOpen(loan.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpen(loan.id);
                  }
                }}
              >
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
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function LoanEditor({
  loan,
  onCancel,
  onSave,
}: Readonly<{
  loan?: Loan;
  onCancel: () => void;
  onSave: (loan: Loan) => Promise<void>;
}>) {
  return (
    <section className="loan-editor" aria-labelledby="loan-editor-title">
      <p className="eyebrow">{loan ? 'Configuración del préstamo' : 'Nuevo préstamo'}</p>
      <h1 id="loan-editor-title">{loan ? `Editar ${loan.name}` : 'Crear préstamo'}</h1>
      <p className="section-introduction">
        Define primero las condiciones financieras. Podrás registrar pagos y comparar escenarios
        después de guardar.
      </p>
      <LoanForm {...(loan ? { loan } : {})} onCancel={onCancel} onSave={onSave} />
    </section>
  );
}

function LoanWorkspace({
  loan,
  activeTab,
  onChangeTab,
  onBack,
  onEdit,
  onDuplicate,
  onDelete,
  aggregate,
  chartConfiguration,
  onChartConfigurationChange,
  onSavePayment,
  onImportPayments,
  onSaveBankReset,
  onSaveScenario,
  onDeleteScenario,
}: Readonly<{
  loan: Loan | undefined;
  activeTab: LoanTab;
  onChangeTab: (tab: LoanTab) => void;
  onBack: () => void;
  onEdit: () => void;
  onDuplicate: (loan: Loan) => Promise<void>;
  onDelete: (loan: Loan) => Promise<void>;
  aggregate: LoanAggregate | undefined;
  chartConfiguration?: ChartConfiguration;
  onChartConfigurationChange: (configuration: ChartConfiguration) => void;
  onSavePayment: (payment: PaymentRecord) => Promise<void>;
  onImportPayments: (payments: readonly PaymentRecord[]) => Promise<void>;
  onSaveBankReset: (bankReset: BankReset | undefined) => Promise<void>;
  onSaveScenario: (scenario: ProjectionScenarioSnapshot) => Promise<void>;
  onDeleteScenario: (scenarioId: string) => Promise<void>;
}>) {
  if (!loan) return null;
  return (
    <section className="loan-workspace" aria-labelledby="loan-workspace-title">
      <button className="back-link" type="button" onClick={onBack}>
        ← Todos los préstamos
      </button>
      <header className="loan-workspace-header">
        <p className="eyebrow">Préstamo</p>
        <h1 id="loan-workspace-title">{loan.name}</h1>
        <p>
          Inicio: <time dateTime={loan.startDate}>{loan.startDate}</time> · {loan.periodsPerYear}{' '}
          pagos por año
        </p>
      </header>
      <nav className="loan-tabs" aria-label="Secciones del préstamo" role="tablist">
        {LOAN_TABS.map((tab) => (
          <button
            type="button"
            role="tab"
            id={`loan-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`loan-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            onKeyDown={(event) => {
              const currentIndex = LOAN_TABS.findIndex((item) => item.id === tab.id);
              const nextIndex =
                event.key === 'ArrowRight'
                  ? (currentIndex + 1) % LOAN_TABS.length
                  : event.key === 'ArrowLeft'
                    ? (currentIndex - 1 + LOAN_TABS.length) % LOAN_TABS.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? LOAN_TABS.length - 1
                        : undefined;
              if (nextIndex === undefined) return;
              event.preventDefault();
              const nextTab = LOAN_TABS[nextIndex];
              if (!nextTab) return;
              onChangeTab(nextTab.id);
              document.getElementById(`loan-tab-${nextTab.id}`)?.focus();
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div
        className="loan-tab-panel"
        id={`loan-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`loan-tab-${activeTab}`}
      >
        {activeTab === 'summary' ? <LoanSummary loan={loan} aggregate={aggregate} /> : null}
        {activeTab === 'payments' ? (
          aggregate?.loan.id === loan.id ? (
            <PaymentTools
              loan={loan}
              payments={aggregate.payments}
              {...(aggregate.bankReset ? { bankReset: aggregate.bankReset } : {})}
              onSavePayment={onSavePayment}
              onImportPayments={onImportPayments}
              onSaveBankReset={onSaveBankReset}
            />
          ) : (
            <p aria-live="polite">Cargando pagos…</p>
          )
        ) : null}
        {activeTab === 'scenarios' && aggregate?.loan.id === loan.id ? (
          <>
            <ScenarioTools
              loan={loan}
              scenarios={aggregate.scenarios}
              onSaveScenario={onSaveScenario}
              onDeleteScenario={onDeleteScenario}
            />
            <TbpScenarios scenarios={aggregate.scenarios} />
          </>
        ) : null}
        {activeTab === 'scenarios' && aggregate?.loan.id !== loan.id ? (
          <p aria-live="polite">Cargando escenarios…</p>
        ) : null}
        {activeTab === 'projection' && aggregate?.loan.id === loan.id ? (
          <ProjectionView
            loan={loan}
            payments={aggregate.payments}
            {...(aggregate.bankReset ? { bankReset: aggregate.bankReset } : {})}
            scenarios={aggregate.scenarios}
            {...(chartConfiguration ? { chartConfiguration } : {})}
            onChartConfigurationChange={onChartConfigurationChange}
          />
        ) : null}
        {activeTab === 'projection' && aggregate?.loan.id !== loan.id ? (
          <p aria-live="polite">Cargando proyección…</p>
        ) : null}
        {activeTab === 'settings' ? (
          <LoanSettings loan={loan} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
        ) : null}
      </div>
    </section>
  );
}

function LoanSummary({
  loan,
  aggregate,
}: Readonly<{ loan: Loan; aggregate: LoanAggregate | undefined }>) {
  return (
    <section className="loan-summary-view" aria-labelledby="loan-summary-title">
      <h2 id="loan-summary-title">Resumen</h2>
      <p>
        Revisa las condiciones acordadas y el costo estimado antes de registrar actividad o crear
        alternativas.
      </p>
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
      {loan.contract ? <ContractEstimateSummary loan={loan} aggregate={aggregate} /> : null}
    </section>
  );
}

function LoanSettings({
  loan,
  onEdit,
  onDuplicate,
  onDelete,
}: Readonly<{
  loan: Loan;
  onEdit: () => void;
  onDuplicate: (loan: Loan) => Promise<void>;
  onDelete: (loan: Loan) => Promise<void>;
}>) {
  return (
    <section className="loan-settings" aria-labelledby="loan-settings-title">
      <h2 id="loan-settings-title">Configuración</h2>
      <p>
        Actualiza las condiciones del préstamo sin mezclar esta tarea con su seguimiento diario.
      </p>
      <div className="form-actions">
        <button type="button" onClick={onEdit}>
          Editar préstamo
        </button>
        <button type="button" onClick={() => void onDuplicate(loan)}>
          Duplicar préstamo
        </button>
      </div>
      <section className="danger-zone" aria-labelledby="danger-zone-title">
        <h3 id="danger-zone-title">Zona de riesgo</h3>
        <p>Eliminar borra el préstamo, sus pagos y sus escenarios de este dispositivo.</p>
        <button type="button" onClick={() => void onDelete(loan)}>
          Eliminar préstamo
        </button>
      </section>
    </section>
  );
}

function ContractEstimateSummary({
  loan,
  aggregate,
}: Readonly<{ loan: Loan; aggregate: LoanAggregate | undefined }>) {
  const result = useMemo(() => {
    try {
      return {
        estimate: estimateLoanContract(
          loan,
          aggregate?.bankReset ? { bankReset: aggregate.bankReset } : {},
        ),
      };
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : 'No se pudo estimar el préstamo.' };
    }
  }, [aggregate?.bankReset, loan]);

  if ('error' in result) return <p role="alert">{result.error}</p>;
  return (
    <EstimateSummary loan={loan} estimate={result.estimate} {...(aggregate ? { aggregate } : {})} />
  );
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
