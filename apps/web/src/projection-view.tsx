import { useMemo, useState } from 'react';

import { projectLoanAmortization, type Loan, type PaymentRecord } from '@cuotaclara/domain';

const PAGE_SIZE = 24;

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
        <h2>Proyección</h2>
        <p role="alert">{result.error}</p>
      </section>
    );
  const periods = result.value.periods;
  const start = page * PAGE_SIZE;
  const visiblePeriods = periods.slice(start, start + PAGE_SIZE);
  const pages = Math.ceil(periods.length / PAGE_SIZE);
  return (
    <section className="projection-view" aria-labelledby="projection-title">
      <h2 id="projection-title">Evolución del saldo</h2>
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
              <tr key={`historical-${payment.id}`}>
                <td>Histórico</td>
                <td>{payment.date}</td>
                <td>{payment.totalAmount.toFixed(loan.roundingPolicy)}</td>
                <td>{payment.interestAmount?.toFixed(loan.roundingPolicy) ?? '—'}</td>
                <td>{payment.principalAmount?.toFixed(loan.roundingPolicy) ?? 'Pendiente'}</td>
                <td>—</td>
              </tr>
            ))}
            {visiblePeriods.map((period) => (
              <tr key={`projection-${period.period}`}>
                <td>Proyección</td>
                <td>{period.date}</td>
                <td>{period.payment.toFixed(loan.roundingPolicy)}</td>
                <td>{period.interest.toFixed(loan.roundingPolicy)}</td>
                <td>{period.principal.toFixed(loan.roundingPolicy)}</td>
                <td>{period.closingBalance.toFixed(loan.roundingPolicy)}</td>
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
  const maxBalance = Number(loan.initialBalance.toFixed(loan.roundingPolicy));
  const projectionPoints = periods
    .map(
      (period, index) =>
        `${(index / Math.max(periods.length - 1, 1)) * 100},${100 - (Number(period.closingBalance.toFixed(loan.roundingPolicy)) / maxBalance) * 100}`,
    )
    .join(' ');
  let historicalBalance = maxBalance;
  const knownHistoricalPayments = payments
    .filter((payment) => payment.principalAmount)
    .sort((left, right) => left.date.localeCompare(right.date));
  const historicalPoints = knownHistoricalPayments
    .map((payment, index) => {
      historicalBalance -= Number(payment.principalAmount?.toFixed(loan.roundingPolicy) ?? '0');
      historicalBalance -= Number(
        payment.extraPrincipalAmount?.toFixed(loan.roundingPolicy) ?? '0',
      );
      return `${(index / Math.max(knownHistoricalPayments.length - 1, 1)) * 100},${100 - (Math.max(historicalBalance, 0) / maxBalance) * 100}`;
    })
    .join(' ');
  return (
    <figure className="balance-chart">
      <svg viewBox="0 0 100 100" role="img" aria-label="Evolución estimada del saldo">
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
