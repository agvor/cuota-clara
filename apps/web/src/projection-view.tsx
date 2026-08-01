import { useEffect, useMemo, useState } from 'react';

import {
  compareLoanWithOneTimeExtraPayment,
  compareLoanWithRecurringExtraPayment,
  estimateLoanContract,
  isOneTimeExtraPaymentScenario,
  isRecurringExtraPaymentScenario,
  projectLoanAmortization,
  type Loan,
  type BankReset,
  type PaymentRecord,
  type ProjectionScenarioSnapshot,
  type ScenarioProjectionContext,
} from '@cuotaclara/domain';

import { formatCompactMoney, formatMoney } from './money-format.js';
import { createScenarioProjectionContext } from './scenario-projection-context.js';

const PAGE_SIZE = 24;
const CHART = { left: 94, right: 770, top: 30, bottom: 276 } as const;

const SERIES = [
  { id: 'balance', label: 'Saldo' },
  { id: 'payment', label: 'Cuota total' },
  { id: 'interest', label: 'Interés' },
  { id: 'principal', label: 'Aporte total a principal' },
  { id: 'extra', label: 'Aporte extraordinario a principal' },
] as const;

type SortDirection = 'ascending' | 'descending';
export type ChartSeriesId = (typeof SERIES)[number]['id'];
type SelectedSeries = Readonly<Record<ChartSeriesId, boolean>>;
export type ChartConfiguration = Readonly<{
  rangeStartDate?: string;
  rangeEndDate?: string;
  selectedSeries?: Readonly<Partial<Record<ChartSeriesId, boolean>>>;
  firstScenarioId?: string;
  secondScenarioId?: string;
  lockedPeriodNumber?: number;
}>;
type ComparableScenario = ProjectionScenarioSnapshot;
type DisplayProjectionPeriod = Readonly<{
  period: number;
  date: string;
  openingBalance: Loan['initialBalance'];
  interest: Loan['initialBalance'];
  principal: Loan['initialBalance'];
  ordinaryPrincipal: Loan['initialBalance'];
  extraordinaryPrincipal: Loan['initialBalance'];
  payment: Loan['initialBalance'];
  closingBalance: Loan['initialBalance'];
}>;
type HistoricalTableRow =
  | Readonly<{ kind: 'payment'; date: string; payment: PaymentRecord }>
  | Readonly<{
      kind: 'reconciliation';
      date: string;
      adjustment: NonNullable<BankReset['adjustment']>;
      reportedBalance: Loan['initialBalance'];
    }>;
type AmortizationTableRow =
  | HistoricalTableRow
  | Readonly<{ kind: 'projection'; date: string; period: DisplayProjectionPeriod }>;
type ChartPoint = Readonly<{
  period: DisplayProjectionPeriod;
  value: Loan['initialBalance'];
  x: number;
  y: number;
}>;
type ChartValues = Readonly<Record<ChartSeriesId, readonly Loan['initialBalance'][]>>;
type ChartSource = Readonly<{
  id: string;
  label: string;
  sourceClass: 'base' | 'scenario-first' | 'scenario-second';
  values: ChartValues;
}>;
type ChartLine = Readonly<{
  source: ChartSource;
  series: (typeof SERIES)[number];
  points: readonly ChartPoint[];
}>;

