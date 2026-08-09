import type { LoanAggregate } from '@cuotaclara/domain';

export type DuplicateLoanOptions = Readonly<{
  name: string;
  includePayments: boolean;
  includeScenarios: boolean;
}>;

/**
 * Crea un agregado independiente. Los pagos y escenarios reciben nuevas claves
 * globales antes de persistirse, para que una copia nunca reubique registros
 * que todavía pertenecen al préstamo de origen.
 */
export function createDuplicateLoanAggregate(
  source: LoanAggregate,
  options: DuplicateLoanOptions,
  createId: () => string = () => crypto.randomUUID(),
  createdAt = new Date().toISOString(),
): LoanAggregate {
  const duplicateLoanId = createId();
  const loan = { ...source.loan, id: duplicateLoanId, name: options.name };
  const payments = options.includePayments
    ? source.payments.map((payment) => ({ ...payment, id: createId() }))
    : [];
  const scenarios = options.includeScenarios
    ? source.scenarios.map((scenario) => ({
        ...scenario,
        id: createId(),
        loanId: duplicateLoanId,
        createdAt,
      }))
    : [];

  if (!options.includePayments || !source.bankReset) return { loan, payments, scenarios };

  return {
    loan,
    payments,
    scenarios,
    bankReset: {
      ...source.bankReset,
      id: createId(),
      ...(source.bankReset.adjustment
        ? { adjustment: { ...source.bankReset.adjustment, id: createId() } }
        : {}),
    },
  };
}
