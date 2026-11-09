import { locale } from '@core/i18n/language';
import { T } from './i18n/texts';

/** An option of a select of «Время и цена». */
export interface Option {
  readonly value: string;
  readonly label: string;
}

const t = T.page;
const HOUR = 60;
const DAY = 24 * HOUR;

/** «24 ч», «1 ч 30 мин», «15 мин», «2 дня»: a span of minutes in the largest whole units. */
export function spanLabel(minutes: number): string {
  if (minutes >= 2 * DAY && minutes % DAY === 0) {
    return t.days(minutes / DAY);
  }
  if (minutes < HOUR) {
    return t.minutes(minutes);
  }
  const rest = minutes % HOUR;
  const hours = t.hours(Math.floor(minutes / HOUR));
  return rest === 0 ? hours : `${hours} ${t.minutes(rest)}`;
}

/** What «Добавить» offers for a reminder (the server takes 15 minutes – 7 days). */
export const REMINDER_CHOICES: readonly number[] = [
  15,
  30,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  3 * DAY,
  7 * DAY,
];

/** «UTC+3», «UTC−3:30», «UTC» — the offset of a zone now. */
function offset(zone: string): string {
  const name = new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName: 'shortOffset' })
    .formatToParts(new Date())
    .find((part) => part.type === 'timeZoneName')?.value;
  const utc = (name ?? 'GMT').replace('GMT', 'UTC').replace('-', '−');
  return utc === 'UTC+0' ? 'UTC' : utc;
}

/** «Europe/Moscow (UTC+3)»: the region (underscores as spaces) and its offset now. */
export function zoneLabel(zone: string): string {
  return `${zone.replaceAll('_', ' ')} (${offset(zone)})`;
}

/**
 * The time zones to choose from: the device's first, then the current one if it is not in the list (an alias
 * such as `Europe/Kiev`), then every zone the browser knows in alphabetical order.
 */
export function zoneOptions(current: string, device: string): Option[] {
  const known = Intl.supportedValuesOf('timeZone');
  const zones = [device, current, ...known].filter(
    (zone, index, all) => all.indexOf(zone) === index,
  );
  return zones.map((zone) => ({ value: zone, label: zoneLabel(zone) }));
}

/** «Российский рубль, ₽»: the currency's name in the interface language and its narrow sign. */
export function currencyLabel(code: string): string {
  const name = new Intl.DisplayNames(locale(), { type: 'currency' }).of(code) ?? code;
  const sign = new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency: code,
    currencyDisplay: 'narrowSymbol',
  })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value;
  const capitalised = name.charAt(0).toLocaleUpperCase(locale()) + name.slice(1);
  return sign === undefined || sign === code
    ? `${capitalised}, ${code}`
    : `${capitalised}, ${sign}`;
}

/** Every ISO currency the browser knows, by name; the current one even if it is not among them. */
export function currencyOptions(current: string): Option[] {
  const codes = Intl.supportedValuesOf('currency');
  const all = codes.includes(current) ? codes : [current, ...codes];
  return all
    .map((code) => ({ value: code, label: currencyLabel(code) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale()));
}
