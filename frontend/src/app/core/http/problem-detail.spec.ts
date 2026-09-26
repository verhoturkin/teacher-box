import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { REQUEST_ID_HEADER, isProblemDetail, problemCode, requestCode } from './problem-detail';

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

describe('requestCode', () => {
  it('takes the code from the problem or the response header', () => {
    expect(requestCode(new HttpErrorResponse({ status: 500, error: { status: 500, requestId: 'abc123' } }))).toBe(
      'abc123',
    );
    expect(
      requestCode(
        new HttpErrorResponse({
          status: 502,
          error: '<html>Bad Gateway</html>',
          headers: new HttpHeaders({ [REQUEST_ID_HEADER]: 'proxy-1' }),
        }),
      ),
    ).toBe('proxy-1');
  });

  it('is empty without a response', () => {
    expect(requestCode(new HttpErrorResponse({ status: 0 }))).toBeNull();
    expect(requestCode(new HttpErrorResponse({ status: 500, error: { status: 500, requestId: '' } }))).toBeNull();
    expect(requestCode(new Error('x'))).toBeNull();
  });
});
