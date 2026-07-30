import { useMemo, useState } from 'react';

import {
  compareLoanWithOneTimeExtraPayment,
  compareLoanWithRecurringExtraPayment,
  estimateLoanContract,
  isOneTimeExtraPaymentScenario,
  isRecurringExtraPaymentScenario,
  projectLoanAmortization,
  type Loan,
  type PaymentRecord,
  type ProjectionScenarioSnapshot,
} from '@cuotaclara/domain';

import { formatCompactMoney, formatMoney } from './money-format.js';

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
type SeriesId = (typeof SERIES)[number]['id'];
type SelectedSeries = Readonly<Record<SeriesId, boolean>>;
type ComparableScenario = ProjectionScenarioSnapshot;
type DisplayProjectionPeriod = Readonly<{
  period: number;
  date: string;
  openingBalance: Loan['initialBalance'];
  interest: Loan['initialBalance'];
  principal: Loan['initialBalance'];
  payment: Loan['initialBalance'];
  closingBalance: Loan['initialBalance'];
}>;
type ChartPoint = Readonly<{
  period: DisplayProjectionPeriod;
  value: Loan['initialBalance'];
  x: number;
  y: number;
}>;
type ChartValues = Readonly<Record<SeriesId, readonly Loan['initialBalance'][]>>;
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
  scenarios = [],
}: Readonly<{
  loan: Loan;
  payments: readonly PaymentRecord[];
  scenarios?: readonly ProjectionScenarioSnapshot[];
}>) {
  const [page, setPage] = useState(0);
  const [sortDirection, setSortDirection] = useState<SortDirection>('ascending');
  const result = useMemo(() => {
    try {
      const periods: readonly DisplayProjectionPeriod[] = loan.contract
        ? estimateLoanContract(loan).periods.map((period) => ({
            period: period.period,
            date: period.date,
            openingBalance: period.openingBalance,
            interest: period.interest,
            principal: period.principal,
            payment: period.totalDue,
            closingBalance: period.closingBalance,
          }))
        : projectLoanAmortization(loan).periods;
      return { periods };
    } catch (cause) {
      return {
        error: cause instanceof Error ? cause.message : 'No se pudo generar la proyección.',
      };
    }
  }, [loan]);
  if ('error' in result)
    return (
      <section className="projection-view">
        <h3>Proyección</h3>
        <p role="alert">{result.error}</p>
      </section>
    );

  const orderedPeriods = [...result.periods].sort((left, right) =>
    sortDirection === 'ascending'
      ? left.date.localeCompare(right.date)
      : right.date.localeCompare(left.date),
  );
  const start = page * PAGE_SIZE;
  const visiblePeriods = orderedPeriods.slice(start, start + PAGE_SIZE);
  const pages = Math.ceil(orderedPeriods.length / PAGE_SIZE);
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
      <BalanceChart
        loan={loan}
        payments={payments}
        periods={result.periods}
        scenarios={scenarios}
      />
      <div className="table-scroll">
        <table>
          <caption>Historial y proyección de amortización</caption>
          <thead>
            <tr>
              <th scope="col">Tipo</th>
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
              <th scope="col">Principal</th>
              <th scope="col">Saldo final</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr className="historical-row" key={`historical-${payment.id}`}>
                <td>Histórico</td>
                <td>{payment.date}</td>
                <td>{formatMoney(payment.totalAmount, loan.roundingPolicy)}</td>
                <td>
                  {payment.interestAmount
                    ? formatMoney(payment.interestAmount, loan.roundingPolicy)
                    : '—'}
                </td>
                <td>
                  {payment.principalAmount
                    ? formatMoney(payment.principalAmount, loan.roundingPolicy)
                    : 'Pendiente'}
                </td>
                <td>—</td>
              </tr>
            ))}
            {visiblePeriods.map((period) => (
              <tr className="projection-row" key={`projection-${period.period}`}>
                <td>Proyección</td>
                <td>{period.date}</td>
                <td>{formatMoney(period.payment, loan.roundingPolicy)}</td>
                <td>{formatMoney(period.interest, loan.roundingPolicy)}</td>
                <td>{formatMoney(period.principal, loan.roundingPolicy)}</td>
                <td>{formatMoney(period.closingBalance, loan.roundingPolicy)}</td>
              </tr>
            ))}
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
  periods,
  scenarios,
}: Readonly<{
  loan: Loan;
  payments: readonly PaymentRecord[];
  periods: readonly DisplayProjectionPeriod[];
  scenarios: readonly ProjectionScenarioSnapshot[];
}>) {
  const totalStartDate = periods[0]?.date ?? '';
  const totalEndDate = periods.at(-1)?.date ?? '';
  const [rangeStartDate, setRangeStartDate] = useState(totalStartDate);
  const [rangeEndDate, setRangeEndDate] = useState(totalEndDate);
  const [hoveredPeriod, setHoveredPeriod] = useState<DisplayProjectionPeriod>();
  const [lockedPeriod, setLockedPeriod] = useState<DisplayProjectionPeriod>();
  const [selectedSeries, setSelectedSeries] = useState<SelectedSeries>({
    balance: true,
    payment: false,
    interest: false,
    principal: false,
    extra: false,
  });
  const [firstScenarioId, setFirstScenarioId] = useState('');
  const [secondScenarioId, setSecondScenarioId] = useState('');
  const visiblePeriods = periods.filter(
    (period) => period.date >= rangeStartDate && period.date <= rangeEndDate,
  );
  const startPeriod = visiblePeriods[0];
  const endPeriod = visiblePeriods.at(-1);
  if (!startPeriod || !endPeriod) return null;

  const extraPrincipalByPeriod = mapExtraPrincipalByPeriod(payments, periods, loan);
  const comparableScenarios = scenarios.filter(isComparableScenario);
  const scenarioSources: readonly ChartSource[] = [firstScenarioId, secondScenarioId]
    .map((id) => comparableScenarios.find((scenario) => scenario.id === id))
    .filter((scenario): scenario is ComparableScenario => Boolean(scenario))
    .map((scenario, index) => {
      const comparison = compareScenario(loan, scenario);
      return {
        id: scenario.id,
        label: scenario.name,
        sourceClass: index === 0 ? 'scenario-first' : 'scenario-second',
        values: valuesFromProjectionPeriods(comparison.alternative.periods, visiblePeriods, loan),
      };
    });
  const baseValues: ChartValues = {
    balance: visiblePeriods.map((period) => period.closingBalance),
    payment: visiblePeriods.map((period) => period.payment),
    interest: visiblePeriods.map((period) => period.interest),
    principal: visiblePeriods.map((period) => period.principal),
    extra: visiblePeriods.map(
      (period) => extraPrincipalByPeriod.get(period.period) ?? zeroMoney(loan),
    ),
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

  function toggleSeries(id: SeriesId) {
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
        Mostrando {visiblePeriods.length} {visiblePeriods.length === 1 ? 'cuota' : 'cuotas'}:{' '}
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
          Cada señal seleccionada se muestra para la configuración base y los escenarios elegidos,
          desde {startPeriod.date} hasta {endPeriod.date}. El eje vertical usa la moneda del
          préstamo y el horizontal representa las fechas de las cuotas.
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
        <table className="chart-point-table">
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
  projectionPeriods: readonly Readonly<{
    period: number;
    closingBalance: Loan['initialBalance'];
    payment: Loan['initialBalance'];
    interest: Loan['initialBalance'];
    principal: Loan['initialBalance'];
    extraPayment: Loan['initialBalance'];
  }>[],
  visiblePeriods: readonly DisplayProjectionPeriod[],
  loan: Loan,
): ChartValues {
  const valuesFor = (
    select: (period: (typeof projectionPeriods)[number]) => Loan['initialBalance'],
  ): readonly Loan['initialBalance'][] =>
    visiblePeriods.map((visiblePeriod) => {
      const projectionPeriod = projectionPeriods.find(
        (period) => period.period === visiblePeriod.period,
      );
      return projectionPeriod ? select(projectionPeriod) : zeroMoney(loan);
    });
  return {
    balance: valuesFor((period) => period.closingBalance),
    payment: valuesFor((period) => period.payment),
    interest: valuesFor((period) => period.interest),
    principal: valuesFor((period) => period.principal),
    extra: valuesFor((period) => period.extraPayment),
  };
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

function mapExtraPrincipalByPeriod(
  payments: readonly PaymentRecord[],
  periods: readonly DisplayProjectionPeriod[],
  loan: Loan,
): ReadonlyMap<number, Loan['initialBalance']> {
  const values = new Map<number, Loan['initialBalance']>();
  for (const payment of payments) {
    if (!payment.extraPrincipalAmount?.isPositive()) continue;
    const period = periods.find((item) => item.date >= payment.date) ?? periods.at(-1);
    if (!period) continue;
    values.set(
      period.period,
      (values.get(period.period) ?? zeroMoney(loan)).add(payment.extraPrincipalAmount),
    );
  }
  return values;
}

function isComparableScenario(
  scenario: ProjectionScenarioSnapshot,
): scenario is ComparableScenario {
  return isOneTimeExtraPaymentScenario(scenario) || isRecurringExtraPaymentScenario(scenario);
}

function compareScenario(loan: Loan, scenario: ComparableScenario) {
  if (isOneTimeExtraPaymentScenario(scenario)) {
    return compareLoanWithOneTimeExtraPayment({ loan, scenario });
  }
  if (isRecurringExtraPaymentScenario(scenario)) {
    return compareLoanWithRecurringExtraPayment({ loan, scenario });
  }
  throw new Error('El escenario no se puede comparar.');
}

function formatChartDate(date: string): string {
  return date.slice(0, 7);
}
