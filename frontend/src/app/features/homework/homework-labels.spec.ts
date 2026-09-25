import { formatFileSize } from './homework-labels';

describe('formatFileSize', () => {
  it('uses the largest fitting unit', () => {
    expect(formatFileSize(512)).toBe('512 Б');
    expect(formatFileSize(2_560)).toBe('2,5 КБ');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 МБ');
    expect(formatFileSize(3 * 1024 ** 3)).toBe('3 ГБ');
    expect(formatFileSize(5 * 1024 ** 4)).toBe('5 120 ГБ'.replace(' ', ' '));
  });
});
