import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MessageService, ToastMessageOptions } from 'primeng/api';
import { SKIP_ERROR_TOAST, apiErrorInterceptor } from './api-error.interceptor';

describe('apiErrorInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let shown: ToastMessageOptions[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        MessageService,
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    shown = [];
    vi.spyOn(TestBed.inject(MessageService), 'add').mockImplementation((message) => {
      shown.push(message);
    });
  });

  afterEach(() => {
    backend.verify();
  });

  function request(context?: HttpContext): { error: unknown } {
    const result: { error: unknown } = { error: undefined };
    http.get('/api/test', context === undefined ? {} : { context }).subscribe({
      error: (error: unknown) => {
        result.error = error;
      },
    });
    return result;
  }

  it('shows a toast with the localized message and rethrows', () => {
    const result = request();

    backend
      .expectOne('/api/test')
      .flush({ status: 409, code: 'concurrent.modification' }, { status: 409, statusText: 'Conflict' });

    expect(shown).toEqual([
      {
        severity: 'error',
        summary: 'Ошибка',
        detail: 'Данные изменились. Обновите страницу и повторите',
      },
    ]);
    expect(result.error).toBeDefined();
  });

  it('does not show a toast for 401', () => {
    const result = request();

    backend.expectOne('/api/test').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(shown).toEqual([]);
    expect(result.error).toBeDefined();
  });

  it('respects SKIP_ERROR_TOAST', () => {
    request(new HttpContext().set(SKIP_ERROR_TOAST, true));

    backend.expectOne('/api/test').flush(null, { status: 500, statusText: 'Server Error' });

    expect(shown).toEqual([]);
  });

  it('passes successful responses through', () => {
    let body: unknown;
    http.get('/api/test').subscribe((value) => {
      body = value;
    });

    backend.expectOne('/api/test').flush({ ok: true });

    expect(body).toEqual({ ok: true });
    expect(shown).toEqual([]);
  });
});
