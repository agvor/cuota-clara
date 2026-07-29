import { describe, expect, test } from 'vitest';

import { previewPaymentCsv } from '../src/payment-csv-preview.js';

const csv = `id;date;total_amount;interest_amount;principal_amount;notes
p-001;01/02/2026;340,00;10,00;330,00;Primer pago
p-002;01/03/2026;340,00;6,70;333,30;Segundo pago
p-003;01/05/2026;340,00;0,07;339,93;Falta abril
p-002;01/06/2026;340,00;0,00;340,00;Identificador duplicado
p-005;fecha-invalida;340,00;0,00;340,00;Fecha inválida`;

describe('previewPaymentCsv', () => {
  test('normaliza un CSV regional y previsualiza errores sin persistir', () => {
    const preview = previewPaymentCsv({
      csvText: csv,
      currency: 'CRC',
      format: {
        delimiter: ';',
        decimalSeparator: ',',
        dateFormat: 'dd/mm/yyyy',
      },
      existingPaymentIds: ['payment-already-stored'],
    });

    expect(preview.validRecords).toHaveLength(3);
    expect(preview.validRecords.map((record) => record.date)).toEqual([
      '2026-02-01',
      '2026-03-01',
      '2026-05-01',
    ]);
    expect(preview.validRecords[0]?.totalAmount.toFixed({ scale: 2, mode: 'half_up' })).toBe(
      '340.00',
    );
    expect(preview.errors.map((error) => error.code)).toEqual(['duplicate_id', 'invalid_date']);
    expect(preview.duplicates).toEqual([{ id: 'p-002', rowNumber: 5 }]);
    expect(preview.missingPeriods).toEqual(['2026-04']);
  });

  test('reporta encabezados obligatorios ausentes', () => {
    const preview = previewPaymentCsv({
      csvText: 'id;date\np-001;01/02/2026',
      currency: 'CRC',
      format: {
        delimiter: ';',
        decimalSeparator: ',',
        dateFormat: 'dd/mm/yyyy',
      },
    });

    expect(preview.errors).toContainEqual(
      expect.objectContaining({ code: 'missing_required_header', field: 'total_amount' }),
    );
    expect(preview.validRecords).toHaveLength(0);
  });
});
