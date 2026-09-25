import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authResponse } from '@testing/auth';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    backend.verify();
  });

  it('starts anonymous', () => {
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.user()).toBeNull();
    expect(auth.role()).toBeNull();
    expect(auth.accessToken()).toBeNull();
    expect(auth.isAccessTokenFresh()).toBe(false);
    expect(auth.homeUrl()).toBe('/login');
  });

  it('signs in', () => {
    let signedIn: string | undefined;
    auth.login('teacher', 'secret').subscribe((user) => {
      signedIn = user.displayName;
    });

    const request = backend.expectOne('/api/auth/login');
    expect(request.request.body).toEqual({ login: 'teacher', password: 'secret' });
    request.flush(authResponse('TEACHER'));

    expect(signedIn).toBe('Анна Сергеевна');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.role()).toBe('TEACHER');
    expect(auth.accessToken()).toBe('token-TEACHER');
    expect(auth.isAccessTokenFresh()).toBe(true);
    expect(auth.homeUrl()).toBe('/teacher');
  });

  it('keeps the user anonymous when sign-in fails', () => {
    let failed = false;
    auth.login('teacher', 'wrong').subscribe({
      error: () => {
        failed = true;
      },
    });

    backend.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('routes students to the personal area', () => {
    auth.acceptSession(authResponse('STUDENT'));

    expect(auth.homeUrl()).toBe('/cabinet');
  });

  it('treats a token expiring within 30 seconds as stale', () => {
    auth.acceptSession(authResponse('TEACHER', 10));

    expect(auth.isAccessTokenFresh()).toBe(false);
  });

  it('shares one refresh request between concurrent callers', () => {
    const tokens: string[] = [];
    auth.refresh().subscribe((token) => tokens.push(token));
    auth.refresh().subscribe((token) => tokens.push(token));

    backend.expectOne('/api/auth/refresh').flush(authResponse('TEACHER', 900, 'renewed'));

    expect(tokens).toEqual(['renewed', 'renewed']);
    expect(auth.accessToken()).toBe('renewed');

    auth.refresh().subscribe();
    backend.expectOne('/api/auth/refresh').flush(authResponse('TEACHER'));
  });

  it('ends the session and goes to sign-in when refresh fails', () => {
    auth.acceptSession(authResponse('TEACHER'));
    let failed = false;
    auth.refresh().subscribe({
      error: () => {
        failed = true;
      },
    });

    backend.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { expired: 1 } });
  });

  it('restores the session after reload', async () => {
    const restored = auth.restore();
    backend.expectOne('/api/auth/refresh').flush(authResponse('STUDENT'));
    await restored;

    expect(auth.role()).toBe('STUDENT');
  });

  it('stays anonymous when there is nothing to restore', async () => {
    const restored = auth.restore();
    backend.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });
    await restored;

    expect(auth.isAuthenticated()).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('signs out even if the server call fails', () => {
    auth.acceptSession(authResponse('TEACHER'));
    let completed = false;
    auth.logout().subscribe({
      complete: () => {
        completed = true;
      },
    });

    backend.expectOne('/api/auth/logout').flush(null, { status: 500, statusText: 'Error' });

    expect(completed).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
