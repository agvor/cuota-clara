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
      <table>
        <caption>Estimación local; no es una promesa ni liquidación bancaria.</caption>
        <tbody>
          <tr>
            <th scope="row">Última cuota estimada</th>
            <td>
              <time dateTime={estimate.finalInstallmentDate}>{estimate.finalInstallmentDate}</time>
            </td>
          </tr>
          <tr>
            <th scope="row">Cuotas estimadas</th>
            <td>{estimate.estimatedInstallments}</td>
          </tr>
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
      {estimate.hasAdjustedFinalInstallment ? (
        <p>
          La cuota final proyectada es {formatMoney(estimate.finalInstallment, loan.roundingPolicy)}
          , incluido seguro de {formatMoney(estimate.finalInsurance, loan.roundingPolicy)}.
        </p>
      ) : null}
    </section>
  );
}
