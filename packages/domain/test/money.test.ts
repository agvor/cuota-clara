import { describe, expect, test } from 'vitest';

import { AmountScaleError, CurrencyMismatchError, Money } from '../src/money.js';

const twoDecimalHalfUp = { scale: 2, mode: 'half_up' } as const;

describe('Money', () => {
  test('redondea un empate a dos decimales con la política half-up', () => {
    const amount = Money.from('1.005', 'CRC').round(twoDecimalHalfUp);

    expect(amount.toFixed(twoDecimalHalfUp)).toBe('1.01');
  });

  test('acumula importes decimales sin error binario', () => {
    const total = Money.from('0.10', 'CRC').add(Money.from('0.20', 'CRC'));

    expect(total.toFixed(twoDecimalHalfUp)).toBe('0.30');
    expect(total.toDecimalString()).toBe('0.3');
  });

  test('rechaza operaciones entre monedas distintas', () => {
    const colones = Money.from('1.00', 'CRC');
    const dollars = Money.from('1.00', 'USD');

    expect(() => colones.add(dollars)).toThrow(CurrencyMismatchError);
  });

  test('rechaza un valor que excede la escala declarada', () => {
    expect(() => Money.fromFixed('1.001', 'CRC', 2)).toThrow(AmountScaleError);
  });
});
