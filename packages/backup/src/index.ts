import {
  createLoan,
  createBankReset,
  createPaymentRecord,
  Money,
  type BankReset,
  type BankBalanceReconciliation,
  type BankFinalDateReconciliation,
  type LoanContract,
  type LoanContractV2,
  type LoanContractV3,
  type LoanAggregate,
  type ProjectionScenarioSnapshot,
} from '@cuotaclara/domain';

const CURRENT_SCHEMA_VERSION = 6;

type StoredMoney = Readonly<{ amount: string; currency: string }>;
export type BackupDocument = Readonly<{
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  createdAt: string;
  aggregates: readonly unknown[];
}>;

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(`La copia de respaldo es inválida: ${message}`);
    this.name = 'BackupValidationError';
  }
}

export function createBackup(
  aggregates: readonly LoanAggregate[],
  createdAt = new Date().toISOString(),
): BackupDocument {
  return Object.freeze({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt,
    aggregates: Object.freeze(
      aggregates.map((aggregate) => {
        const { contract, ...legacyLoan } = aggregate.loan;
        return Object.freeze({
          loan: {
            ...legacyLoan,
            initialBalance: storeMoney(legacyLoan.initialBalance),
            ordinaryPayment: storeMoney(legacyLoan.ordinaryPayment),
            ...(contract ? { contract: storeContract(contract) } : {}),
          },
          payments: Object.freeze(aggregate.payments.map((payment) => storePayment(payment))),
          ...(aggregate.bankReset ? { bankReset: storeBankReset(aggregate.bankReset) } : {}),
          ...(aggregate.balanceReconciliations
            ? {
                balanceReconciliations: aggregate.balanceReconciliations.map(
                  storeBalanceReconciliation,
                ),
              }
            : {}),
          ...(aggregate.bankFinalDateReconciliation
            ? { bankFinalDateReconciliation: aggregate.bankFinalDateReconciliation }
            : {}),
          scenarios: Object.freeze(structuredClone(aggregate.scenarios)),
        });
      }),
    ),
  });
}

export function parseBackup(
  text: string,
): Readonly<{ createdAt: string; aggregates: readonly LoanAggregate[] }> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new BackupValidationError('no contiene JSON válido.');
  }
  const backup = record(value, 'raíz');
  if (
    backup.schemaVersion !== 1 &&
    backup.schemaVersion !== 2 &&
    backup.schemaVersion !== 3 &&
    backup.schemaVersion !== 4 &&
    backup.schemaVersion !== 5 &&
    backup.schemaVersion !== CURRENT_SCHEMA_VERSION
  )
    throw new BackupValidationError('la versión de esquema no es compatible.');
  if (typeof backup.createdAt !== 'string' || !Array.isArray(backup.aggregates))
    throw new BackupValidationError('faltan fecha o agregados.');
  const aggregateIds = new Set<string>();
  const schemaVersion = backup.schemaVersion as number;
  const aggregates = backup.aggregates.map((item) => parseAggregate(item, schemaVersion));
  const paymentIds = new Set<string>();
  for (const aggregate of aggregates) {
    if (aggregateIds.has(aggregate.loan.id))
      throw new BackupValidationError('hay préstamos duplicados.');
    aggregateIds.add(aggregate.loan.id);
    const sourcePaymentIds = new Set<string>();
    for (const payment of aggregate.payments) {
      if (paymentIds.has(payment.id)) {
        throw new BackupValidationError('hay identificadores internos de pago duplicados.');
      }
      paymentIds.add(payment.id);
      if (payment.sourcePaymentId) {
        if (sourcePaymentIds.has(payment.sourcePaymentId)) {
          throw new BackupValidationError('hay referencias externas de pago duplicadas.');
        }
        sourcePaymentIds.add(payment.sourcePaymentId);
      }
    }
  }
  return Object.freeze({ createdAt: backup.createdAt, aggregates: Object.freeze(aggregates) });
}

