import {
  estimateLoanContract,
  type BankReset,
  type Loan,
  type PaymentRecord,
  type ScenarioProjectionContext,
} from '@cuotaclara/domain';

/**
 * Convierte la proyección contractual pendiente en el punto de partida de un
 * escenario. Así los aportes alternativos no vuelven al saldo original.
 */
export function createScenarioProjectionContext(input: {
  loan: Loan;
  payments: readonly PaymentRecord[];
  bankReset?: BankReset;
}): ScenarioProjectionContext | undefined {
  const { loan, payments, bankReset } = input;
  const cutoffDate = bankReset?.cutoffDate ?? latestPaymentDate(payments);
  if (!cutoffDate || !loan.contract) return undefined;

  const estimate = estimateLoanContract(
    loan,
    bankReset ? { bankReset } : { historicalPayments: payments },
  );
  const firstPeriod = estimate.periods[0];
  if (!firstPeriod) return undefined;

  return {
    openingBalance: firstPeriod.openingBalance,
    startDate: cutoffDate,
    periodEndDates: estimate.periods.map((period) => period.date),
    ordinaryPayments: estimate.periods.map((period) => period.installment),
    periodNumberOffset: originalPeriodOffset(loan.startDate, firstPeriod.date),
  };
}

function latestPaymentDate(payments: readonly PaymentRecord[]): string | undefined {
  return payments.reduce<string | undefined>(
    (latest, payment) => (!latest || payment.date > latest ? payment.date : latest),
    undefined,
  );
}

function originalPeriodOffset(startDate: string, firstPeriodDate: string): number {
  const [startYear, startMonth] = startDate.split('-').map(Number);
  const [periodYear, periodMonth] = firstPeriodDate.split('-').map(Number);
  if (!startYear || !startMonth || !periodYear || !periodMonth) return 0;
  return Math.max(0, (periodYear - startYear) * 12 + periodMonth - startMonth - 1);
}
