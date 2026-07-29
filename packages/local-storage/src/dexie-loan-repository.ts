import { Dexie as DexieConstructor, type Table } from 'dexie/dist/dexie.js';

import {
  createLoan,
  createPaymentRecord,
  type Loan,
  type LoanContractV2,
  type LoanAggregate,
  type LoanRepository,
  Money,
  type PaymentRecord,
  type ProjectionScenarioSnapshot,
  type RoundingMode,
  type RoundingPolicy,
} from '@cuotaclara/domain';

const DEFAULT_DATABASE_NAME = 'cuotaclara';
const ROUNDING_MODES: readonly RoundingMode[] = ['half_up', 'half_even', 'down', 'up'];

type StoredMoney = Readonly<{
  amount: string;
  currency: string;
}>;

type StoredLoan = Readonly<{
  id: string;
  name: string;
  startDate: string;
  initialBalance: StoredMoney;
  ordinaryPayment: StoredMoney;
  annualNominalRate: string;
  variableRatePlan?: Loan['variableRatePlan'];
  periodsPerYear: number;
  roundingPolicy: RoundingPolicy;
  contract?: StoredLoanContractV2;
}>;

type StoredLoanContractV2 = Readonly<{
  version: 2;
  originalPrincipal: StoredMoney;
  monthlyInstallment: StoredMoney;
  monthlyInsurance: StoredMoney;
  term: Readonly<{ endDate: string }> | Readonly<{ totalInstallments: number }>;
}>;

type StoredPayment = Readonly<{
  id: string;
  loanId: string;
  date: string;
  totalAmount: StoredMoney;
  interestAmount?: StoredMoney;
  principalAmount?: StoredMoney;
  extraPrincipalAmount?: StoredMoney;
  insuranceAmount?: StoredMoney;
  feeAmount?: StoredMoney;
  source: 'manual' | 'csv_import';
  sourceReference?: string;
  notes?: string;
}>;