function parseAggregate(value: unknown, schemaVersion: number): LoanAggregate {
  const recordValue = record(value, 'agregado');
  if (!Array.isArray(recordValue.payments) || !Array.isArray(recordValue.scenarios))
    throw new BackupValidationError('un agregado no contiene colecciones válidas.');
  try {
    const loanValue = record(recordValue.loan, 'préstamo');
    const variableRatePlan =
      loanValue.variableRatePlan as LoanAggregate['loan']['variableRatePlan'];
    const contract = loanValue.contract ? parseContract(loanValue.contract) : undefined;
    const loan = createLoan({
      ...loanValue,
      id: string(loanValue.id, 'préstamo.id'),
      name: string(loanValue.name, 'préstamo.name'),
      startDate: string(loanValue.startDate, 'préstamo.startDate'),
      initialBalance: parseMoney(loanValue.initialBalance, 'saldo inicial'),
      ordinaryPayment: parseMoney(loanValue.ordinaryPayment, 'cuota'),
      annualNominalRate: string(loanValue.annualNominalRate, 'tasa'),
      periodsPerYear: number(loanValue.periodsPerYear, 'periodos'),
      roundingPolicy: record(
        loanValue.roundingPolicy,
        'redondeo',
      ) as LoanAggregate['loan']['roundingPolicy'],
      ...(variableRatePlan ? { variableRatePlan } : {}),
      ...(contract ? { contract } : {}),
    });
    const payments = recordValue.payments.map((payment) => parsePayment(payment, schemaVersion));
    const scenarios = recordValue.scenarios.map((scenario) => parseScenario(scenario, loan.id));
    const bankReset = recordValue.bankReset
      ? parseBankReset(recordValue.bankReset, loan.initialBalance.currency)
      : undefined;
    const balanceReconciliations = Array.isArray(recordValue.balanceReconciliations)
      ? recordValue.balanceReconciliations.map((item) =>
          parseBalanceReconciliation(item, loan.initialBalance.currency),
        )
      : bankReset
        ? [legacyResetToBalanceReconciliation(bankReset)]
        : undefined;
    const bankFinalDateReconciliation = recordValue.bankFinalDateReconciliation
      ? parseBankFinalDateReconciliation(recordValue.bankFinalDateReconciliation)
      : bankReset
        ? { bankFinalInstallmentDate: bankReset.bankFinalInstallmentDate }
        : undefined;
    return Object.freeze({
      loan,
      payments: Object.freeze(payments),
      ...(bankReset ? { bankReset } : {}),
      ...(balanceReconciliations
        ? { balanceReconciliations: Object.freeze(balanceReconciliations) }
        : {}),
      ...(bankFinalDateReconciliation ? { bankFinalDateReconciliation } : {}),
      scenarios: Object.freeze(scenarios),
    });
  } catch (cause) {
    if (cause instanceof BackupValidationError) throw cause;
    throw new BackupValidationError(
      cause instanceof Error ? cause.message : 'un agregado no cumple el contrato.',
    );
  }
}

function storeBalanceReconciliation(reconciliation: BankBalanceReconciliation) {
  return Object.freeze({
    id: reconciliation.id,
    reportedAt: reconciliation.reportedAt,
    reportedBalance: storeMoney(reconciliation.reportedBalance),
    ...(reconciliation.adjustment
      ? {
          adjustment: Object.freeze({
            id: reconciliation.adjustment.id,
            date: reconciliation.adjustment.date,
            principalAmount: storeMoney(reconciliation.adjustment.principalAmount),
            reason: reconciliation.adjustment.reason,
          }),
        }
      : {}),
  });
}

function parseBalanceReconciliation(value: unknown, currency: string): BankBalanceReconciliation {
  const recordValue = record(value, 'saldo conciliado');
  const reset = parseBankReset(
    {
      id: string(recordValue.id, 'saldo conciliado.id'),
      cutoffDate: string(recordValue.reportedAt, 'saldo conciliado.fecha'),
      reportedBalance: recordValue.reportedBalance,
      bankFinalInstallmentDate: '9999-12-31',
      ...(recordValue.adjustment ? { adjustment: recordValue.adjustment } : {}),
    },
    currency,
  );
  return Object.freeze({
    id: reset.id,
    reportedAt: reset.cutoffDate,
    reportedBalance: reset.reportedBalance,
    ...(reset.adjustment ? { adjustment: reset.adjustment } : {}),
  });
}

function parseBankFinalDateReconciliation(value: unknown): BankFinalDateReconciliation {
  const date = string(
    record(value, 'fecha final conciliada').bankFinalInstallmentDate,
    'fecha final conciliada.fecha',
  );
  // Valida formato ISO y que sea una fecha posterior a un corte neutro.
  createBankReset({
    id: 'final-date-validation',
    cutoffDate: '1900-01-01',
    reportedBalance: Money.from('0', 'CRC'),
    bankFinalInstallmentDate: date,
  });
  return Object.freeze({ bankFinalInstallmentDate: date });
}

