import {
  REMINDER_CHOICES,
  currencyLabel,
  currencyOptions,
  spanLabel,
  zoneLabel,
  zoneOptions,
} from './lesson-options';

const plain = (text: string): string => text.replaceAll(' ', ' ');

describe('lesson options', () => {
  it('names a span in the largest whole units', () => {
    expect(plain(spanLabel(15))).toBe('15 мин');
    expect(plain(spanLabel(60))).toBe('1 ч');
    expect(plain(spanLabel(90))).toBe('1 ч 30 мин');
    expect(plain(spanLabel(1440))).toBe('24 ч');
    expect(plain(spanLabel(2880))).toBe('2 дня');
    expect(plain(spanLabel(10080))).toBe('7 дней');
    expect(plain(spanLabel(3000))).toBe('50 ч');
  });

  it('offers reminders within the server limits', () => {
    expect(REMINDER_CHOICES.every((minutes) => minutes >= 15 && minutes <= 10080)).toBe(true);
  });

  it('names a zone with its offset now', () => {
    expect(zoneLabel('Asia/Kolkata')).toBe('Asia/Kolkata (UTC+5:30)');
    expect(zoneLabel('America/Argentina/Buenos_Aires')).toBe(
      'America/Argentina/Buenos Aires (UTC−3)',
    );
    expect(zoneLabel('UTC')).toBe('UTC (UTC)');
  });

  it('lists the device zone first and keeps a stored zone the browser does not list', () => {
    const options = zoneOptions('Europe/Kiev', 'Asia/Tokyo');
    expect(options[0]?.value).toBe('Asia/Tokyo');
    expect(options.filter((option) => option.value === 'Asia/Tokyo')).toHaveLength(1);
    expect(options.some((option) => option.value === 'Europe/Kiev')).toBe(true);
    expect(options.length).toBeGreaterThan(300);
  });

  it('names a currency with its sign, or its code when it has none of its own', () => {
    expect(currencyLabel('RUB')).toBe('Российский рубль, ₽');
    expect(currencyLabel('CHF')).toBe('Швейцарский франк, CHF');
  });

  it('lists the currencies by name, the stored one even if the browser does not know it', () => {
    const options = currencyOptions('XYZ');
    expect(options.some((option) => option.value === 'XYZ')).toBe(true);
    const labels = options.map((option) => option.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'ru')));
    expect(currencyOptions('RUB').filter((option) => option.value === 'RUB')).toHaveLength(1);
  });
});
