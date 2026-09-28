/** A time zone to choose from: `Europe/Moscow (UTC+03:00)`. */
export interface TimeZoneOption {
  readonly label: string;
  readonly value: string;
}

let known: readonly TimeZoneOption[] | null = null;

/** The time zones the browser knows (IANA names, as the server expects them), `UTC` first. */
export function timeZoneOptions(): readonly TimeZoneOption[] {
  known ??= listTimeZones(new Date());
  return known;
}

/** The zones with their UTC offset at `at`. */
export function listTimeZones(at: Date): readonly TimeZoneOption[] {
  const names = Intl.supportedValuesOf('timeZone').filter((name) => name !== 'UTC');
  return ['UTC', ...names.sort()].map((name) => ({
    label: `${name} (${utcOffset(name, at)})`,
    value: name,
  }));
}

/** `UTC+03:00`, `UTC-09:30`, `UTC+00:00`. */
export function utcOffset(zone: string, at: Date): string {
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  return name === 'GMT' ? 'UTC+00:00' : name.replace('GMT', 'UTC');
}