function legacyResetToBalanceReconciliation(reset: BankReset): BankBalanceReconciliation {
  return Object.freeze({
    id: reset.id,
    reportedAt: reset.cutoffDate,
    reportedBalance: reset.reportedBalance,
    ...(reset.adjustment ? { adjustment: reset.adjustment } : {}),
  });
}

function storeMoney(money: Money): StoredMoney {
  return Object.freeze({ amount: money.toDecimalString(), currency: money.currency });
}

function storeContract(contract: LoanContract) {
  if (contract.version === 2) {
    return Object.freeze({
      version: 2 as const,
      originalPrincipal: storeMoney(contract.originalPrincipal),
      monthlyInstallment: storeMoney(contract.monthlyInstallment),
      monthlyInsurance: storeMoney(contract.monthlyInsurance),
      term: Object.freeze({ ...contract.term }),
    });
  }
  return Object.freeze({
    version: 3 as const,
    originalPrincipal: storeMoney(contract.originalPrincipal),
    monthlyTotalPayment: storeMoney(contract.monthlyTotalPayment),
    monthlyInsurance: storeMoney(contract.monthlyInsurance),
    paymentMode: contract.paymentMode,
    term: Object.freeze({ ...contract.term }),
  });
}

function parseContract(value: unknown): LoanContract {
  const contract = record(value, 'préstamo.contrato');
  const version = number(contract.version, 'préstamo.contrato.versión');
  if (version !== 2 && version !== 3)
    throw new BackupValidationError('la versión del contrato no es compatible.');
  const term = record(contract.term, 'préstamo.contrato.plazo');
  const hasEndDate = typeof term.endDate === 'string';
  const hasTotalInstallments = typeof term.totalInstallments === 'number';
  if (hasEndDate === hasTotalInstallments)
    throw new BackupValidationError('el plazo del contrato debe tener una única definición.');
  const parsedTerm: LoanContractV2['term'] = hasEndDate
    ? Object.freeze({ endDate: string(term.endDate, 'préstamo.contrato.fechaFinal') })
    : Object.freeze({
        totalInstallments: number(term.totalInstallments, 'préstamo.contrato.totalCuotas'),
      });
  const common = {
    originalPrincipal: parseMoney(contract.originalPrincipal, 'préstamo.contrato.montoOriginal'),
    monthlyInsurance: parseMoney(contract.monthlyInsurance, 'préstamo.contrato.seguroMensual'),
    term: parsedTerm,
  };
  if (version === 2) {
    return Object.freeze({
      version: 2,
      ...common,
      monthlyInstallment: parseMoney(contract.monthlyInstallment, 'préstamo.contrato.cuotaMensual'),
    });
  }
  return Object.freeze({
    version: 3,
    ...common,
    monthlyTotalPayment: parseMoney(contract.monthlyTotalPayment, 'préstamo.contrato.cuotaTotal'),
    paymentMode: parsePaymentMode(contract.paymentMode),
  }) as LoanContractV3;
}

function parsePaymentMode(value: unknown): LoanContractV3['paymentMode'] {
  if (value === undefined) return 'configured';
  if (value === 'configured' || value === 'automatic') return value;
  throw new BackupValidationError('el modo de cuota no es compatible.');
}
function parseMoney(value: unknown, field: string): Money {
  const money = record(value, field);
  return Money.from(
    string(money.amount, `${field}.amount`),
    string(money.currency, `${field}.currency`),
  );
}
function storePayment(payment: LoanAggregate['payments'][number]) {
  return Object.freeze({
    ...payment,
    totalAmount: storeMoney(payment.totalAmount),
    ...(payment.interestAmount ? { interestAmount: storeMoney(payment.interestAmount) } : {}),
    ...(payment.principalAmount ? { principalAmount: storeMoney(payment.principalAmount) } : {}),
    ...(payment.extraPrincipalAmount
      ? { extraPrincipalAmount: storeMoney(payment.extraPrincipalAmount) }
      : {}),
    ...(payment.insuranceAmount ? { insuranceAmount: storeMoney(payment.insuranceAmount) } : {}),
    ...(payment.feeAmount ? { feeAmount: storeMoney(payment.feeAmount) } : {}),
  });
}

