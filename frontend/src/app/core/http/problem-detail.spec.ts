import { isProblemDetail } from './problem-detail';

describe('isProblemDetail', () => {
  it('accepts objects with a numeric status', () => {
    expect(isProblemDetail({ status: 404, code: 'x.not-found' })).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isProblemDetail(null)).toBe(false);
    expect(isProblemDetail('error')).toBe(false);
    expect(isProblemDetail({})).toBe(false);
    expect(isProblemDetail({ status: '404' })).toBe(false);
  });
});
