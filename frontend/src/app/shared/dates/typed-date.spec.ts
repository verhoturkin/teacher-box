import { formatDate, formatMonth, fullDate, parseDate, parseMonth } from './typed-date';

const AUG_17 = new Date(2026, 7, 17);

describe('parseDate', () => {
  it.each([
    '17.08.2026',
    '17/08/2026',
    '17-08-2026',
    '17 08 2026',
    '17.8.2026',
    '17.08.26',
    '17.8.26',
    ' 17. 8 .2026 ',
    '17/8-26',
  ])('reads «%s» as 17 August 2026', (text) => {
    expect(parseDate(text)).toEqual(AUG_17);
  });

  it('reads a day without its leading zero', () => {
    expect(parseDate('1.2.2027')).toEqual(new Date(2027, 1, 1));
  });

  it.each([
    '',
    'завтра',
    '17.08',
    '17082026',
    '17.08.2026.1',
    '17.08.202',
    '17.08.2',
    '117.08.2026',
    '17.108.2026',
    '31.02.2026',
    '29.02.2026',
    '0.08.2026',
    '17.13.2026',
    '17.0.2026',
    '17,08,2026',
  ])('rejects «%s»', (text) => {
    expect(parseDate(text)).toBeNull();
  });

  it('takes 29 February of a leap year', () => {
    expect(parseDate('29.02.2028')).toEqual(new Date(2028, 1, 29));
  });
});

describe('parseMonth', () => {
  it.each(['08.2026', '8/2026', '8-26', '08 26'])('reads «%s» as August 2026', (text) => {
    expect(parseMonth(text)).toEqual(new Date(2026, 7, 1));
  });

  it.each(['', '13.2026', '0.2026', '17.08.2026', '8.202'])('rejects «%s»', (text) => {
    expect(parseMonth(text)).toBeNull();
  });
});

describe('format', () => {
  it('shows a date, a month and the full date in the language of the portal', () => {
    expect(formatDate(AUG_17)).toBe('17.08.2026');
    expect(formatMonth(AUG_17)).toBe('08.2026');
    expect(fullDate(AUG_17)).toBe('понедельник, 17 августа 2026 г.');
  });
});