function storeBankReset(bankReset: BankReset) {
  return Object.freeze({
    id: bankReset.id,
    cutoffDate: bankReset.cutoffDate,
    reportedBalance: storeMoney(bankReset.reportedBalance),
    bankFinalInstallmentDate: bankReset.bankFinalInstallmentDate,
    ...(bankReset.adjustment
      ? {
          adjustment: Object.freeze({
            id: bankReset.adjustment.id,
            date: bankReset.adjustment.date,
            principalAmount: storeMoney(bankReset.adjustment.principalAmount),
            reason: bankReset.adjustment.reason,
          }),
        }
      : {}),
  });
}

function parseBankReset(value: unknown, currency: string): BankReset {
  const reset = record(value, 'reset bancario');
  const adjustment = reset.adjustment
    ? record(reset.adjustment, 'reset bancario.ajuste')
    : undefined;
  const bankReset = createBankReset({
    id: string(reset.id, 'reset bancario.id'),
    cutoffDate: string(reset.cutoffDate, 'reset bancario.fechaCorte'),
    reportedBalance: parseMoney(reset.reportedBalance, 'reset bancario.saldoReportado'),
    bankFinalInstallmentDate: string(reset.bankFinalInstallmentDate, 'reset bancario.fechaFinal'),
    ...(adjustment
      ? {
          adjustment: {
            id: string(adjustment.id, 'reset bancario.ajuste.id'),
            date: string(adjustment.date, 'reset bancario.ajuste.fecha'),
            principalAmount: parseMoney(
              adjustment.principalAmount,
              'reset bancario.ajuste.principal',
            ),
            reason: string(adjustment.reason, 'reset bancario.ajuste.motivo'),
          },
        }
      : {}),
  });
  if (
    bankReset.reportedBalance.currency !== currency ||
    bankReset.adjustment?.principalAmount.currency !== currency
  ) {
    throw new BackupValidationError('el reset bancario debe usar la moneda del préstamo.');
  }
  return bankReset;
}
function parsePayment(value: unknown, schemaVersion: number) {
  const payment = record(value, 'pago');
  const source = string(payment.source, 'pago.source');
  if (source !== 'manual' && source !== 'csv_import')
    throw new BackupValidationError('la fuente de pago no es válida.');
  const id = string(payment.id, 'pago.id');
  return createPaymentRecord({
    id,
    date: string(payment.date, 'pago.date'),
    totalAmount: parseMoney(payment.totalAmount, 'pago.total'),
    source,
    ...(typeof payment.sourcePaymentId === 'string'
      ? { sourcePaymentId: payment.sourcePaymentId }
      : source === 'csv_import' && schemaVersion < 6
        ? { sourcePaymentId: id }
        : {}),
    ...(payment.interestAmount
      ? { interestAmount: parseMoney(payment.interestAmount, 'pago.interés') }
      : {}),
    ...(payment.principalAmount
      ? { principalAmount: parseMoney(payment.principalAmount, 'pago.principal') }
      : {}),
    ...(payment.extraPrincipalAmount
      ? { extraPrincipalAmount: parseMoney(payment.extraPrincipalAmount, 'pago.principalExtra') }
      : {}),
    ...(payment.insuranceAmount
      ? { insuranceAmount: parseMoney(payment.insuranceAmount, 'pago.seguro') }
      : {}),
    ...(payment.feeAmount ? { feeAmount: parseMoney(payment.feeAmount, 'pago.comisión') } : {}),
    ...(typeof payment.sourceReference === 'string'
      ? { sourceReference: payment.sourceReference }
      : {}),
    ...(typeof payment.notes === 'string' ? { notes: payment.notes } : {}),
  });
}
function parseScenario(value: unknown, loanId: string): ProjectionScenarioSnapshot {
  const scenario = record(value, 'escenario');
  if (string(scenario.loanId, 'escenario.loanId') !== loanId)
    throw new BackupValidationError('un escenario pertenece a otro préstamo.');
  return Object.freeze({
    id: string(scenario.id, 'escenario.id'),
    loanId,
    name: string(scenario.name, 'escenario.name'),
    createdAt: string(scenario.createdAt, 'escenario.createdAt'),
    configuration: structuredClone(record(scenario.configuration, 'escenario.configuration')),
  });
}
function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BackupValidationError(`${field} debe ser un objeto.`);
  return value as Record<string, unknown>;
}
function string(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new BackupValidationError(`${field} debe ser texto.`);
  return value;
}
function number(value: unknown, field: string): number {
  if (typeof value !== 'number') throw new BackupValidationError(`${field} debe ser numérico.`);
  return value;
}
