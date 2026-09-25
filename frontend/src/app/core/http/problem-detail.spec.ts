import { HttpErrorResponse } from '@angular/common/http';
import { isProblemDetail, problemCode } from './problem-detail';

describe('problemCode', () => {
  it('extracts the code of a problem response', () => {
    const error = new HttpErrorResponse({ status: 409, error: { status: 409, code: 'login.taken' } });

    expect(problemCode(error)).toBe('login.taken');
  });

  it('returns null for everything else', () => {
    expect(problemCode(new HttpErrorResponse({ status: 500, error: 'boom' }))).toBeNull();
    expect(problemCode(new HttpErrorResponse({ status: 404, error: { status: 404 } }))).toBeNull();
    expect(problemCode(new Error('x'))).toBeNull();
  });
});

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
