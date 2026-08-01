import { useId } from 'react';

import {
  reconstructHistoricalState,
  type Loan,
  type LoanAggregate,
  type LoanContractEstimate,
} from '@cuotaclara/domain';

import { formatMoney } from './money-format.js';

export function EstimateSummary({
  loan,
  estimate,
  aggregate,
  heading = 'Resumen financiero estimado',
}: Readonly<{
  loan: Loan;
  estimate: LoanContractEstimate;
  aggregate?: LoanAggregate;
  heading?: string;
}>) {
  const titleId = useId();
  const historicalCutoffDate =
    aggregate?.bankReset?.cutoffDate ?? latestPaymentDate(aggregate?.payments);
  const historical =
    historicalCutoffDate && aggregate
      ? reconstructHistoricalState({
          initialBalance: loan.initialBalance,
          payments: aggregate.payments,
          cutoffDate: historicalCutoffDate,
          ...(aggregate.bankReset ? { bankReset: aggregate.bankReset } : {}),
        })
      : undefined;
  const zero = loan.initialBalance.subtract(loan.initialBalance);
  const historicalTotal = aggregate?.payments.reduce(
    (total, payment) => total.add(payment.totalAmount),
    zero,
  );
  const reconciliationPrincipal = historical?.bankReset?.adjustment?.principalAmount ?? zero;
  const totalPrincipal = historical
    ? historical.appliedPrincipal.add(reconciliationPrincipal).add(estimate.estimatedPrincipal)
    : estimate.estimatedPrincipal;
  const totalInterest = historical
    ? historical.historicalInterest.add(estimate.estimatedInterest)
    : estimate.estimatedInterest;
  const totalPaid = historical
    ? (historicalTotal ?? zero).add(reconciliationPrincipal).add(estimate.estimatedTotal)
    : estimate.estimatedTotal;
  return (
    <section className="estimate-summary" aria-labelledby={titleId}>
      <h3 id={titleId}>{heading}</h3>
      <div className="table-scroll table-scroll-summary">
        <table className="financial-table" aria-labelledby={titleId}>
          <tbody>
            <tr>
              <th scope="row">Última cuota estimada</th>
              <td>
                <time dateTime={estimate.finalInstallmentDate}>
                  {estimate.finalInstallmentDate}
                </time>
              </td>
            </tr>
            <tr>
              <th scope="row">Cuotas estimadas</th>
              <td>{estimate.estimatedInstallments}</td>
            </tr>
            {estimate.configuredTotalPayment ? (
              <tr>
                <th scope="row">Cuota total configurada</th>
                <td>{formatMoney(estimate.configuredTotalPayment, loan.roundingPolicy)}</td>
              </tr>
            ) : null}
            {estimate.automaticTotalPayment ? (
              <tr>
                <th scope="row">Cuota mensual automática</th>
                <td>{formatMoney(estimate.automaticTotalPayment, loan.roundingPolicy)}</td>
              </tr>
            ) : null}
            {estimate.projectedInitialTotalPayment ? (
              <tr>
                <th scope="row">Cuota total proyectada inicial</th>
                <td>{formatMoney(estimate.projectedInitialTotalPayment, loan.roundingPolicy)}</td>
              </tr>
            ) : null}
            {estimate.hasConfiguredPaymentDifference && estimate.initialPaymentDifference ? (
              <tr>
                <th scope="row">Diferencia inicial de cuota</th>
                <td>{formatMoney(estimate.initialPaymentDifference, loan.roundingPolicy)}</td>
              </tr>
            ) : null}
            <tr>
              <th scope="row">{historical ? 'Principal total' : 'Principal estimado'}</th>
              <td>{formatMoney(totalPrincipal, loan.roundingPolicy)}</td>
            </tr>
            <tr>
              <th scope="row">{historical ? 'Interés total' : 'Interés estimado'}</th>
              <td>{formatMoney(totalInterest, loan.roundingPolicy)}</td>
            </tr>
            {historical ? (
              <>
                <tr>
                  <th scope="row">Principal histórico</th>
                  <td>{formatMoney(historical.appliedPrincipal, loan.roundingPolicy)}</td>
                </tr>
                <tr>
                  <th scope="row">Interés histórico CSV</th>
                  <td>{formatMoney(historical.historicalInterest, loan.roundingPolicy)}</td>
                </tr>
                {reconciliationPrincipal.isPositive() ? (
                  <tr>
                    <th scope="row">Ajuste de reconciliación</th>
                    <td>{formatMoney(reconciliationPrincipal, loan.roundingPolicy)}</td>
                  </tr>
                ) : null}
              </>
            ) : null}
            <tr>
              <th scope="row">Seguro estimado</th>
              <td>{formatMoney(estimate.estimatedInsurance, loan.roundingPolicy)}</td>
            </tr>
            <tr>
              <th scope="row">
                {historical ? 'Total acumulado y proyectado' : 'Total proyectado'}
              </th>
              <td>{formatMoney(totalPaid, loan.roundingPolicy)}</td>
            </tr>
            {estimate.status === 'remaining_balance' ? (
              <tr>
                <th scope="row">Saldo pendiente al plazo</th>
                <td>{formatMoney(estimate.remainingPrincipal, loan.roundingPolicy)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {estimate.hasAdjustedFinalInstallment ? (
        <p>
          La cuota final proyectada es {formatMoney(estimate.finalInstallment, loan.roundingPolicy)}
          , incluido seguro de {formatMoney(estimate.finalInsurance, loan.roundingPolicy)}.
        </p>
      ) : null}
      {estimate.hasConfiguredPaymentDifference ? (
        <p className="payment-difference" role="status">
          Con los supuestos actuales, la cuota proyectada se recalcula para conservar el plazo
          contractual. Compárala con la cuota configurada; el banco puede usar convenciones, cargos
          o revisiones de tasa distintas.
        </p>
      ) : null}
    </section>
  );
}

function latestPaymentDate(
  payments: readonly LoanAggregate['payments'][number][] | undefined,
): string | undefined {
  return payments?.reduce<string | undefined>(
    (current, payment) => (!current || payment.date > current ? payment.date : current),
    undefined,
  );
}
