import { formatMoney, toMajorUnits, toMinorUnits } from './money';
import { MoneyPipe } from './money.pipe';

/** Intl uses a non-breaking space as the group separator. */
function normalize(text: string): string {
  return text.replace(/\s/g, ' ');
}

describe('money', () => {
  it('converts between minor and major units', () => {
    expect(toMajorUnits(150_050, 'RUB')).toBe(1500.5);
    expect(toMinorUnits(1500.5, 'RUB')).toBe(150_050);
    expect(toMinorUnits(0.1 + 0.2, 'RUB')).toBe(30);
    expect(toMinorUnits(1500, 'JPY')).toBe(1500);
  });

  it('formats amounts with fraction digits only when needed', () => {
    expect(normalize(formatMoney(150_000, 'RUB'))).toBe('1 500 ₽');
    expect(normalize(formatMoney(150_050, 'RUB'))).toBe('1 500,50 ₽');
    expect(normalize(formatMoney(-5_000, 'RUB'))).toBe('-50 ₽');
  });

  it('is available as a pipe', () => {
    expect(normalize(new MoneyPipe().transform(99_900, 'RUB'))).toBe('999 ₽');
  });
});
