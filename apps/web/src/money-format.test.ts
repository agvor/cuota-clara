import { describe, expect, test } from 'vitest';

import { Money } from '@cuotaclara/domain';

import { formatMoney } from './money-format.js';

const roundingPolicy = { scale: 2, mode: 'half_up' } as const;

describe('formatMoney', () => {
  test('agrupa importes grandes en es-CR sin convertir el decimal a number', () => {
    const formatted = formatMoney(Money.from('115000000', 'CRC'), roundingPolicy);

    expect(formatted).toBe('₡115\u00a0000\u00a0000,00');
  });

  test('conserva el redondeo contractual y el formato de otra moneda', () => {
    const formatted = formatMoney(Money.from('1234.567', 'USD'), roundingPolicy);

    expect(formatted).toBe('USD\u00a01\u00a0234,57');
  });
});
