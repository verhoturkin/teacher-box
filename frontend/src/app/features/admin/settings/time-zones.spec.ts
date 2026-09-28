import { listTimeZones, timeZoneOptions, utcOffset } from './time-zones';

describe('time zones', () => {
  it('names the offset from UTC', () => {
    const winter = new Date('2026-01-15T12:00:00Z');
    const summer = new Date('2026-07-15T12:00:00Z');

    expect(utcOffset('Europe/Moscow', winter)).toBe('UTC+03:00');
    expect(utcOffset('Europe/Berlin', winter)).toBe('UTC+01:00');
    expect(utcOffset('Europe/Berlin', summer)).toBe('UTC+02:00');
    expect(utcOffset('America/St_Johns', winter)).toBe('UTC-03:30');
    expect(utcOffset('UTC', winter)).toBe('UTC+00:00');
  });

  it('lists the known zones with UTC first', () => {
    const zones = listTimeZones(new Date('2026-01-15T12:00:00Z'));

    expect(zones[0]).toEqual({ label: 'UTC (UTC+00:00)', value: 'UTC' });
    expect(zones).toContainEqual({ label: 'Europe/Moscow (UTC+03:00)', value: 'Europe/Moscow' });
    expect(zones.filter((zone) => zone.value === 'UTC')).toHaveLength(1);
    expect(zones.length).toBeGreaterThan(300);
    expect(timeZoneOptions()).toBe(timeZoneOptions());
  });
});