export function ProjectionView({
  loan,
  payments,
  bankReset,
  scenarios = [],
  chartConfiguration,
  onChartConfigurationChange,
}: Readonly<{
  loan: Loan;
  payments: readonly PaymentRecord[];
  bankReset?: BankReset;
  scenarios?: readonly ProjectionScenarioSnapshot[];
  chartConfiguration?: ChartConfiguration;
  onChartConfigurationChange?: (configuration: ChartConfiguration) => void;
}>) {
  const [page, setPage] = useState(0);
  const [sortDirection, setSortDirection] = useState<SortDirection>('ascending');
  const [selectedTableSourceId, setSelectedTableSourceId] = useState('base');
  const result = useMemo(() => {
    try {
      const periods: readonly DisplayProjectionPeriod[] = loan.contract
        ? estimateLoanContract(
            loan,
            bankReset ? { bankReset } : payments.length ? { historicalPayments: payments } : {},
          ).periods.map((period) => ({
            period: period.period,
            date: period.date,
            openingBalance: period.openingBalance,
            interest: period.interest,
            principal: period.principal,
            ordinaryPrincipal: period.principal,
            extraordinaryPrincipal: zeroMoney(loan),
            payment: period.totalDue,
            closingBalance: period.closingBalance,
          }))
        : projectLoanAmortization(loan).periods.map((period) => ({
            period: period.period,
            date: period.date,
            openingBalance: period.openingBalance,
            interest: period.interest,
            principal: period.principal,
            ordinaryPrincipal: period.principal.subtract(period.extraPayment),
            extraordinaryPrincipal: period.extraPayment,
            payment: period.payment,
            closingBalance: period.closingBalance,
          }));
      return { periods };
    } catch (cause) {
      return {
        error: cause instanceof Error ? cause.message : 'No se pudo generar la proyección.',
      };
    }
  }, [bankReset, loan, payments]);
  if ('error' in result)
    return (
      <section className="projection-view">
        <h3>Proyección</h3>
        <p role="alert">{result.error}</p>
      </section>
    );

  const hasHistoricalContinuation = payments.length > 0 && !bankReset;
  const scenarioProjectionContext = useMemo(() => {
    try {
      return createScenarioProjectionContext({
        loan,
        payments,
        ...(bankReset ? { bankReset } : {}),
      });
    } catch {
      return undefined;
    }
  }, [bankReset, loan, payments]);
  const comparableScenarios = scenarios.filter(isComparableScenario);
  const historicalBalances = historicalClosingBalances(payments, loan);
  const selectedScenario = comparableScenarios.find(
    (scenario) => scenario.id === selectedTableSourceId,
  );
  const tableSourceId =
    selectedScenario || selectedTableSourceId === 'base' ? selectedTableSourceId : 'base';
  let tableProjectionLabel = 'Configuración base';
  let tableProjectionPeriods = result.periods;
  let tableProjectionError: string | undefined;
  let isScenarioProjection = Boolean(selectedScenario);
  if (selectedScenario) {
    tableProjectionLabel = selectedScenario.name;
    try {
      tableProjectionPeriods = displayScenarioPeriods(
        compareScenario(loan, selectedScenario, scenarioProjectionContext).alternative.periods,
        loan,
      );
    } catch (cause) {
      tableProjectionLabel = 'Configuración base';
      tableProjectionPeriods = result.periods;
      isScenarioProjection = false;
      tableProjectionError =
        cause instanceof Error ? cause.message : 'No se pudo generar la proyección del escenario.';
    }
  }
  const historicalRows: readonly HistoricalTableRow[] = [
    ...payments.map((payment) => ({ kind: 'payment' as const, date: payment.date, payment })),
    ...(bankReset?.adjustment
      ? [
          {
            kind: 'reconciliation' as const,
            date: bankReset.adjustment.date,
            adjustment: bankReset.adjustment,
            reportedBalance: bankReset.reportedBalance,
          },
        ]
      : []),
  ];
  const orderedTableRows: readonly AmortizationTableRow[] = [
    ...historicalRows,
    ...tableProjectionPeriods.map((period) => ({
      kind: 'projection' as const,
      date: period.date,
      period,
    })),
  ].sort((left, right) =>
    sortDirection === 'ascending'
      ? left.date.localeCompare(right.date)
      : right.date.localeCompare(left.date),
  );
  const start = page * PAGE_SIZE;
  const visibleTableRows = orderedTableRows.slice(start, start + PAGE_SIZE);
  const pages = Math.ceil(orderedTableRows.length / PAGE_SIZE);
  const nextSortDirection = sortDirection === 'ascending' ? 'descending' : 'ascending';

  function toggleDateSort() {
    setSortDirection(nextSortDirection);
    setPage(0);
  }

  return (
    <section className="projection-view" aria-labelledby="projection-title">
      <h3 id="projection-title">Evolución del saldo</h3>
      <p>
        Los pagos históricos aparecen como registros reales; la proyección contractual se muestra
        por separado.
      </p>
      {bankReset ? (
        <p className="reconciliation-note" role="status">
          La proyección inicia con el saldo bancario del {bankReset.cutoffDate} y recalcula la cuota
          hasta {bankReset.bankFinalInstallmentDate}. Los escenarios también parten de ese saldo.
        </p>
      ) : null}
      {hasHistoricalContinuation ? (
        <p className="reconciliation-note" role="status">
          La proyección inicia después del último pago histórico y usa el saldo reconstruido con sus
          aportes a principal; los escenarios usan el mismo punto de partida. Configura un reset
          bancario si el saldo informado por la entidad es distinto.
        </p>
      ) : null}
      <BalanceChart
        loan={loan}
        payments={payments}
        {...(bankReset ? { bankReset } : {})}
        periods={result.periods}
        scenarios={comparableScenarios}
        {...(scenarioProjectionContext ? { scenarioProjectionContext } : {})}
        {...(chartConfiguration ? { chartConfiguration } : {})}
        {...(onChartConfigurationChange ? { onChartConfigurationChange } : {})}
      />
      <div className="table-projection-controls">
        <label>
          Mostrar en la tabla
          <select
            value={tableSourceId}
            onChange={(event) => {
              setSelectedTableSourceId(event.target.value);
              setPage(0);
            }}
          >
            <option value="base">Configuración base</option>
            {comparableScenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {tableProjectionError ? <p role="alert">{tableProjectionError}</p> : null}
      <div className="table-scroll">
        <table className="financial-table financial-table-projection">
          <caption>
            Historial y proyección de amortización — {tableProjectionLabel}
            <span className="projection-table-key">
              H: histórico · P: proyección · R: ajuste de reconciliación
            </span>
          </caption>
          <thead>
            <tr>
              <th scope="col">Origen</th>
              <th
                scope="col"
                aria-sort={sortDirection === 'ascending' ? 'ascending' : 'descending'}
              >
                <button
                  className="table-sort-button"
                  type="button"
                  onClick={toggleDateSort}
                  aria-label={`Ordenar cuotas por fecha ${nextSortDirection === 'ascending' ? 'ascendente' : 'descendente'}`}
                >
                  Fecha <span aria-hidden="true">{sortDirection === 'ascending' ? '↑' : '↓'}</span>
                </button>
              </th>
              <th scope="col">Pago</th>
              <th scope="col">Interés</th>
              <th scope="col" aria-label="Principal total">
                Ppal. total
              </th>
              <th scope="col" aria-label="Principal ordinario">
                Ppal. ord.
              </th>
              <th scope="col" aria-label="Principal extraordinario">
                Ppal. extra
              </th>
              <th scope="col" aria-label="Saldo final">
                Saldo
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleTableRows.map((row) =>
              row.kind === 'payment' ? (
                <tr className="historical-row" key={`historical-${row.payment.id}`}>
                  <td aria-label="Histórico" title="Histórico">
                    H
                  </td>
                  <td>{row.payment.date}</td>
                  <td>{formatMoney(row.payment.totalAmount, loan.roundingPolicy)}</td>
                  <td>
                    {row.payment.interestAmount
                      ? formatMoney(row.payment.interestAmount, loan.roundingPolicy)
                      : '—'}
                  </td>
                  <td>
                    {row.payment.principalAmount
                      ? formatMoney(
                          row.payment.principalAmount.add(
                            row.payment.extraPrincipalAmount ?? zeroMoney(loan),
                          ),
                          loan.roundingPolicy,
                        )
                      : 'Pendiente'}
                  </td>
                  <td>
                    {row.payment.principalAmount
                      ? formatMoney(row.payment.principalAmount, loan.roundingPolicy)
                      : 'Pendiente'}
                  </td>
                  <td>
                    {row.payment.extraPrincipalAmount
                      ? formatMoney(row.payment.extraPrincipalAmount, loan.roundingPolicy)
                      : formatMoney(zeroMoney(loan), loan.roundingPolicy)}
                  </td>
                  <td>
                    {historicalBalances.get(row.payment.id)
                      ? formatMoney(historicalBalances.get(row.payment.id)!, loan.roundingPolicy)
                      : '—'}
                  </td>
                </tr>
              ) : row.kind === 'reconciliation' ? (
                <tr
                  className="historical-row reconciliation-row"
                  key={`reset-${row.adjustment.id}`}
                >
                  <td aria-label="Ajuste de reconciliación" title="Ajuste de reconciliación">
                    R
                  </td>
                  <td>{row.adjustment.date}</td>
                  <td>{formatMoney(row.adjustment.principalAmount, loan.roundingPolicy)}</td>
                  <td>—</td>
                  <td>{formatMoney(row.adjustment.principalAmount, loan.roundingPolicy)}</td>
                  <td>—</td>
                  <td>{formatMoney(row.adjustment.principalAmount, loan.roundingPolicy)}</td>
                  <td>{formatMoney(row.reportedBalance, loan.roundingPolicy)}</td>
                </tr>
              ) : (
                <tr className="projection-row" key={`projection-${row.period.period}`}>
                  <td
                    aria-label={
                      isScenarioProjection ? 'Proyección de escenario' : 'Proyección base'
                    }
                    title={isScenarioProjection ? 'Proyección de escenario' : 'Proyección base'}
                  >
                    P
                  </td>
                  <td>{row.period.date}</td>
                  <td>{formatMoney(row.period.payment, loan.roundingPolicy)}</td>
                  <td>{formatMoney(row.period.interest, loan.roundingPolicy)}</td>
                  <td>{formatMoney(row.period.principal, loan.roundingPolicy)}</td>
                  <td>{formatMoney(row.period.ordinaryPrincipal, loan.roundingPolicy)}</td>
                  <td>{formatMoney(row.period.extraordinaryPrincipal, loan.roundingPolicy)}</td>
                  <td>{formatMoney(row.period.closingBalance, loan.roundingPolicy)}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav className="pagination" aria-label="Paginación de amortización">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((current) => current - 1)}
          >
            Anterior
          </button>
          <span>
            Página {page + 1} de {pages}
          </span>
          <button
            type="button"
            disabled={page + 1 === pages}
            onClick={() => setPage((current) => current + 1)}
          >
            Siguiente
          </button>
        </nav>
      ) : null}
    </section>
  );
}

