import { useMemo, useState } from 'react';

import { projectLoanAmortization, type Loan, type PaymentRecord } from '@cuotaclara/domain';

import { formatMoney } from './money-format.js';

const PAGE_SIZE = 24;
const CHART_RANGES = [12, 60, 120] as const;

export function ProjectionView({
  loan,
  payments,
}: Readonly<{ loan: Loan; payments: readonly PaymentRecord[] }>) {
  const [page, setPage] = useState(0);
  const result = useMemo(() => {
    try {
      return { value: projectLoanAmortization(loan) };
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
  const periods = result.value.periods;
  const start = page * PAGE_SIZE;
  const visiblePeriods = periods.slice(start, start + PAGE_SIZE);
  const pages = Math.ceil(periods.length / PAGE_SIZE);
  return (
    <section className="projection-view" aria-labelledby="projection-title">
      <h3 id="projection-title">Evolución del saldo</h3>
      <p>
        Los pagos históricos aparecen como registros reales; la proyección contractual se muestra
        por separado.
      </p>
      <BalanceChart loan={loan} payments={payments} periods={periods} />
      <div className="table-scroll">
        <table>
          <caption>Historial y proyección de amortización</caption>
          <thead>
            <tr>
              <th scope="col">Tipo</th>
              <th scope="col">Fecha</th>
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
}: Readonly<{
  loan: Loan;
  payments: readonly PaymentRecord[];
  periods: ReturnType<typeof projectLoanAmortization>['periods'];
}>) {
  const [range, setRange] = useState<number | 'all'>(60);
  const visiblePeriods = range === 'all' ? periods : periods.slice(-range);
  const startPeriod = visiblePeriods[0];
  const endPeriod = visiblePeriods.at(-1);
  if (!startPeriod || !endPeriod) return null;

  const maximumBalance = startPeriod.openingBalance;
  const maximumBalanceAsNumber = Math.max(Number(maximumBalance.toDecimalString()), 1);
  const projectionPoints = toPoints(
    visiblePeriods.map((period) => Number(period.closingBalance.toDecimalString())),
    maximumBalanceAsNumber,
  );
  let historicalBalance = maximumBalanceAsNumber;
  const historicalBalances = payments
    .filter((payment) => payment.principalAmount)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((payment) => {
      historicalBalance -= Number(payment.principalAmount?.toDecimalString() ?? '0');
      historicalBalance -= Number(payment.extraPrincipalAmount?.toDecimalString() ?? '0');
      return historicalBalance;
    });
  const rangedHistoricalBalances =
    range === 'all' ? historicalBalances : historicalBalances.slice(-range);
  const historicalPoints = rangedHistoricalBalances.length
    ? toPoints(rangedHistoricalBalances, maximumBalanceAsNumber)
    : '';

  return (
    <figure className="balance-chart">
      <label>
        Rango del gráfico
        <select
          value={range}
          onChange={(event) =>
            setRange(event.target.value === 'all' ? 'all' : Number(event.target.value))
          }
        >
          {CHART_RANGES.map((periodCount) => (
            <option key={periodCount} value={periodCount}>
              Últimos {periodCount} períodos
            </option>
          ))}
          <option value="all">Todo el plazo</option>
        </select>
      </label>
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-labelledby="balance-chart-title"
        aria-describedby="balance-chart-description"
      >
        <title id="balance-chart-title">Evolución estimada del saldo</title>
        <desc id="balance-chart-description">
          Saldo proyectado desde {startPeriod.date} hasta {endPeriod.date}; el eje vertical usa la
          moneda del préstamo y el horizontal representa las fechas de las cuotas.
        </desc>
        <line className="chart-axis" x1="12" x2="94" y1="86" y2="86" />
        <line className="chart-axis" x1="12" x2="12" y1="10" y2="86" />
        <text className="chart-label" x="11" y="12" textAnchor="end">
          {formatMoney(maximumBalance, loan.roundingPolicy)}
        </text>
        <text className="chart-label" x="11" y="87" textAnchor="end">
          {formatMoney(maximumBalance.subtract(maximumBalance), loan.roundingPolicy)}
        </text>
        <text className="chart-label" x="12" y="97">
          {startPeriod.date}
        </text>
        <text className="chart-label" x="94" y="97" textAnchor="end">
          {endPeriod.date}
        </text>
        <polyline
          points={projectionPoints}
          fill="none"
          stroke="#1d4ed8"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        {historicalPoints ? (
          <polyline
            points={historicalPoints}
            fill="none"
            stroke="#15803d"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      <figcaption>
        <span className="legend historical">Histórico</span>
        <span className="legend projection">Proyección</span>
      </figcaption>
    </figure>
  );
}

function toPoints(values: readonly number[], maximum: number): string {
  const denominator = Math.max(values.length - 1, 1);
  return values
    .map((value, index) => {
      const x = 12 + (index / denominator) * 82;
      const y = 10 + (1 - Math.max(0, Math.min(value, maximum)) / maximum) * 76;
      return `${x},${y}`;
    })
    .join(' ');
}
