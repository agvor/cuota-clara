import { useId } from 'react';

import { type Loan, type LoanContractEstimate } from '@cuotaclara/domain';

import { formatMoney } from './money-format.js';

export function EstimateSummary({
  loan,
  estimate,
  heading = 'Resumen financiero estimado',
}: Readonly<{ loan: Loan; estimate: LoanContractEstimate; heading?: string }>) {
  const titleId = useId();
  return (
    <section className="estimate-summary" aria-labelledby={titleId}>
      <h3 id={titleId}>{heading}</h3>
      <div className="table-scroll table-scroll-summary">
        <table className="financial-table">
          <caption>Estimación local; no es una promesa ni liquidación bancaria.</caption>
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
              <th scope="row">Principal estimado</th>
              <td>{formatMoney(estimate.estimatedPrincipal, loan.roundingPolicy)}</td>
            </tr>
            <tr>
              <th scope="row">Interés estimado</th>
              <td>{formatMoney(estimate.estimatedInterest, loan.roundingPolicy)}</td>
            </tr>
            <tr>
              <th scope="row">Seguro estimado</th>
              <td>{formatMoney(estimate.estimatedInsurance, loan.roundingPolicy)}</td>
            </tr>
            <tr>
              <th scope="row">Total proyectado</th>
              <td>{formatMoney(estimate.estimatedTotal, loan.roundingPolicy)}</td>
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
