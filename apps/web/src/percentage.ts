const DECIMAL_LITERAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

/**
 * Convierte la representación decimal del dominio (0.085) a la representación
 * porcentual que se usa exclusivamente en los formularios (8.5).
 */
export function decimalRateToPercent(rate: string): string {
  return shiftDecimal(requireDecimal(rate), 2);
}

/**
 * Convierte un porcentaje introducido por la persona usuaria (8.5) al decimal
 * canónico que persiste el dominio (0.085).
 */
export function percentToDecimal(percent: string): string {
  return shiftDecimal(requireDecimal(percent), -2);
}

function requireDecimal(value: string): string {
  const trimmed = value.trim();
  if (!DECIMAL_LITERAL.test(trimmed)) {
    throw new Error('La tasa debe ser un porcentaje decimal no negativo, por ejemplo 8.5.');
  }
  return trimmed;
}

function shiftDecimal(value: string, positions: number): string {
  const [integer = '0', fraction = ''] = value.split('.');
  const digits = `${integer}${fraction}`;
  const decimalPosition = integer.length + positions;
  let result: string;

  if (decimalPosition <= 0) {
    result = `0.${'0'.repeat(-decimalPosition)}${digits}`;
  } else if (decimalPosition >= digits.length) {
    result = `${digits}${'0'.repeat(decimalPosition - digits.length)}`;
  } else {
    result = `${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
  }

  const [resultInteger = '0', resultFraction = ''] = result.split('.');
  const normalizedInteger = resultInteger.replace(/^0+(?=\d)/, '') || '0';
  const normalizedFraction = resultFraction.replace(/0+$/, '');
  return normalizedFraction ? `${normalizedInteger}.${normalizedFraction}` : normalizedInteger;
}
