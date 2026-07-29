import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

import {
  ContractEstimateError,
  createLoanV2,
  createLoanV3,
  estimateLoanContract,
  Money,
} from '../src/index.js';

const roundingPolicy = { scale: 2, mode: 'half_up' } as const;

function createContractLoan(term: { endDate: string } | { totalInstallments: number }) {
  return createLoanV2({
    id: 'loan-v2',
    name: 'Hipoteca v2',
    startDate: '2026-01-01',
    originalPrincipal: Money.from('1000.00', 'CRC'),
    monthlyInstallment: Money.from('340.00', 'CRC'),
    monthlyInsurance: Money.from('5.00', 'CRC'),
    term,
    annualNominalRate: '0.12',
    roundingPolicy,
  });
}

describe('estimateLoanContract', () => {
  test('reproduce el caso de referencia con seguro mensual separado', async () => {
    const file = new URL('./fixtures/contract-estimate-monthly-insurance-v1.json', import.meta.url);
    const reference = JSON.parse(await readFile(file, 'utf8')) as {
      caseId: string;
      expected: {
        completionDate: string;
        installments: number;
        totals: Record<string, string>;
        final: Record<string, string>;
      };
    };
    const estimate = estimateLoanContract(createContractLoan({ totalInstallments: 4 }));

    expect(reference.caseId).toBe('contract-estimate-monthly-insurance-v1');
    expect(estimate.finalInstallmentDate).toBe(reference.expected.completionDate);
    expect(estimate.estimatedInstallments).toBe(reference.expected.installments);
    expect(estimate.estimatedInterest.toFixed(roundingPolicy)).toBe(
      reference.expected.totals.interest,
    );
    expect(estimate.estimatedPrincipal.toFixed(roundingPolicy)).toBe(
      reference.expected.totals.principal,
    );
    expect(estimate.estimatedInsurance.toFixed(roundingPolicy)).toBe(
      reference.expected.totals.insurance,
    );
    expect(estimate.estimatedTotal.toFixed(roundingPolicy)).toBe(reference.expected.totals.total);
    expect(estimate.finalInstallment.toFixed(roundingPolicy)).toBe(
      reference.expected.final.installment,
    );
    expect(estimate.finalTotalDue.toFixed(roundingPolicy)).toBe(reference.expected.final.totalDue);
  });

  test('desglosa principal, interés, seguro y total con pago final ajustado', () => {
    const estimate = estimateLoanContract(createContractLoan({ totalInstallments: 4 }));

    expect(estimate).toMatchObject({
      status: 'settled_on_term',
      estimatedInstallments: 4,
      finalInstallmentDate: '2026-05-01',
      hasAdjustedFinalInstallment: true,
    });
    expect(estimate.estimatedPrincipal.toFixed(roundingPolicy)).toBe('1000.00');
    expect(estimate.estimatedInterest.toFixed(roundingPolicy)).toBe('20.07');
    expect(estimate.estimatedInsurance.toFixed(roundingPolicy)).toBe('20.00');
    expect(estimate.estimatedTotal.toFixed(roundingPolicy)).toBe('1040.07');
    expect(estimate.finalInstallment.toFixed(roundingPolicy)).toBe('0.07');
    expect(estimate.finalTotalDue.toFixed(roundingPolicy)).toBe('5.07');
    expect(estimate.remainingPrincipal.toFixed(roundingPolicy)).toBe('0.00');
  });

  test('usa la fecha final declarada como última fecha de pago', () => {
    const estimate = estimateLoanContract(createContractLoan({ endDate: '2026-05-01' }));

    expect(estimate.estimatedInstallments).toBe(4);
    expect(estimate.finalInstallmentDate).toBe('2026-05-01');
  });

  test('conserva el día ancla al construir meses cortos para una fecha final', () => {
    const loan = createLoanV2({
      id: 'loan-anchor',
      name: 'Calendario anclado',
      startDate: '2026-01-31',
      originalPrincipal: Money.from('1000.00', 'CRC'),
      monthlyInstallment: Money.from('340.00', 'CRC'),
      monthlyInsurance: Money.from('0.00', 'CRC'),
      term: { endDate: '2026-05-31' },
      annualNominalRate: '0.12',
      roundingPolicy,
    });

    expect(estimateLoanContract(loan).periods.map((period) => period.date)).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  test('expone saldo pendiente al terminar el plazo en lugar de ocultarlo', () => {
    const estimate = estimateLoanContract(createContractLoan({ totalInstallments: 1 }));

    expect(estimate.status).toBe('remaining_balance');
    expect(estimate.remainingPrincipal.toFixed(roundingPolicy)).toBe('670.00');
    expect(estimate.estimatedPrincipal.toFixed(roundingPolicy)).toBe('330.00');
    expect(estimate.estimatedInterest.toFixed(roundingPolicy)).toBe('10.00');
    expect(estimate.estimatedInsurance.toFixed(roundingPolicy)).toBe('5.00');
    expect(estimate.hasAdjustedFinalInstallment).toBe(false);
  });

  test('rechaza una cuota que no cubre el interés del periodo', () => {
    const loan = createLoanV2({
      id: 'loan-insufficient',
      name: 'Cuota insuficiente',
      startDate: '2026-01-01',
      originalPrincipal: Money.from('1000.00', 'CRC'),
      monthlyInstallment: Money.from('10.00', 'CRC'),
      monthlyInsurance: Money.from('0.00', 'CRC'),
      term: { totalInstallments: 12 },
      annualNominalRate: '0.12',
      roundingPolicy,
    });

    expect(() => estimateLoanContract(loan)).toThrow(ContractEstimateError);
  });

  test('conserva el plazo del caso de referencia y expone la cuota requerida', async () => {
    const file = new URL('./fixtures/contract-total-payment-insufficient-v1.json', import.meta.url);
    const reference = JSON.parse(await readFile(file, 'utf8')) as {
      caseId: string;
      inputs: Record<string, string | number>;
      expected: {
        basePayment: string;
        completionDate: string;
        installments: number;
        projectedInitialTotalPayment: string;
      };
    };
    const loan = createLoanV3({
      id: 'loan-total-insufficient',
      name: 'Cuota total insuficiente',
      startDate: String(reference.inputs.startDate),
      originalPrincipal: Money.from(
        String(reference.inputs.originalPrincipal),
        String(reference.inputs.currency),
      ),
      monthlyTotalPayment: Money.from(
        String(reference.inputs.monthlyTotalPayment),
        String(reference.inputs.currency),
      ),
      monthlyInsurance: Money.from(
        String(reference.inputs.monthlyInsurance),
        String(reference.inputs.currency),
      ),
      term: { totalInstallments: Number(reference.inputs.totalInstallments) },
      annualNominalRate: String(reference.inputs.annualNominalRate),
      roundingPolicy,
    });

    expect(reference.caseId).toBe('contract-total-payment-insufficient-v1');
    expect(loan.ordinaryPayment.toFixed(roundingPolicy)).toBe(reference.expected.basePayment);
    const estimate = estimateLoanContract(loan);
    expect(estimate.status).toBe('settled_on_term');
    expect(estimate.finalInstallmentDate).toBe(reference.expected.completionDate);
    expect(estimate.estimatedInstallments).toBe(reference.expected.installments);
    expect(estimate.projectedInitialTotalPayment?.toFixed(roundingPolicy)).toBe(
      reference.expected.projectedInitialTotalPayment,
    );
    expect(estimate.initialPaymentDifference?.toFixed(roundingPolicy)).toBe('134250.51');
    expect(estimate.hasConfiguredPaymentDifference).toBe(true);
  });

  test('programa la cuota 360 exactamente 30 años después del inicio', () => {
    const loan = createLoanV3({
      id: 'loan-360',
      name: 'Treinta años',
      startDate: '2026-01-15',
      originalPrincipal: Money.from('1000000', 'CRC'),
      monthlyTotalPayment: Money.from('100', 'CRC'),
      monthlyInsurance: Money.from('0', 'CRC'),
      term: { totalInstallments: 360 },
      annualNominalRate: '0',
      roundingPolicy,
    });

    const estimate = estimateLoanContract(loan);
    expect(estimate.finalInstallmentDate).toBe('2056-01-15');
    expect(estimate.estimatedInstallments).toBe(360);
  });
});
