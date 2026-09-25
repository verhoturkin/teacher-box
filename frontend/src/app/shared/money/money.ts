/**
 * Money helpers. The backend exchanges amounts as integers in minor units (e.g. kopecks) of the
 * instance currency; the UI shows and edits them in major units (roubles).
 */

const LOCALE = 'ru-RU';

function fractionDigits(currency: string): number {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits ?? 2;
}

/** 150000 RUB → 1500 */
export function toMajorUnits(minor: number, currency: string): number {
  return minor / 10 ** fractionDigits(currency);
}

/** 1500.5 RUB → 150050 */
export function toMinorUnits(major: number, currency: string): number {
  return Math.round(major * 10 ** fractionDigits(currency));
}

/** 150000 RUB → «1 500 ₽» (fraction digits only when needed). */
export function formatMoney(minor: number, currency: string): string {
  const major = toMajorUnits(minor, currency);
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(major) ? 0 : fractionDigits(currency),
  }).format(major);
}
