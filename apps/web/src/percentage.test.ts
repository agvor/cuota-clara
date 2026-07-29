import { describe, expect, test } from 'vitest';

import { decimalRateToPercent, percentToDecimal } from './percentage.js';

describe('porcentajes de interfaz', () => {
  test('convierte una tasa decimal del dominio a porcentaje legible', () => {
    expect(decimalRateToPercent('0.085')).toBe('8.5');
    expect(decimalRateToPercent('0.05')).toBe('5');
  });

  test('convierte un porcentaje del formulario al decimal canónico sin usar number', () => {
    expect(percentToDecimal('8.5')).toBe('0.085');
    expect(percentToDecimal('0.25')).toBe('0.0025');
  });

  test('rechaza una tasa que no sea un porcentaje decimal no negativo', () => {
    expect(() => percentToDecimal('-1')).toThrow(/porcentaje decimal/i);
  });
});
