import type { PaymentRecord } from '../history/historical-state.js';
import type { Loan } from '../loan/loan.js';

export type ProjectionScenarioSnapshot = Readonly<{
  id: string;
  loanId: string;
  name: string;
  configuration: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

export type LoanAggregate = Readonly<{
  loan: Loan;
  payments: readonly PaymentRecord[];
  scenarios: readonly ProjectionScenarioSnapshot[];
}>;

/** Puerto de persistencia. Los adaptadores locales o remotos implementan este contrato. */
export interface LoanRepository {
  listLoans(): Promise<readonly Loan[]>;
  loadAggregate(loanId: string): Promise<LoanAggregate | undefined>;
  saveAggregate(aggregate: LoanAggregate): Promise<void>;
  deleteLoan(loanId: string): Promise<void>;
}
