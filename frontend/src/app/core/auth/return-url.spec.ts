import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('accepts local paths', () => {
    expect(safeReturnUrl('/teacher/students?x=1')).toBe('/teacher/students?x=1');
  });

  it('rejects missing and foreign targets', () => {
    expect(safeReturnUrl(undefined)).toBeNull();
    expect(safeReturnUrl(null)).toBeNull();
    expect(safeReturnUrl('')).toBeNull();
    expect(safeReturnUrl('https://evil.example')).toBeNull();
    expect(safeReturnUrl('//evil.example')).toBeNull();
    expect(safeReturnUrl('/\\evil.example')).toBeNull();
    expect(safeReturnUrl('teacher')).toBeNull();
  });
});
