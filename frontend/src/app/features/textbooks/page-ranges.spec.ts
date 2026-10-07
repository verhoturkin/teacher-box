import { MAX_BOARD_PAGES, parsePages } from './page-ranges';

describe('parsePages', () => {
  it('reads pages like the backend', () => {
    expect(parsePages(' 7, 1 – 3;2  5 -6 ', null)).toEqual({
      pages: [1, 2, 3, 5, 6, 7],
      text: '1-3, 5-7',
    });
    expect(parsePages('4', 10)).toEqual({ pages: [4], text: '4' });
    expect(parsePages('1,3', 10)?.text).toBe('1, 3');
  });

  it('refuses what is not pages, past the end or too many', () => {
    for (const value of ['', ' ', '0', '3-1', 'a', '1-', '11']) {
      expect(parsePages(value, 10)).toBeNull();
    }
    expect(parsePages(`1-${String(MAX_BOARD_PAGES + 1)}`, null)).toBeNull();
    expect(parsePages('1-20, 30-45', null)).toBeNull();
  });
});