function BalanceChart({
  loan,
  payments,
  bankReset,
  periods,
  scenarios,
  scenarioProjectionContext,
  chartConfiguration,
  onChartConfigurationChange,
}: Readonly<{
  loan: Loan;
  payments: readonly PaymentRecord[];
  bankReset?: BankReset;
  periods: readonly DisplayProjectionPeriod[];
  scenarios: readonly ProjectionScenarioSnapshot[];
  scenarioProjectionContext?: ScenarioProjectionContext;
  chartConfiguration?: ChartConfiguration;
  onChartConfigurationChange?: (configuration: ChartConfiguration) => void;
}>) {
  const historicalPeriods = historicalChartPeriods(payments, bankReset, loan);
  const allPeriods = [...historicalPeriods, ...periods].map((period, index) => ({
    ...period,
    period: index + 1,
  }));
  const totalStartDate = allPeriods[0]?.date ?? '';
  const totalEndDate = allPeriods.at(-1)?.date ?? '';
  const savedRangeStartDate = chartConfiguration?.rangeStartDate;
  const savedRangeEndDate = chartConfiguration?.rangeEndDate;
  const [rangeStartDate, setRangeStartDate] = useState(() =>
    savedRangeStartDate &&
    savedRangeStartDate >= totalStartDate &&
    savedRangeStartDate <= totalEndDate
      ? savedRangeStartDate
      : totalStartDate,
  );
  const [rangeEndDate, setRangeEndDate] = useState(() =>
    savedRangeEndDate && savedRangeEndDate >= totalStartDate && savedRangeEndDate <= totalEndDate
      ? savedRangeEndDate
      : totalEndDate,
  );
  const [hoveredPeriod, setHoveredPeriod] = useState<DisplayProjectionPeriod>();
  const [lockedPeriod, setLockedPeriod] = useState<DisplayProjectionPeriod | undefined>(() =>
    chartConfiguration?.lockedPeriodNumber
      ? allPeriods.find((period) => period.period === chartConfiguration.lockedPeriodNumber)
      : undefined,
  );
  const [selectedSeries, setSelectedSeries] = useState<SelectedSeries>(() => ({
    balance: true,
    payment: false,
    interest: false,
    principal: false,
    extra: false,
    ...chartConfiguration?.selectedSeries,
  }));
  const [firstScenarioId, setFirstScenarioId] = useState(chartConfiguration?.firstScenarioId ?? '');
  const [secondScenarioId, setSecondScenarioId] = useState(
    chartConfiguration?.secondScenarioId ?? '',
  );
  const visiblePeriods = allPeriods.filter(
    (period) => period.date >= rangeStartDate && period.date <= rangeEndDate,
  );
  const startPeriod = visiblePeriods[0];
  const endPeriod = visiblePeriods.at(-1);

  const comparableScenarios = scenarios.filter(isComparableScenario);
  const scenarioSources: readonly ChartSource[] = [firstScenarioId, secondScenarioId]
    .map((id) => comparableScenarios.find((scenario) => scenario.id === id))
    .filter((scenario): scenario is ComparableScenario => Boolean(scenario))
    .flatMap((scenario, index) => {
      try {
        const comparison = compareScenario(loan, scenario, scenarioProjectionContext);
        return [
          {
            id: scenario.id,
            label: scenario.name,
            sourceClass: index === 0 ? 'scenario-first' : 'scenario-second',
            values: valuesFromProjectionPeriods(
              displayScenarioPeriods(comparison.alternative.periods, loan),
              visiblePeriods,
              loan,
            ),
          } satisfies ChartSource,
        ];
      } catch {
        return [];
      }
    });
  const baseValues: ChartValues = {
    balance: visiblePeriods.map((period) => period.closingBalance),
    payment: visiblePeriods.map((period) => period.payment),
    interest: visiblePeriods.map((period) => period.interest),
    principal: visiblePeriods.map((period) => period.principal),
    extra: visiblePeriods.map((period) => period.extraordinaryPrincipal),
  };
  const sources: readonly ChartSource[] = [
    { id: 'base', label: 'Configuración base', sourceClass: 'base', values: baseValues },
    ...scenarioSources,
  ];
  const activeSeries = SERIES.filter((series) => selectedSeries[series.id]);
  const maximumValue = findMaximumValue(
    sources.flatMap((source) => activeSeries.flatMap((series) => source.values[series.id])),
    loan,
  );
  const maximumValueAsNumber = Math.max(Number(maximumValue.toDecimalString()), 1);
  const chartLines: readonly ChartLine[] = sources.flatMap((source) =>
    activeSeries.map((series) => ({
      source,
      series,
      points: toChartPoints(visiblePeriods, source.values[series.id], maximumValueAsNumber),
    })),
  );
  const interactionPoints =
    chartLines.find((line) => line.source.sourceClass === 'base' && line.series.id === 'balance')
      ?.points ??
    chartLines[0]?.points ??
    [];
  const inspectedPeriod = lockedPeriod ?? hoveredPeriod;
  const inspectedLines = chartLines.filter((line) =>
    line.points.some((point) => point.period.period === inspectedPeriod?.period),
  );
  const horizontalTicks = [0, 0.25, 0.5, 0.75, 1];
  const temporalTicks = [0, 0.25, 0.5, 0.75, 1];
  const firstProjectedPeriod = allPeriods[historicalPeriods.length];
  const visibleProjectedIndex = firstProjectedPeriod
    ? visiblePeriods.findIndex((period) => period.period === firstProjectedPeriod.period)
    : -1;

  useEffect(() => {
    onChartConfigurationChange?.({
      rangeStartDate,
      rangeEndDate,
      selectedSeries,
      firstScenarioId,
      secondScenarioId,
      ...(lockedPeriod ? { lockedPeriodNumber: lockedPeriod.period } : {}),
    });
  }, [
    firstScenarioId,
    lockedPeriod,
    onChartConfigurationChange,
    rangeEndDate,
    rangeStartDate,
    secondScenarioId,
    selectedSeries,
  ]);

  if (!startPeriod || !endPeriod) return null;

  function inspectClosestPoint(clientX: number, chartLeft: number, chartWidth: number) {
    if (lockedPeriod) return;
    const firstPoint = interactionPoints[0];
    if (!firstPoint || chartWidth === 0) return;
    const x = ((clientX - chartLeft) / chartWidth) * 800;
    let closestPoint = firstPoint;
    for (const point of interactionPoints) {
      if (Math.abs(point.x - x) < Math.abs(closestPoint.x - x)) closestPoint = point;
    }
    if (closestPoint.period.period !== hoveredPeriod?.period) setHoveredPeriod(closestPoint.period);
  }

  function toggleSeries(id: ChartSeriesId) {
    setSelectedSeries((current) => {
      if (current[id] && activeSeries.length === 1) return current;
      return { ...current, [id]: !current[id] };
    });
  }

  function togglePointLock() {
    setLockedPeriod((current) =>
      current ? undefined : (hoveredPeriod ?? interactionPoints[0]?.period),
    );
  }

  function resetChartRange() {
    setRangeStartDate(totalStartDate);
    setRangeEndDate(totalEndDate);
    setHoveredPeriod(undefined);
    setLockedPeriod(undefined);
  }

  function setChartRangeStart(value: string) {
    setRangeStartDate(value);
    if (value > rangeEndDate) setRangeEndDate(value);
    setHoveredPeriod(undefined);
    setLockedPeriod(undefined);
  }

  function setChartRangeEnd(value: string) {
    setRangeEndDate(value);
    if (value < rangeStartDate) setRangeStartDate(value);
    setHoveredPeriod(undefined);
    setLockedPeriod(undefined);
  }

  return (
    <figure className="balance-chart">
      <div className="chart-controls">
        <div className="chart-range-controls" aria-label="Rango del gráfico">
          <label>
            Desde
            <input
              type="date"
              value={rangeStartDate}
              min={totalStartDate}
              max={rangeEndDate}
              onChange={(event) => setChartRangeStart(event.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={rangeEndDate}
              min={rangeStartDate}
              max={totalEndDate}
              onChange={(event) => setChartRangeEnd(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={resetChartRange}
            disabled={rangeStartDate === totalStartDate && rangeEndDate === totalEndDate}
          >
            Restablecer todo el plazo
          </button>
        </div>
        <p>
          Desplaza el cursor para inspeccionar una cuota; haz clic para fijar o liberar el punto.
        </p>
      </div>
      <p className="chart-range-status" aria-live="polite">
        Mostrando {visiblePeriods.length} {visiblePeriods.length === 1 ? 'periodo' : 'periodos'}:{' '}
        {startPeriod.date} a {endPeriod.date}.
      </p>
      <fieldset className="chart-series" aria-label="Series del gráfico">
        <legend>Señales visibles en base y escenarios</legend>
        {SERIES.map((series) => (
          <label key={series.id}>
            <input
              type="checkbox"
              checked={selectedSeries[series.id]}
              onChange={() => toggleSeries(series.id)}
            />{' '}
            {series.label}
          </label>
        ))}
      </fieldset>
      {comparableScenarios.length ? (
        <fieldset
          className="chart-series scenario-comparison-selector"
          aria-label="Escenarios comparados"
        >
          <legend>Comparar escenarios</legend>
          <label>
            Escenario A
            <select
              value={firstScenarioId}
              onChange={(event) => setFirstScenarioId(event.target.value)}
            >
              <option value="">No mostrar</option>
              {comparableScenarios.map((scenario) => (
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
              {comparableScenarios.map((scenario) => (
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
        </fieldset>
      ) : null}
      <svg
        viewBox="0 0 800 330"
        role="img"
        aria-labelledby="balance-chart-title"
        aria-describedby="balance-chart-description"
        tabIndex={0}
        onClick={togglePointLock}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          togglePointLock();
        }}
        onPointerLeave={() => {
          if (!lockedPeriod) setHoveredPeriod(undefined);
        }}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          inspectClosestPoint(event.clientX, bounds.left, bounds.width);
        }}
      >
        <title id="balance-chart-title">Evolución estimada del saldo</title>
        <desc id="balance-chart-description">
          Cada señal seleccionada se muestra desde {startPeriod.date} hasta {endPeriod.date}. El eje
          vertical usa la moneda del préstamo y el horizontal representa las fechas de los pagos y
          cuotas.
        </desc>
        {horizontalTicks.map((fraction) => {
          const y = CHART.bottom - fraction * (CHART.bottom - CHART.top);
          const value = maximumValue.multiplyBy(fraction.toString());
          return (
            <g key={`horizontal-${fraction}`}>
              <line className="chart-grid" x1={CHART.left} x2={CHART.right} y1={y} y2={y} />
              <text className="chart-label" x={CHART.left - 10} y={y + 4} textAnchor="end">
                {formatCompactMoney(value, loan.roundingPolicy)}
              </text>
            </g>
          );
        })}
        {temporalTicks.map((fraction) => {
          const index = Math.round(fraction * Math.max(visiblePeriods.length - 1, 0));
          const period = visiblePeriods[index];
          const x = CHART.left + fraction * (CHART.right - CHART.left);
          if (!period) return null;
          return (
            <g key={`vertical-${fraction}`}>
              <line
                className="chart-grid vertical"
                x1={x}
                x2={x}
                y1={CHART.top}
                y2={CHART.bottom}
              />
              <text className="chart-label" x={x} y={CHART.bottom + 25} textAnchor="middle">
                {formatChartDate(period.date)}
              </text>
            </g>
          );
        })}
        <line
          className="chart-axis"
          x1={CHART.left}
          x2={CHART.right}
          y1={CHART.bottom}
          y2={CHART.bottom}
        />
        {visibleProjectedIndex > 0 ? (
          <line
            className="chart-history-divider"
            x1={
              CHART.left +
              (visibleProjectedIndex / Math.max(visiblePeriods.length - 1, 1)) *
                (CHART.right - CHART.left)
            }
            x2={
              CHART.left +
              (visibleProjectedIndex / Math.max(visiblePeriods.length - 1, 1)) *
                (CHART.right - CHART.left)
            }
            y1={CHART.top}
            y2={CHART.bottom}
          />
        ) : null}
        <line
          className="chart-axis"
          x1={CHART.left}
          x2={CHART.left}
          y1={CHART.top}
          y2={CHART.bottom}
        />
        {chartLines.map((line) => (
          <polyline
            className={`chart-signal-line ${line.series.id} source-${line.source.sourceClass}`}
            key={`${line.source.id}-${line.series.id}`}
            points={line.points.map((point) => `${point.x},${point.y}`).join(' ')}
          />
        ))}
        {interactionPoints.map((point) => (
          <circle
            aria-label={`Cuota ${point.period.period}, ${point.period.date}`}
            className="chart-point-target"
            cx={point.x}
            cy={point.y}
            key={point.period.period}
            r="8"
            tabIndex={0}
            onFocus={() => {
              if (!lockedPeriod) setHoveredPeriod(point.period);
            }}
            onPointerEnter={() => {
              if (!lockedPeriod) setHoveredPeriod(point.period);
            }}
          />
        ))}
        {inspectedLines.flatMap((line) =>
          line.points
            .filter((point) => point.period.period === inspectedPeriod?.period)
            .map((point) => (
              <circle
                className={`chart-point-highlight ${line.series.id} source-${line.source.sourceClass}`}
                cx={point.x}
                cy={point.y}
                key={`highlight-${line.source.id}-${line.series.id}-${point.period.period}`}
                r="5"
              />
            )),
        )}
      </svg>
      <figcaption className="chart-legend">
        <section aria-label="Colores de señales">
          <h4>Color · señal</h4>
          <div>
            {activeSeries.map((series) => (
              <span className={`legend signal-${series.id}`} key={series.id}>
                {series.label}
              </span>
            ))}
          </div>
        </section>
        <section aria-label="Trazos de fuentes">
          <h4>Trazo · fuente</h4>
          <div>
            {sources.map((source) => (
              <span className={`legend source-${source.sourceClass}`} key={source.id}>
                {source.label}
              </span>
            ))}
          </div>
        </section>
        <p>
          La base usa la tonalidad más intensa y línea continua; los escenarios conservan el color
          de cada señal y se distinguen por punteado.
        </p>
      </figcaption>
      <p className="chart-lock-status" aria-live="polite">
        {lockedPeriod
          ? `Punto fijado en cuota ${lockedPeriod.period}. Haz clic en el gráfico para liberarlo.`
          : 'Punto móvil: haz clic en el gráfico para fijarlo.'}
      </p>
      <ChartPointDetails
        loan={loan}
        period={inspectedPeriod}
        visiblePeriods={visiblePeriods}
        sources={sources}
        activeSeries={activeSeries}
        isLocked={Boolean(lockedPeriod)}
      />
    </figure>
  );
}

function ChartPointDetails({
  loan,
  period,
  visiblePeriods,
  sources,
  activeSeries,
  isLocked,
}: Readonly<{
  loan: Loan;
  period: DisplayProjectionPeriod | undefined;
  visiblePeriods: readonly DisplayProjectionPeriod[];
  sources: readonly ChartSource[];
  activeSeries: readonly (typeof SERIES)[number][];
  isLocked: boolean;
}>) {
  if (!period)
    return (
      <p className="chart-point-details" aria-live="polite">
        Selecciona un punto para ver el detalle de la cuota.
      </p>
    );
  return (
    <div className="chart-point-details" aria-live="polite">
      <strong>
        Cuota {period.period} · {period.date}
        {isLocked ? ' · Punto fijado' : ''}
      </strong>
      <div className="table-scroll chart-point-table-scroll">
        <table className="financial-table financial-table-chart chart-point-table">
          <caption>Comparación de señales activas en la cuota {period.period}</caption>
          <thead>
            <tr>
              <th scope="col">Señal</th>
              {sources.map((source) => (
                <th className={`source-${source.sourceClass}`} key={source.id} scope="col">
                  {source.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeSeries.map((series) => {
              const periodIndex = visiblePeriods.findIndex((item) => item.period === period.period);
              return (
                <tr key={series.id}>
                  <th className={`signal-${series.id}`} scope="row">
                    {series.label}
                  </th>
                  {sources.map((source) => (
                    <td key={source.id}>
                      {formatMoney(
                        source.values[series.id][periodIndex] ?? zeroMoney(loan),
                        loan.roundingPolicy,
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function valuesFromProjectionPeriods(
  projectionPeriods: readonly DisplayProjectionPeriod[],
  visiblePeriods: readonly DisplayProjectionPeriod[],
  loan: Loan,
): ChartValues {
  const projectionStartDate = projectionPeriods[0]?.date;
  const valuesFor = (
    select: (period: (typeof projectionPeriods)[number]) => Loan['initialBalance'],
    selectHistorical: (period: DisplayProjectionPeriod) => Loan['initialBalance'],
  ): readonly Loan['initialBalance'][] =>
    visiblePeriods.map((visiblePeriod) => {
      const projectionPeriod = projectionPeriods.find(
        (period) => period.date === visiblePeriod.date,
      );
      if (projectionPeriod) return select(projectionPeriod);
      return projectionStartDate && visiblePeriod.date < projectionStartDate
        ? selectHistorical(visiblePeriod)
        : zeroMoney(loan);
    });
  return {
    balance: valuesFor(
      (period) => period.closingBalance,
      (period) => period.closingBalance,
    ),
    payment: valuesFor(
      (period) => period.payment,
      (period) => period.payment,
    ),
    interest: valuesFor(
      (period) => period.interest,
      (period) => period.interest,
    ),
    principal: valuesFor(
      (period) => period.principal,
      (period) => period.principal,
    ),
    extra: valuesFor(
      (period) => period.extraordinaryPrincipal,
      (period) => period.extraordinaryPrincipal,
    ),
  };
}

function displayScenarioPeriods(
  periods: readonly Readonly<{
    period: number;
    date: string;
    openingBalance: Loan['initialBalance'];
    interest: Loan['initialBalance'];
    principal: Loan['initialBalance'];
    extraPayment: Loan['initialBalance'];
    payment: Loan['initialBalance'];
    closingBalance: Loan['initialBalance'];
  }>[],
  loan: Loan,
): readonly DisplayProjectionPeriod[] {
  const insurance = loan.contract?.monthlyInsurance ?? zeroMoney(loan);
  return periods.map((period) => ({
    period: period.period,
    date: period.date,
    openingBalance: period.openingBalance,
    interest: period.interest,
    principal: period.principal,
    ordinaryPrincipal: period.principal.subtract(period.extraPayment),
    extraordinaryPrincipal: period.extraPayment,
    payment: period.payment.add(insurance),
    closingBalance: period.closingBalance,
  }));
}

function toChartPoints(
  periods: readonly DisplayProjectionPeriod[],
  values: readonly Loan['initialBalance'][],
  maximumValue: number,
): readonly ChartPoint[] {
  const denominator = Math.max(periods.length - 1, 1);
  return periods.flatMap((period, index) => {
    const value = values[index];
    if (!value) return [];
    return {
      period,
      value,
      x: CHART.left + (index / denominator) * (CHART.right - CHART.left),
      y:
        CHART.top +
        (1 - Math.max(0, Math.min(Number(value.toDecimalString()), maximumValue)) / maximumValue) *
          (CHART.bottom - CHART.top),
    };
  });
}

function zeroMoney(loan: Loan): Loan['initialBalance'] {
  return loan.initialBalance.subtract(loan.initialBalance);
}

function findMaximumValue(
  values: readonly Loan['initialBalance'][],
  loan: Loan,
): Loan['initialBalance'] {
  return values.reduce(
    (maximum, value) => (maximum.isLessThan(value) ? value : maximum),
    zeroMoney(loan),
  );
}

function historicalChartPeriods(
  payments: readonly PaymentRecord[],
  bankReset: BankReset | undefined,
  loan: Loan,
): readonly DisplayProjectionPeriod[] {
  const zero = zeroMoney(loan);
  let balance = loan.initialBalance;
  const historical = [...payments]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((payment, index) => {
      const ordinaryPrincipal = payment.principalAmount ?? zero;
      const extraordinaryPrincipal = payment.extraPrincipalAmount ?? zero;
      const principal = ordinaryPrincipal.add(extraordinaryPrincipal);
      const closingBalance = balance.isLessThan(principal) ? balance : balance.subtract(principal);
      const period = {
        period: index + 1,
        date: payment.date,
        openingBalance: balance,
        interest: payment.interestAmount ?? zero,
        principal,
        ordinaryPrincipal,
        extraordinaryPrincipal,
        payment: payment.totalAmount,
        closingBalance,
      } satisfies DisplayProjectionPeriod;
      balance = closingBalance;
      return period;
    });
  if (!bankReset?.adjustment) return historical;
  return [
    ...historical,
    {
      period: historical.length + 1,
      date: bankReset.adjustment.date,
      openingBalance: balance,
      interest: zero,
      principal: bankReset.adjustment.principalAmount,
      ordinaryPrincipal: zero,
      extraordinaryPrincipal: bankReset.adjustment.principalAmount,
      payment: bankReset.adjustment.principalAmount,
      closingBalance: bankReset.reportedBalance,
    },
  ];
}

function historicalClosingBalances(
  payments: readonly PaymentRecord[],
  loan: Loan,
): ReadonlyMap<string, Loan['initialBalance']> {
  const balances = new Map<string, Loan['initialBalance']>();
  let balance = loan.initialBalance;
  for (const payment of [...payments].sort((left, right) => left.date.localeCompare(right.date))) {
    if (!payment.principalAmount) continue;
    const appliedPrincipal = payment.principalAmount.add(
      payment.extraPrincipalAmount ?? zeroMoney(loan),
    );
    if (balance.isLessThan(appliedPrincipal)) continue;
    balance = balance.subtract(appliedPrincipal);
    balances.set(payment.id, balance);
  }
  return balances;
}

function isComparableScenario(
  scenario: ProjectionScenarioSnapshot,
): scenario is ComparableScenario {
  return isOneTimeExtraPaymentScenario(scenario) || isRecurringExtraPaymentScenario(scenario);
}

function compareScenario(
  loan: Loan,
  scenario: ComparableScenario,
  scenarioProjectionContext?: ScenarioProjectionContext,
) {
  if (isOneTimeExtraPaymentScenario(scenario)) {
    return compareLoanWithOneTimeExtraPayment({
      loan,
      scenario,
      ...(scenarioProjectionContext ? { projectionContext: scenarioProjectionContext } : {}),
    });
  }
  if (isRecurringExtraPaymentScenario(scenario)) {
    return compareLoanWithRecurringExtraPayment({
      loan,
      scenario,
      ...(scenarioProjectionContext ? { projectionContext: scenarioProjectionContext } : {}),
    });
  }
  throw new Error('El escenario no se puede comparar.');
}

function formatChartDate(date: string): string {
  return date.slice(0, 7);
}
