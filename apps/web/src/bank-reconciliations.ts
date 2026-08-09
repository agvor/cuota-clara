import { createBankReset, type BankReset, type LoanAggregate } from '@cuotaclara/domain';

/**
 * Selecciona el saldo bancario más reciente como punto de proyección. Las
 * conciliaciones anteriores permanecen como historial auditable.
 */
export function activeBalanceReconciliation(
  aggregate: LoanAggregate | undefined,
): BankReset | undefined {
  if (!aggregate) return undefined;
  const reconciliations = aggregate.balanceReconciliations;
  const latest = reconciliations
    ? [...reconciliations].sort((left, right) => right.reportedAt.localeCompare(left.reportedAt))[0]
    : undefined;
  const finalDate = aggregate.bankFinalDateReconciliation?.bankFinalInstallmentDate;
  if (reconciliations) {
    if (latest && finalDate && finalDate > latest.reportedAt) {
      return createBankReset({
        id: latest.id,
        cutoffDate: latest.reportedAt,
        reportedBalance: latest.reportedBalance,
        bankFinalInstallmentDate: finalDate,
        ...(latest.adjustment ? { adjustment: latest.adjustment } : {}),
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
