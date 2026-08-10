import {
  createBankReset,
  Money,
  reconstructHistoricalState,
  type BankReset,
  type LoanAggregate,
  type LoanContractEstimateOptions,
  type PaymentRecord,
} from '@cuotaclara/domain';

export type LoanPositionSource = 'bank_reconciliation' | 'historical_payments' | 'initial_balance';

export type LoanPosition =
  | Readonly<{
      status: 'available';
      currentBalance: Money;
      cutoffDate: string;
      source: LoanPositionSource;
    }>
  | Readonly<{ status: 'unavailable'; reason: string }>;

type ComposedBalanceReconciliation = Readonly<{
  id: string;
  cutoffDate: string;
  reportedBalance: Money;
  adjustment?: NonNullable<BankReset['adjustment']>;
}>;

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
      const composed = composeBalanceReconciliation(latest, payments);
      if ('reason' in composed) return undefined;
      return createBankReset({
        id: composed.id,
        cutoffDate: composed.cutoffDate,
        reportedBalance: composed.reportedBalance,
        bankFinalInstallmentDate: finalDate,
        // El ajuste pertenece a la fecha conciliada original. Cuando existen
        // pagos posteriores se muestra desde su registro histórico, no como
        // un ajuste ficticio en el corte compuesto.
        ...(composed.adjustment ? { adjustment: composed.adjustment } : {}),
      });
    }
    return undefined;
  }
  return aggregate.bankReset;
}

/**
 * Resuelve el saldo principal que puede presentarse como posición vigente sin
 * exigir una fecha final bancaria ni modificar el agregado.
 */
export function resolveLoanPosition(aggregate: LoanAggregate): LoanPosition {
  const latest = aggregate.balanceReconciliations
    ? [...aggregate.balanceReconciliations].sort((left, right) =>
        right.reportedAt.localeCompare(left.reportedAt),
      )[0]
    : undefined;
  if (latest) {
    const composed = composeBalanceReconciliation(latest, aggregate.payments);
    if ('reason' in composed) return { status: 'unavailable', reason: composed.reason };
    return {
      status: 'available',
      currentBalance: composed.reportedBalance,
      cutoffDate: composed.cutoffDate,
      source: 'bank_reconciliation',
    };
  }
  if (!aggregate.balanceReconciliations && aggregate.bankReset) {
    return {
      status: 'available',
      currentBalance: aggregate.bankReset.reportedBalance,
      cutoffDate: aggregate.bankReset.cutoffDate,
      source: 'bank_reconciliation',
    };
  }
  if (!aggregate.payments.length) {
    return {
      status: 'available',
      currentBalance: aggregate.loan.initialBalance,
      cutoffDate: aggregate.loan.startDate,
      source: 'initial_balance',
    };
  }

  const cutoffDate = latestPaymentDate(aggregate.payments);
  try {
    const historical = reconstructHistoricalState({
      initialBalance: aggregate.loan.initialBalance,
      payments: aggregate.payments,
      cutoffDate,
    });
    return {
      status: 'available',
      currentBalance: historical.currentBalance,
      cutoffDate,
      source: 'historical_payments',
    };
  } catch (cause) {
    return {
      status: 'unavailable',
      reason: cause instanceof Error ? cause.message : 'No se pudo reconstruir el saldo actual.',
    };
  }
}

/** Opciones comunes para que todas las vistas proyecten desde el mismo punto. */
export function resolveLoanProjectionContext(
  aggregate: LoanAggregate,
): LoanContractEstimateOptions {
  const bankReset = activeBalanceReconciliation(aggregate, aggregate.payments);
  const bankFinalInstallmentDate = reconciledFinalDate(aggregate);
  return {
    ...(bankReset ? { bankReset } : {}),
    ...(bankFinalInstallmentDate ? { bankFinalInstallmentDate } : {}),
    ...(!bankReset && aggregate.payments.length ? { historicalPayments: aggregate.payments } : {}),
  };
}

export function reconciledFinalDate(aggregate: LoanAggregate | undefined): string | undefined {
  if (!aggregate) return undefined;
  return aggregate.balanceReconciliations
    ? aggregate.bankFinalDateReconciliation?.bankFinalInstallmentDate
    : (aggregate.bankFinalDateReconciliation?.bankFinalInstallmentDate ??
        aggregate.bankReset?.bankFinalInstallmentDate);
}

function composeBalanceReconciliation(
  reconciliation: NonNullable<LoanAggregate['balanceReconciliations']>[number],
  payments: readonly PaymentRecord[],
): ComposedBalanceReconciliation | Readonly<{ reason: string }> {
  const subsequentPayments = payments
    .filter((payment) => payment.date > reconciliation.reportedAt)
    .sort((left, right) => left.date.localeCompare(right.date));
  const zero = Money.from('0', reconciliation.reportedBalance.currency);
  let reportedBalance = reconciliation.reportedBalance;
  for (const payment of subsequentPayments) {
    if (!payment.principalAmount) {
      return {
        reason: `El pago ${payment.id} no contiene principal para reconstruir el saldo.`,
      };
    }
    try {
      const principal = payment.principalAmount.add(payment.extraPrincipalAmount ?? zero);
      if (reportedBalance.isLessThan(principal)) {
        return { reason: `El pago ${payment.id} excede el saldo pendiente.` };
      }
      reportedBalance = reportedBalance.subtract(principal);
    } catch (cause) {
      return {
        reason: cause instanceof Error ? cause.message : 'No se pudo reconstruir el saldo actual.',
      };
    }
  }
  const cutoffDate = subsequentPayments.at(-1)?.date ?? reconciliation.reportedAt;
  return {
    id: reconciliation.id,
    cutoffDate,
    reportedBalance,
    ...(cutoffDate === reconciliation.reportedAt && reconciliation.adjustment
      ? { adjustment: reconciliation.adjustment }
      : {}),
  };
}

function latestPaymentDate(payments: readonly PaymentRecord[]): string {
  const latest = payments.reduce<string | undefined>(
    (current, payment) => (!current || payment.date > current ? payment.date : current),
    undefined,
  );
  if (!latest) throw new Error('No hay pagos históricos para determinar el corte.');
  return latest;
}
