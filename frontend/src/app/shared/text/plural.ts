import { Pipe, PipeTransform } from '@angular/core';
import { locale } from '@core/i18n/language';

/** Rules of the current language: in English «few» never comes, `few` and `many` are the same. */
const RULES = new Intl.PluralRules(locale());

/**
 * The form of a noun that agrees with the number: `plural(1, 'токен', 'токена', 'токенов')` is
 * «токен», 2 — «токена», 5 and 11 — «токенов», 22 — «токена». The number and the noun are joined by
 * a non-breaking space in {@link countOf}.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  switch (RULES.select(Math.abs(count))) {
    case 'one':
      return one;
    case 'few':
      return few;
    default:
      return many;
  }
}

/** «22 токена»: the number, a non-breaking space and the noun in the right form. */
export function countOf(count: number, one: string, few: string, many: string): string {
  return `${count.toLocaleString(locale())}\u00A0${plural(count, one, few, many)}`;
}

/**
 * `{{ tokens | count: 'токен' : 'токена' : 'токенов' }}` → «22 токена» (a non-breaking space keeps
 * the number and the noun on one line).
 */
@Pipe({ name: 'count' })
export class CountPipe implements PipeTransform {
  transform(value: number, one: string, few: string, many: string): string {
    return countOf(value, one, few, many);
  }
}
