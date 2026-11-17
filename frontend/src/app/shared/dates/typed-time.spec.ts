import { parseTime, toHhMm } from './typed-time';

describe('parseTime', () => {
  it.each([
    ['14:30', '14:30'],
    ['14.30', '14:30'],
    ['14 30', '14:30'],
    ['1430', '14:30'],
    ['930', '09:30'],
    ['9:05', '09:05'],
    ['0905', '09:05'],
    ['9', '09:00'],
    ['09', '09:00'],
    ['0', '00:00'],
    ['23:59', '23:59'],
    ['  7.45 ', '07:45'],
  ])('reads «%s» as %s', (text, time) => {
    expect(parseTime(text)).toBe(time);
  });

  it.each([
    '',
    'abc',
    '24',
    '24:00',
    '12:60',
    '9:5',
    '123:45',
    '14-30',
    '14:30:00',
    '12345',
    '1:2:3',
  ])('rejects «%s»', (text) => {
    expect(parseTime(text)).toBeNull();
  });

  it('pads hours and minutes', () => {
    expect(toHhMm(7, 5)).toBe('07:05');
  });
});
