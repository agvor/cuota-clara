import 'fake-indexeddb/auto';

import { Dexie as DexieConstructor } from 'dexie/dist/dexie.js';
import { describe, expect, test } from 'vitest';

import { createLoanV2, createPaymentRecord, createLoan, Money } from '@cuotaclara/domain';

import { DexieLoanRepository, LocalDataCorruptionError } from '../src/dexie-loan-repository.js';

const roundingPolicy = { scale: 2, mode: 'half_up' } as const;

function createAggregate(id = 'loan-001') {
  const loan = createLoan({
    id,
    name: 'Hipoteca principal',
    startDate: '2026-01-01',
    initialBalance: Money.from('100000.00', 'CRC'),
    ordinaryPayment: Money.from('1000.00', 'CRC'),
    annualNominalRate: '0.12',
    periodsPerYear: 12,
    roundingPolicy,
  });
  const payment = createPaymentRecord({
    id: `${id}-payment-001`,
    date: '2026-02-01',
    totalAmount: Money.from('1000.00', 'CRC'),
    interestAmount: Money.from('950.00', 'CRC'),
    principalAmount: Money.from('50.00', 'CRC'),
    source: 'manual',
  });
  return {
    loan,
    payments: [payment],
    scenarios: [
      {
        id: `${id}-scenario-base`,
        loanId: id,
        name: 'Base',
        configuration: { rateMode: 'fixed' },
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };
}

function createRepository(): DexieLoanRepository {
  return new DexieLoanRepository({ databaseName: `cuotaclara-test-${crypto.randomUUID()}` });
}

describe('DexieLoanRepository', () => {
  test('guarda y recupera préstamo, pagos y escenarios mediante el puerto', async () => {
    const repository = createRepository();
    const aggregate = createAggregate();

    await repository.saveAggregate(aggregate);

    await expect(repository.listLoans()).resolves.toMatchObject([
      { id: 'loan-001', name: 'Hipoteca principal' },
    ]);
    await expect(repository.loadAggregate('loan-001')).resolves.toMatchObject({
      loan: { id: 'loan-001' },
      payments: [
        {
          id: 'loan-001-payment-001',
          principalAmount: expect.objectContaining({ currency: 'CRC' }),
        },
      ],
      scenarios: [{ id: 'loan-001-scenario-base', configuration: { rateMode: 'fixed' } }],
    });

    const loaded = await repository.loadAggregate('loan-001');
    expect(loaded?.payments[0]?.principalAmount?.toFixed(roundingPolicy)).toBe('50.00');

    await repository.close();
  });

  test('reemplaza hijos de un préstamo sin afectar los de otro préstamo', async () => {
    const repository = createRepository();
    const first = createAggregate('loan-001');
    const second = createAggregate('loan-002');
    await repository.saveAggregate(first);
    await repository.saveAggregate(second);

    await repository.saveAggregate({
      ...first,
      payments: [
        createPaymentRecord({
          id: 'loan-001-payment-002',
          date: '2026-03-01',
          totalAmount: Money.from('1000.00', 'CRC'),
          principalAmount: Money.from('60.00', 'CRC'),
          source: 'manual',
        }),
      ],
      scenarios: [],
    });

    await expect(repository.loadAggregate('loan-001')).resolves.toMatchObject({
      payments: [{ id: 'loan-001-payment-002' }],
      scenarios: [],
    });
    await expect(repository.loadAggregate('loan-002')).resolves.toMatchObject({
      payments: [{ id: 'loan-002-payment-001' }],
      scenarios: [{ id: 'loan-002-scenario-base' }],
    });

    await repository.close();
  });

  test('valida el agregado antes de modificar los datos ya guardados', async () => {
    const repository = createRepository();
    const aggregate = createAggregate();
    await repository.saveAggregate(aggregate);

    await expect(
      repository.saveAggregate({
        ...aggregate,
        scenarios: [{ ...aggregate.scenarios[0]!, loanId: 'another-loan' }],
      }),
    ).rejects.toThrow(LocalDataCorruptionError);
    await expect(repository.loadAggregate('loan-001')).resolves.toMatchObject({
      scenarios: [{ id: 'loan-001-scenario-base' }],
    });

    await repository.close();
  });

  test('reporta registros persistidos corruptos sin ignorarlos', async () => {
    const databaseName = `cuotaclara-test-${crypto.randomUUID()}`;
    const database = new DexieConstructor(databaseName);
    database.version(1).stores({
      loans: 'id',
      payments: 'id, loanId, [loanId+date]',
      scenarios: 'id, loanId',
    });
    await database.table<{ id: string }, string>('loans').put({ id: 'loan-broken' });
    const repository = new DexieLoanRepository({ databaseName });

    await expect(repository.listLoans()).rejects.toThrow(LocalDataCorruptionError);

    await repository.close();
    database.close();
  });

  test('conserva el contrato v2 y deja los préstamos anteriores como heredados', async () => {
    const repository = createRepository();
    const aggregate = createAggregate();
    const loan = createLoanV2({
      id: aggregate.loan.id,
      name: aggregate.loan.name,
      startDate: aggregate.loan.startDate,
      originalPrincipal: aggregate.loan.initialBalance,
      monthlyInstallment: aggregate.loan.ordinaryPayment,
      monthlyInsurance: Money.from('15.00', 'CRC'),
      term: { totalInstallments: 180 },
      annualNominalRate: aggregate.loan.annualNominalRate,
      roundingPolicy,
    });
    await repository.saveAggregate({ ...aggregate, loan });

    await expect(repository.loadAggregate(loan.id)).resolves.toMatchObject({
      loan: { contract: { version: 2, term: { totalInstallments: 180 } } },
    });
    await repository.close();
  });

  test('migra una base v1 sin inventar contrato ni perder pagos o escenarios', async () => {
    const databaseName = `cuotaclara-test-${crypto.randomUUID()}`;
    const v1 = new DexieConstructor(databaseName);
    v1.version(1).stores({
      loans: 'id',
      payments: 'id, loanId, [loanId+date]',
      scenarios: 'id, loanId',
    });
    await v1.table('loans').put({
      id: 'legacy-001',
      name: 'Préstamo heredado',
      startDate: '2026-01-01',
      initialBalance: { amount: '1000', currency: 'CRC' },
      ordinaryPayment: { amount: '100', currency: 'CRC' },
      annualNominalRate: '0.12',
      periodsPerYear: 12,
      roundingPolicy,
    });
    await v1.table('payments').put({
      id: 'legacy-payment-001',
      loanId: 'legacy-001',
      date: '2026-02-01',
      totalAmount: { amount: '100', currency: 'CRC' },
      source: 'manual',
    });
    await v1.table('scenarios').put({
      id: 'legacy-scenario-001',
      loanId: 'legacy-001',
      name: 'Base',
      configuration: { rateMode: 'fixed' },
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    v1.close();

    const repository = new DexieLoanRepository({ databaseName });
    await expect(repository.loadAggregate('legacy-001')).resolves.toMatchObject({
      loan: { id: 'legacy-001' },
      payments: [{ id: 'legacy-payment-001' }],
      scenarios: [{ id: 'legacy-scenario-001' }],
    });
    const aggregate = await repository.loadAggregate('legacy-001');
    expect(aggregate?.loan.contract).toBeUndefined();
    await repository.close();
  });
});
