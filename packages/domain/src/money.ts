import { Decimal } from 'decimal.js';

const FinancialDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});
const DECIMAL_LITERAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const CURRENCY_CODE = /^[A-Z]{3}$/;

export type RoundingMode = 'half_up' | 'half_even' | 'down' | 'up';

export type RoundingPolicy = Readonly<{
  scale: number;
  mode: RoundingMode;
}>;

export class CurrencyMismatchError extends Error {
  constructor(left: string, right: string) {
    super(`No se pueden operar importes en ${left} y ${right}.`);
    this.name = 'CurrencyMismatchError';
  }
}

export class AmountScaleError extends Error {
  constructor(value: string, scale: number) {
    super(`El importe ${value} excede la escala máxima de ${scale} decimales.`);
    this.name = 'AmountScaleError';
  }
}

export class MoneyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyValidationError';
  }
}

function validateScale(scale: number): void {
  if (!Number.isInteger(scale) || scale < 0) {
    throw new MoneyValidationError('La escala debe ser un entero no negativo.');
  }
}

function resolveRoundingMode(mode: RoundingMode): Decimal.Rounding {
  const modes: Record<RoundingMode, Decimal.Rounding> = {
    half_up: Decimal.ROUND_HALF_UP,
    half_even: Decimal.ROUND_HALF_EVEN,
    down: Decimal.ROUND_DOWN,
    up: Decimal.ROUND_UP,
  };
  return modes[mode];
}

function decimalPlaces(value: string): number {
  return value.split('.')[1]?.length ?? 0;
}

function parseAmount(value: string): Decimal {
  if (!DECIMAL_LITERAL.test(value)) {
    throw new MoneyValidationError(
      'El importe debe ser un literal decimal, no un número binario ni una expresión.',
    );
  }
  return new FinancialDecimal(value);
}

function normalizeCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!CURRENCY_CODE.test(normalized)) {
    throw new MoneyValidationError('La moneda debe ser un código ISO 4217 de tres letras.');
  }
  return normalized;
}

/** Un importe monetario inmutable respaldado por aritmética decimal. */
export class Money {
  readonly currency: string;

  private constructor(
    private readonly value: Decimal,
    currency: string,
  ) {
    this.currency = currency;
  }

  static from(value: string, currency: string): Money {
    return new Money(parseAmount(value), normalizeCurrency(currency));
  }

  static fromFixed(value: string, currency: string, scale: number): Money {
    validateScale(scale);
    if (decimalPlaces(value) > scale) throw new AmountScaleError(value, scale);
    return Money.from(value, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.value.plus(other.value), this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.value.minus(other.value), this.currency);
  }

  multiplyBy(factor: string): Money {
    return new Money(this.value.times(parseAmount(factor)), this.currency);
  }

  divideBy(divisor: string): Money {
    const decimalDivisor = parseAmount(divisor);
    if (decimalDivisor.isZero()) {
      throw new MoneyValidationError('No se puede dividir un importe entre cero.');
    }
    return new Money(this.value.dividedBy(decimalDivisor), this.currency);
  }

  round(policy: RoundingPolicy): Money {
    validateScale(policy.scale);
    return new Money(
      this.value.toDecimalPlaces(policy.scale, resolveRoundingMode(policy.mode)),
      this.currency,
    );
  }

  toFixed(policy: RoundingPolicy): string {
    validateScale(policy.scale);
    return this.round(policy).value.toFixed(policy.scale);
  }

  /** Representación decimal exacta para persistencia; no aplica redondeo contractual. */
  toDecimalString(): string {
    return this.value.toFixed();
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.isPositive();
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.value.lessThan(other.value);
  }

  isLessThanOrEqualTo(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.value.lessThanOrEqualTo(other.value);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}