type StoredScenario = Readonly<{
  id: string;
  loanId: string;
  name: string;
  configuration: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

export class LocalDataCorruptionError extends Error {
  readonly recoveryAction =
    'Conserve la base local y restaure una copia válida cuando la función de respaldo esté disponible.';

  constructor(
    readonly recordType: 'loan' | 'payment' | 'scenario' | 'aggregate',
    message: string,
  ) {
    super(`Datos locales inválidos (${recordType}): ${message}`);
    this.name = 'LocalDataCorruptionError';
  }
}

export type DexieLoanRepositoryOptions = Readonly<{
  databaseName?: string;
}>;

/** Adaptador local del puerto de préstamos; el dominio no conoce Dexie ni IndexedDB. */
export class DexieLoanRepository implements LoanRepository {
  private readonly database: InstanceType<typeof DexieConstructor>;

  constructor(options: DexieLoanRepositoryOptions = {}) {
    this.database = new DexieConstructor(options.databaseName ?? DEFAULT_DATABASE_NAME);
    this.database.version(1).stores({
      loans: 'id',
      payments: 'id, loanId, [loanId+date]',
      scenarios: 'id, loanId',
    });
    // v2 agrega el contrato como campo no indexado. Las filas v1 se conservan
    // intactas y se reconocen como heredadas por la ausencia de `contract`.
    this.database.version(2).stores({
      loans: 'id',
      payments: 'id, loanId, [loanId+date]',
      scenarios: 'id, loanId',
    });
  }

  async listLoans(): Promise<readonly Loan[]> {
    const records = await this.loans().toArray();
    return records.map((record) => deserializeLoan(record));
  }

  async loadAggregate(loanId: string): Promise<LoanAggregate | undefined> {
    const storedLoan = await this.loans().get(loanId);
    if (!storedLoan) return undefined;

    const [payments, scenarios] = await Promise.all([
      this.payments().where('loanId').equals(loanId).toArray(),
      this.scenarios().where('loanId').equals(loanId).toArray(),
    ]);
    return Object.freeze({
      loan: deserializeLoan(storedLoan),
      payments: Object.freeze(payments.map((payment) => deserializePayment(payment, loanId))),
      scenarios: Object.freeze(scenarios.map((scenario) => deserializeScenario(scenario, loanId))),
    });
  }

  async saveAggregate(aggregate: LoanAggregate): Promise<void> {
    const storedLoan = serializeLoan(aggregate.loan);
    const storedPayments = aggregate.payments.map((payment) =>
      serializePayment(payment, aggregate.loan.id, aggregate.loan.initialBalance.currency),
    );
    const storedScenarios = aggregate.scenarios.map((scenario) =>
      serializeScenario(scenario, aggregate.loan.id),
    );

    await this.database.transaction(
      'rw',
      this.loans(),
      this.payments(),
      this.scenarios(),
      async () => {
        await this.payments().where('loanId').equals(aggregate.loan.id).delete();
        await this.scenarios().where('loanId').equals(aggregate.loan.id).delete();
        await this.loans().put(storedLoan);
        await this.payments().bulkPut(storedPayments);
        await this.scenarios().bulkPut(storedScenarios);
      },
    );
  }

  async deleteLoan(loanId: string): Promise<void> {
    await this.database.transaction(
      'rw',
      this.loans(),
      this.payments(),
      this.scenarios(),
      async () => {
        await this.payments().where('loanId').equals(loanId).delete();
        await this.scenarios().where('loanId').equals(loanId).delete();
        await this.loans().delete(loanId);
      },
    );
  }

  async close(): Promise<void> {
    this.database.close();
  }

  private loans(): Table<StoredLoan, string> {
    return this.database.table<StoredLoan, string>('loans');
  }

  private payments(): Table<StoredPayment, string> {
    return this.database.table<StoredPayment, string>('payments');
  }

  private scenarios(): Table<StoredScenario, string> {
    return this.database.table<StoredScenario, string>('scenarios');
  }
}

function serializeMoney(money: Money): StoredMoney {
  return Object.freeze({ amount: money.toDecimalString(), currency: money.currency });
}

function deserializeMoney(value: unknown, field: string): Money {
  const record = readRecord(value, field);
  return Money.from(readString(record, 'amount', field), readString(record, 'currency', field));
}

function serializeLoan(loan: Loan): StoredLoan {
  try {
    const validLoan = createLoan(loan);
    const { contract, ...legacyLoan } = validLoan;
    return Object.freeze({
      ...legacyLoan,
      initialBalance: serializeMoney(legacyLoan.initialBalance),
      ordinaryPayment: serializeMoney(legacyLoan.ordinaryPayment),
      ...(contract ? { contract: serializeContract(contract) } : {}),
    });
  } catch (error) {
    throw corruption('loan', error);
  }
}

function deserializeLoan(value: unknown): Loan {
  try {
    const record = readRecord(value, 'loan');
    const variableRatePlan = record.variableRatePlan as Loan['variableRatePlan'];
    const contract = record.contract ? deserializeContract(record.contract) : undefined;
    return createLoan({
      id: readString(record, 'id', 'loan'),
      name: readString(record, 'name', 'loan'),
      startDate: readString(record, 'startDate', 'loan'),
      initialBalance: deserializeMoney(record.initialBalance, 'loan.initialBalance'),
      ordinaryPayment: deserializeMoney(record.ordinaryPayment, 'loan.ordinaryPayment'),
      annualNominalRate: readString(record, 'annualNominalRate', 'loan'),
      ...(variableRatePlan ? { variableRatePlan } : {}),
      periodsPerYear: readNumber(record, 'periodsPerYear', 'loan'),
      roundingPolicy: deserializeRoundingPolicy(record.roundingPolicy),
      ...(contract ? { contract } : {}),
    });
  } catch (error) {
    throw corruption('loan', error);
  }
}

function serializeContract(contract: LoanContractV2): StoredLoanContractV2 {
  return Object.freeze({
    version: 2,
    originalPrincipal: serializeMoney(contract.originalPrincipal),
    monthlyInstallment: serializeMoney(contract.monthlyInstallment),
    monthlyInsurance: serializeMoney(contract.monthlyInsurance),
    term: Object.freeze({ ...contract.term }),
  });
}

function deserializeContract(value: unknown): LoanContractV2 {
  const record = readRecord(value, 'loan.contract');
  if (readNumber(record, 'version', 'loan.contract') !== 2) {
    throw new Error('la versión del contrato no es compatible');
  }
  const term = readRecord(record.term, 'loan.contract.term');
  const contractTerm: LoanContractV2['term'] =
    typeof term.endDate === 'string'
      ? Object.freeze({ endDate: term.endDate })
      : Object.freeze({
          totalInstallments: readNumber(term, 'totalInstallments', 'loan.contract.term'),
        });
  return Object.freeze({
    version: 2,
    originalPrincipal: deserializeMoney(
      record.originalPrincipal,
      'loan.contract.originalPrincipal',
    ),
    monthlyInstallment: deserializeMoney(
      record.monthlyInstallment,
      'loan.contract.monthlyInstallment',
    ),
    monthlyInsurance: deserializeMoney(record.monthlyInsurance, 'loan.contract.monthlyInsurance'),
    term: contractTerm,
  });
}

function serializePayment(payment: PaymentRecord, loanId: string, currency: string): StoredPayment {
  try {
    const validPayment = createPaymentRecord(payment);
    assertPaymentCurrency(validPayment, currency);
    return Object.freeze({
      id: validPayment.id,
      loanId,
      date: validPayment.date,
      totalAmount: serializeMoney(validPayment.totalAmount),
      source: validPayment.source,
      ...(validPayment.interestAmount
        ? { interestAmount: serializeMoney(validPayment.interestAmount) }
        : {}),
      ...(validPayment.principalAmount
        ? { principalAmount: serializeMoney(validPayment.principalAmount) }
        : {}),
      ...(validPayment.extraPrincipalAmount
        ? { extraPrincipalAmount: serializeMoney(validPayment.extraPrincipalAmount) }
        : {}),
      ...(validPayment.insuranceAmount
        ? { insuranceAmount: serializeMoney(validPayment.insuranceAmount) }
        : {}),
      ...(validPayment.feeAmount ? { feeAmount: serializeMoney(validPayment.feeAmount) } : {}),
      ...(validPayment.sourceReference ? { sourceReference: validPayment.sourceReference } : {}),
      ...(validPayment.notes ? { notes: validPayment.notes } : {}),
    });
  } catch (error) {
    throw corruption('payment', error);
  }
}

function deserializePayment(value: unknown, loanId: string): PaymentRecord {
  try {
    const record = readRecord(value, 'payment');
    if (readString(record, 'loanId', 'payment') !== loanId) {
      throw new Error('el pago pertenece a otro préstamo');
    }
    const source = readString(record, 'source', 'payment');
    if (source !== 'manual' && source !== 'csv_import') {
      throw new Error('la fuente de pago no es válida');
    }
    return createPaymentRecord({
      id: readString(record, 'id', 'payment'),
      date: readString(record, 'date', 'payment'),
      totalAmount: deserializeMoney(record.totalAmount, 'payment.totalAmount'),
      source,
      ...(record.interestAmount
        ? { interestAmount: deserializeMoney(record.interestAmount, 'payment.interestAmount') }
        : {}),
      ...(record.principalAmount
        ? { principalAmount: deserializeMoney(record.principalAmount, 'payment.principalAmount') }
        : {}),
      ...(record.extraPrincipalAmount
        ? {
            extraPrincipalAmount: deserializeMoney(
              record.extraPrincipalAmount,
              'payment.extraPrincipalAmount',
            ),
          }
        : {}),
      ...(record.insuranceAmount
        ? { insuranceAmount: deserializeMoney(record.insuranceAmount, 'payment.insuranceAmount') }
        : {}),
      ...(record.feeAmount
        ? { feeAmount: deserializeMoney(record.feeAmount, 'payment.feeAmount') }
        : {}),
      ...(typeof record.sourceReference === 'string'
        ? { sourceReference: record.sourceReference }
        : {}),
      ...(typeof record.notes === 'string' ? { notes: record.notes } : {}),
    });
  } catch (error) {
    throw corruption('payment', error);
  }
}

function serializeScenario(scenario: ProjectionScenarioSnapshot, loanId: string): StoredScenario {
  try {
    validateScenario(scenario, loanId);
    return Object.freeze({ ...scenario, configuration: structuredClone(scenario.configuration) });
  } catch (error) {
    throw corruption('scenario', error);
  }
}

function deserializeScenario(value: unknown, loanId: string): ProjectionScenarioSnapshot {
  try {
    const record = readRecord(value, 'scenario');
    const storedLoanId = readString(record, 'loanId', 'scenario');
    if (storedLoanId !== loanId) throw new Error('el escenario pertenece a otro préstamo');
    const configuration = readRecord(record.configuration, 'scenario.configuration');
    return Object.freeze({
      id: readString(record, 'id', 'scenario'),
      loanId: storedLoanId,
      name: readString(record, 'name', 'scenario'),
      configuration: Object.freeze(structuredClone(configuration)),
      createdAt: readString(record, 'createdAt', 'scenario'),
    });
  } catch (error) {
    throw corruption('scenario', error);
  }
}

function deserializeRoundingPolicy(value: unknown): RoundingPolicy {
  const record = readRecord(value, 'loan.roundingPolicy');
  const mode = readString(record, 'mode', 'loan.roundingPolicy');
  if (!ROUNDING_MODES.includes(mode as RoundingMode)) {
    throw new Error('la política de redondeo usa un modo desconocido');
  }
  return Object.freeze({
    scale: readNumber(record, 'scale', 'loan.roundingPolicy'),
    mode: mode as RoundingMode,
  });
}

function validateScenario(scenario: ProjectionScenarioSnapshot, loanId: string): void {
  if (!scenario.id.trim() || !scenario.name.trim() || !scenario.createdAt.trim()) {
    throw new Error('el escenario requiere identificador, nombre y fecha de creación');
  }
  if (scenario.loanId !== loanId) throw new Error('el escenario pertenece a otro préstamo');
  readRecord(scenario.configuration, 'scenario.configuration');
}

function assertPaymentCurrency(payment: PaymentRecord, currency: string): void {
  const amounts = [
    payment.totalAmount,
    payment.interestAmount,
    payment.principalAmount,
    payment.extraPrincipalAmount,
    payment.insuranceAmount,
    payment.feeAmount,
  ];
  if (amounts.some((amount) => amount && amount.currency !== currency)) {
    throw new Error(`el pago debe usar la moneda ${currency}`);
  }
}

function readRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} debe ser un objeto`);
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, field: string, context: string): string {
  const value = record[field];
  if (typeof value !== 'string') throw new Error(`${context}.${field} debe ser texto`);
  return value;
}

function readNumber(record: Record<string, unknown>, field: string, context: string): number {
  const value = record[field];
  if (typeof value !== 'number') throw new Error(`${context}.${field} debe ser numérico`);
  return value;
}

function corruption(
  recordType: LocalDataCorruptionError['recordType'],
  error: unknown,
): LocalDataCorruptionError {
  if (error instanceof LocalDataCorruptionError) return error;
  return new LocalDataCorruptionError(recordType, errorMessage(error));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'error desconocido';
}
