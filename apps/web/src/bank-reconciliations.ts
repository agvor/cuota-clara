import {
  createBankReset,
  Money,
  type BankReset,
  type LoanAggregate,
  type PaymentRecord,
} from '@cuotaclara/domain';

/**
 * Selecciona el saldo bancario más reciente como punto de proyección. Las
 * conciliaciones anteriores permanecen como historial auditable.
 */
export function activeBalanceReconciliation(
  aggregate: LoanAggregate | undefined,
  payments: readonly PaymentRecord[] = aggregate?.payments ?? [],
): BankReset | undefined {
  if (!aggregate) return undefined;
  const reconciliations = aggregate.balanceReconciliations;
  const latest = reconciliations
    ? [...reconciliations].sort((left, right) => right.reportedAt.localeCompare(left.reportedAt))[0]
    : undefined;
  const finalDate = aggregate.bankFinalDateReconciliation?.bankFinalInstallmentDate;
  if (reconciliations) {
    if (latest && finalDate && finalDate > latest.reportedAt) {
      const subsequentPayments = payments
        .filter((payment) => payment.date > latest.reportedAt)
        .sort((left, right) => left.date.localeCompare(right.date));
      const zero = Money.from('0', latest.reportedBalance.currency);
      const reportedBalance = subsequentPayments.reduce((balance, payment) => {
        const principal = (payment.principalAmount ?? zero).add(
          payment.extraPrincipalAmount ?? zero,
        );
        return balance.isLessThan(principal) ? zero : balance.subtract(principal);
      }, latest.reportedBalance);
      const cutoffDate = subsequentPayments.at(-1)?.date ?? latest.reportedAt;
      return createBankReset({
        id: latest.id,
        cutoffDate,
        reportedBalance,
        bankFinalInstallmentDate: finalDate,
        // El ajuste pertenece a la fecha conciliada original. Cuando existen
        // pagos posteriores se muestra desde su registro histórico, no como
        // un ajuste ficticio en el corte compuesto.
        ...(cutoffDate === latest.reportedAt && latest.adjustment
          ? { adjustment: latest.adjustment }
          : {}),
      });
    }
    return undefined;
  }
  return aggregate.bankReset;
}

export function reconciledFinalDate(aggregate: LoanAggregate | undefined): string | undefined {
  if (!aggregate) return undefined;
  return aggregate.balanceReconciliations
    ? aggregate.bankFinalDateReconciliation?.bankFinalInstallmentDate
    : (aggregate.bankFinalDateReconciliation?.bankFinalInstallmentDate ??
        aggregate.bankReset?.bankFinalInstallmentDate);
}
