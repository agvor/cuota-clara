import {
  createLoan,
  createPaymentRecord,
  Money,
  type LoanContract,
  type LoanContractV2,
  type LoanContractV3,
  type LoanAggregate,
  type ProjectionScenarioSnapshot,
} from '@cuotaclara/domain';

const CURRENT_SCHEMA_VERSION = 3;

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
    backup.schemaVersion !== CURRENT_SCHEMA_VERSION
  )
    throw new BackupValidationError('la versión de esquema no es compatible.');
  if (typeof backup.createdAt !== 'string' || !Array.isArray(backup.aggregates))
    throw new BackupValidationError('faltan fecha o agregados.');
  const aggregateIds = new Set<string>();
  const aggregates = backup.aggregates.map((item) => parseAggregate(item));
  for (const aggregate of aggregates) {
    if (aggregateIds.has(aggregate.loan.id))
      throw new BackupValidationError('hay préstamos duplicados.');
    aggregateIds.add(aggregate.loan.id);
  }
  return Object.freeze({ createdAt: backup.createdAt, aggregates: Object.freeze(aggregates) });
}

function parseAggregate(value: unknown): LoanAggregate {
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
    const payments = recordValue.payments.map((payment) => parsePayment(payment));
    const scenarios = recordValue.scenarios.map((scenario) => parseScenario(scenario, loan.id));
    return Object.freeze({
      loan,
      payments: Object.freeze(payments),
      scenarios: Object.freeze(scenarios),
    });
  } catch (cause) {
    if (cause instanceof BackupValidationError) throw cause;
    throw new BackupValidationError(
      cause instanceof Error ? cause.message : 'un agregado no cumple el contrato.',
    );
  }
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
  }) as LoanContractV3;
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
function parsePayment(value: unknown) {
  const payment = record(value, 'pago');
  const source = string(payment.source, 'pago.source');
  if (source !== 'manual' && source !== 'csv_import')
    throw new BackupValidationError('la fuente de pago no es válida.');
  return createPaymentRecord({
    id: string(payment.id, 'pago.id'),
    date: string(payment.date, 'pago.date'),
    totalAmount: parseMoney(payment.totalAmount, 'pago.total'),
    source,
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
