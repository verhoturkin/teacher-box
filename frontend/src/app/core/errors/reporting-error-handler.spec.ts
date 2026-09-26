import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { REPORTS_PER_MINUTE, ReportingErrorHandler } from './reporting-error-handler';

describe('ReportingErrorHandler', () => {
  let handler: ReportingErrorHandler;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ReportingErrorHandler],
    });
    handler = TestBed.inject(ReportingErrorHandler);
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    backend.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('sends an error to the server log and keeps it in the console', () => {
    const error = new TypeError('x is undefined');

    handler.handleError(error);

    const request = backend.expectOne('/api/client-errors');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      message: 'TypeError: x is undefined',
      url: window.location.pathname,
      stack: error.stack,
    });
    request.flush(null, { status: 429, statusText: 'Too Many Requests' });
    expect(console.error).toHaveBeenCalled();
  });

  it('describes errors that are not Error objects', () => {
    handler.handleError('just text');
    handler.handleError({ odd: true });

    expect(backend.expectOne((request) => request.body !== null && JSON.stringify(request.body).includes('just text'))
      .request.body).toEqual({ message: 'just text', url: window.location.pathname, stack: null });
    backend.expectOne((request) => JSON.stringify(request.body).includes('Unknown error')).flush(null);
  });

  it('skips HTTP errors, repeats and floods', () => {
    vi.useFakeTimers();
    handler.handleError(new HttpErrorResponse({ status: 500 }));
    backend.expectNone('/api/client-errors');

    handler.handleError(new Error('same'));
    handler.handleError(new Error('same'));
    expect(backend.match('/api/client-errors')).toHaveLength(1);

    for (let i = 0; i < REPORTS_PER_MINUTE + 2; i++) {
      handler.handleError(new Error(`error ${String(i)}`));
    }
    expect(backend.match('/api/client-errors')).toHaveLength(REPORTS_PER_MINUTE - 1);

    vi.advanceTimersByTime(61_000);
    handler.handleError(new Error('later'));
    expect(backend.match('/api/client-errors')).toHaveLength(1);
  });
});
