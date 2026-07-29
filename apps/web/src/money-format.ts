import { Money, type RoundingPolicy } from '@cuotaclara/domain';

export const MONEY_LOCALE = 'es-CR';

/**
 * Presenta un importe decimal ya redondeado sin convertirlo a `number`.
 * Los campos editables conservan el literal decimal canónico; esta función se
 * usa en toda salida de lectura para no perder precisión al agrupar cifras.
 */
export function formatMoney(
  amount: Money,
  roundingPolicy: RoundingPolicy,
  locale = MONEY_LOCALE,
): string {
  const fixed = amount.toFixed(roundingPolicy);
  const unsigned = fixed.startsWith('-') ? fixed.slice(1) : fixed;
  const [integer = '0', fraction = ''] = unsigned.split('.');
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: amount.currency,
    minimumFractionDigits: roundingPolicy.scale,
    maximumFractionDigits: roundingPolicy.scale,
  });
  const group = new Intl.NumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 })
    .formatToParts(123456789)
    .find((part) => part.type === 'group')?.value;
  const groupedInteger = groupEveryThreeDigits(integer, group ?? ',');
  const parts = formatter.formatToParts(fixed.startsWith('-') ? -0 : 0);

  return parts
    .map((part) => {
      if (part.type === 'integer') return groupedInteger;
      if (part.type === 'fraction') return fraction;
      return part.value;
    })
    .join('');
}

export function formatDecimalMoney(
  amount: string,
  currency: string,
  roundingPolicy: RoundingPolicy,
  locale = MONEY_LOCALE,
): string {
  return formatMoney(Money.from(amount, currency), roundingPolicy, locale);
}

function groupEveryThreeDigits(integer: string, group: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, group);
}
