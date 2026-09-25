import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authResponse } from '@testing/auth';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    backend.verify();
  });

  it('does not touch non-API, auth and anonymous requests', () => {
    http.get('/assets/logo.svg').subscribe();
    http.post('/api/auth/login', {}).subscribe();
    http.get('/api/me').subscribe();

    expect(backend.expectOne('/assets/logo.svg').request.headers.has('Authorization')).toBe(false);
    expect(backend.expectOne('/api/auth/login').request.headers.has('Authorization')).toBe(false);
    expect(backend.expectOne('/api/me').request.headers.has('Authorization')).toBe(false);
  });

  it('adds the access token to API calls', () => {
    auth.acceptSession(authResponse('TEACHER'));

    http.get('/api/me').subscribe();

    expect(backend.expectOne('/api/me').request.headers.get('Authorization')).toBe('Bearer token-TEACHER');
  });

  it('refreshes an expiring token before the call', () => {
    auth.acceptSession(authResponse('TEACHER', 5, 'old'));

    http.get('/api/me').subscribe();
    backend.expectOne('/api/auth/refresh').flush(authResponse('TEACHER', 900, 'fresh'));

    expect(backend.expectOne('/api/me').request.headers.get('Authorization')).toBe('Bearer fresh');
  });

  it('retries once after refreshing on 401', () => {
    auth.acceptSession(authResponse('TEACHER', 900, 'revoked'));
    let body: unknown;
    http.get('/api/me').subscribe((value) => {
      body = value;
    });

    backend.expectOne('/api/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/auth/refresh').flush(authResponse('TEACHER', 900, 'renewed'));
    const retry = backend.expectOne('/api/me');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer renewed');
    retry.flush({ ok: true });

    expect(body).toEqual({ ok: true });
  });

  it('passes other errors through without refreshing', () => {
    auth.acceptSession(authResponse('TEACHER'));
    let status = 0;
    http.get('/api/me').subscribe({
      error: (error: unknown) => {
        status = error instanceof HttpErrorResponse ? error.status : -1;
      },
    });

    backend.expectOne('/api/me').flush(null, { status: 403, statusText: 'Forbidden' });

    expect(status).toBe(403);
    backend.expectNone('/api/auth/refresh');
  });
});
