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
  const bankResetAdjustment = historical?.bankReset?.adjustment;
  const reconciliationPrincipal = bankResetAdjustment?.principalAmount ?? zero;
  const hasHistoricalPayments = Boolean(aggregate?.payments.length);
  const hasReconciliation = Boolean(bankResetAdjustment && reconciliationPrincipal.isPositive());
  const hasRecordedActivity = hasHistoricalPayments || hasReconciliation;
  const projectedPayment = estimate.automaticTotalPayment ?? estimate.projectedInitialTotalPayment;
  const projectedPaymentLabel = historical
    ? 'Cuota mensual recalculada al corte'
    : estimate.automaticTotalPayment
      ? 'Cuota mensual automática'
      : 'Cuota mensual inicial proyectada';
  const showConfiguredPayment = Boolean(estimate.configuredTotalPayment && !aggregate);
  const showProjectedPayment = Boolean(
    projectedPayment && (!aggregate || historical || estimate.hasConfiguredPaymentDifference),
  );
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
            <tr className="summary-group-row">
              <th scope="colgroup" colSpan={2}>
                Proyección pendiente
              </th>
            </tr>
            {historical ? (
              <tr>
                <th scope="row">Saldo inicial de la proyección</th>
                <td>{formatMoney(historical.currentBalance, loan.roundingPolicy)}</td>
              </tr>
            ) : null}
            <tr>
              <th scope="row">Última cuota proyectada</th>
              <td>
                <time dateTime={estimate.finalInstallmentDate}>
                  {estimate.finalInstallmentDate}
                </time>
              </td>
            </tr>
            <tr>
              <th scope="row">
                {historical ? 'Cuotas restantes proyectadas' : 'Cuotas estimadas'}
              </th>
              <td>{estimate.estimatedInstallments}</td>
            </tr>
            {showConfiguredPayment && estimate.configuredTotalPayment ? (
              <tr>
                <th scope="row">Cuota mensual acordada</th>
                <td>{formatMoney(estimate.configuredTotalPayment, loan.roundingPolicy)}</td>
              </tr>
            ) : null}
            {showProjectedPayment && projectedPayment ? (
              <tr>
                <th scope="row">{projectedPaymentLabel}</th>
                <td>{formatMoney(projectedPayment, loan.roundingPolicy)}</td>
              </tr>
            ) : null}
            {estimate.hasConfiguredPaymentDifference && estimate.initialPaymentDifference ? (
              <tr>
                <th scope="row">Diferencia frente a la cuota acordada</th>
                <td>{formatMoney(estimate.initialPaymentDifference, loan.roundingPolicy)}</td>
              </tr>
            ) : null}
            <tr>
              <th scope="row">
                {historical ? 'Principal restante proyectado' : 'Principal estimado'}
              </th>
              <td>{formatMoney(estimate.estimatedPrincipal, loan.roundingPolicy)}</td>
            </tr>
            <tr>
              <th scope="row">{historical ? 'Interés futuro estimado' : 'Interés estimado'}</th>
              <td>{formatMoney(estimate.estimatedInterest, loan.roundingPolicy)}</td>
            </tr>
            <tr>
              <th scope="row">{historical ? 'Seguro futuro estimado' : 'Seguro estimado'}</th>
              <td>{formatMoney(estimate.estimatedInsurance, loan.roundingPolicy)}</td>
            </tr>
            <tr>
              <th scope="row">{historical ? 'Costo futuro proyectado' : 'Total proyectado'}</th>
              <td>{formatMoney(estimate.estimatedTotal, loan.roundingPolicy)}</td>
            </tr>
          </tbody>
          {hasHistoricalPayments ? (
            <tbody>
              <tr className="summary-group-row">
                <th scope="colgroup" colSpan={2}>
                  Actividad registrada
                </th>
              </tr>
              <tr>
                <th scope="row">Pagos registrados</th>
                <td>{formatMoney(historicalTotal ?? zero, loan.roundingPolicy)}</td>
              </tr>
              <tr>
                <th scope="row">Principal registrado</th>
                <td>{formatMoney(historical?.appliedPrincipal ?? zero, loan.roundingPolicy)}</td>
              </tr>
              <tr>
                <th scope="row">Interés registrado</th>
                <td>{formatMoney(historical?.historicalInterest ?? zero, loan.roundingPolicy)}</td>
              </tr>
            </tbody>
          ) : null}
          {hasReconciliation ? (
            <tbody>
              <tr className="summary-group-row">
                <th scope="colgroup" colSpan={2}>
                  Conciliación del saldo
                </th>
              </tr>
              <tr>
                <th scope="row">Aporte extraordinario asumido</th>
                <td>{formatMoney(reconciliationPrincipal, loan.roundingPolicy)}</td>
              </tr>
            </tbody>
          ) : null}
          {hasRecordedActivity ? (
            <tbody>
              <tr className="summary-group-row summary-total-group-row">
                <th scope="colgroup" colSpan={2}>
                  Totales pagados y proyectados
                </th>
              </tr>
              <tr>
                <th scope="row">Principal pagado y proyectado</th>
                <td>{formatMoney(totalPrincipal, loan.roundingPolicy)}</td>
              </tr>
              <tr>
                <th scope="row">Interés pagado y proyectado</th>
                <td>{formatMoney(totalInterest, loan.roundingPolicy)}</td>
              </tr>
              <tr className="summary-total-row">
                <th scope="row">Total pagado y proyectado</th>
                <td>{formatMoney(totalPaid, loan.roundingPolicy)}</td>
              </tr>
            </tbody>
          ) : null}
          {estimate.status === 'remaining_balance' ? (
            <tbody>
              <tr className="summary-group-row">
                <th scope="colgroup" colSpan={2}>
                  Saldo pendiente
                </th>
              </tr>
              <tr>
                <th scope="row">Saldo pendiente al plazo</th>
                <td>{formatMoney(estimate.remainingPrincipal, loan.roundingPolicy)}</td>
              </tr>
            </tbody>
          ) : null}
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
          contractual. Compárala con la cuota acordada; el banco puede usar convenciones, cargos o
          revisiones de tasa distintas.
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
