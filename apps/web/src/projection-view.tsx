import { useMemo, useState } from 'react';

import {
  estimateLoanContract,
  projectLoanAmortization,
  type Loan,
  type PaymentRecord,
} from '@cuotaclara/domain';

import { formatCompactMoney, formatMoney } from './money-format.js';

const PAGE_SIZE = 24;
const CHART_RANGES = [12, 60, 120] as const;
const CHART = { left: 94, right: 770, top: 30, bottom: 276 } as const;

type SortDirection = 'ascending' | 'descending';
type DisplayProjectionPeriod = Readonly<{
  period: number;
  date: string;
  openingBalance: Loan['initialBalance'];
  interest: Loan['initialBalance'];
  principal: Loan['initialBalance'];
  payment: Loan['initialBalance'];
  closingBalance: Loan['initialBalance'];
}>;
type ChartPoint = Readonly<{ period: DisplayProjectionPeriod; x: number; y: number }>;

export function ProjectionView({
  loan,
  payments,
}: Readonly<{ loan: Loan; payments: readonly PaymentRecord[] }>) {
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
      <BalanceChart loan={loan} periods={result.periods} />
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
  periods,
}: Readonly<{
  loan: Loan;
  periods: readonly DisplayProjectionPeriod[];
}>) {
  const [range, setRange] = useState<number | 'all'>(60);
  const [hoveredPeriod, setHoveredPeriod] = useState<DisplayProjectionPeriod>();
  const visiblePeriods = range === 'all' ? periods : periods.slice(-range);
  const startPeriod = visiblePeriods[0];
  const endPeriod = visiblePeriods.at(-1);
  if (!startPeriod || !endPeriod) return null;

  const maximumBalance = startPeriod.openingBalance;
  const maximumBalanceAsNumber = Math.max(Number(maximumBalance.toDecimalString()), 1);
  const points = toChartPoints(visiblePeriods, maximumBalanceAsNumber);
  const hoveredPoint = points.find((point) => point.period.period === hoveredPeriod?.period);
  const horizontalTicks = [0, 0.25, 0.5, 0.75, 1];
  const temporalTicks = [0, 0.25, 0.5, 0.75, 1];

  function inspectClosestPoint(clientX: number, chartLeft: number, chartWidth: number) {
    const firstPoint = points[0];
    if (!firstPoint || chartWidth === 0) return;
    const x = ((clientX - chartLeft) / chartWidth) * 800;
    let closestPoint = firstPoint;
    for (const point of points) {
      if (Math.abs(point.x - x) < Math.abs(closestPoint.x - x)) closestPoint = point;
    }
    if (closestPoint.period.period !== hoveredPeriod?.period) setHoveredPeriod(closestPoint.period);
  }

  return (
    <figure className="balance-chart">
      <div className="chart-controls">
        <label>
          Rango del gráfico
          <select
            value={range}
            onChange={(event) => {
              setRange(event.target.value === 'all' ? 'all' : Number(event.target.value));
              setHoveredPeriod(undefined);
            }}
          >
            {CHART_RANGES.map((periodCount) => (
              <option key={periodCount} value={periodCount}>
                Últimos {periodCount} períodos
              </option>
            ))}
            <option value="all">Todo el plazo</option>
          </select>
        </label>
        <p>Desplaza el cursor sobre la línea para inspeccionar una cuota.</p>
      </div>
      <svg
        viewBox="0 0 800 330"
        role="img"
        aria-labelledby="balance-chart-title"
        aria-describedby="balance-chart-description"
        onPointerLeave={() => setHoveredPeriod(undefined)}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          inspectClosestPoint(event.clientX, bounds.left, bounds.width);
        }}
      >
        <title id="balance-chart-title">Evolución estimada del saldo</title>
        <desc id="balance-chart-description">
          Saldo proyectado desde {startPeriod.date} hasta {endPeriod.date}; el eje vertical usa la
          moneda del préstamo y el horizontal representa las fechas de las cuotas.
        </desc>
        {horizontalTicks.map((fraction) => {
          const y = CHART.bottom - fraction * (CHART.bottom - CHART.top);
          const value = maximumBalance.multiplyBy(fraction.toString());
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
        <polyline
          className="projection-line"
          points={points.map((point) => `${point.x},${point.y}`).join(' ')}
        />
        {points.map((point) => (
          <circle
            aria-label={`Cuota ${point.period.period}, ${point.period.date}`}
            className="chart-point-target"
            cx={point.x}
            cy={point.y}
            key={point.period.period}
            r="8"
            tabIndex={0}
            onFocus={() => setHoveredPeriod(point.period)}
            onPointerEnter={() => setHoveredPeriod(point.period)}
          />
        ))}
        {hoveredPoint ? (
          <circle className="chart-point-highlight" cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" />
        ) : null}
      </svg>
      <figcaption>
        <span className="legend projection">Saldo proyectado</span>
        <span>Los pagos reales se consultan en la tabla.</span>
      </figcaption>
      <ChartPointDetails loan={loan} period={hoveredPeriod} />
    </figure>
  );
}

function ChartPointDetails({
  loan,
  period,
}: Readonly<{ loan: Loan; period: DisplayProjectionPeriod | undefined }>) {
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
      </strong>
      <dl>
        <div>
          <dt>Pago</dt>
          <dd>{formatMoney(period.payment, loan.roundingPolicy)}</dd>
        </div>
        <div>
          <dt>Interés</dt>
          <dd>{formatMoney(period.interest, loan.roundingPolicy)}</dd>
        </div>
        <div>
          <dt>Principal</dt>
          <dd>{formatMoney(period.principal, loan.roundingPolicy)}</dd>
        </div>
        <div>
          <dt>Saldo</dt>
          <dd>{formatMoney(period.closingBalance, loan.roundingPolicy)}</dd>
        </div>
      </dl>
    </div>
  );
}

function toChartPoints(
  periods: readonly DisplayProjectionPeriod[],
  maximumBalance: number,
): readonly ChartPoint[] {
  const denominator = Math.max(periods.length - 1, 1);
  return periods.map((period, index) => ({
    period,
    x: CHART.left + (index / denominator) * (CHART.right - CHART.left),
    y:
      CHART.top +
      (1 -
        Math.max(0, Math.min(Number(period.closingBalance.toDecimalString()), maximumBalance)) /
          maximumBalance) *
        (CHART.bottom - CHART.top),
  }));
}

function formatChartDate(date: string): string {
  return date.slice(0, 7);
}
