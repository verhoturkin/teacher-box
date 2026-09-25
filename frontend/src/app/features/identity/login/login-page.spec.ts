import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { authResponse } from '@testing/auth';
import { buttonByText, hostElement, requireElement, typeInto } from '@testing/dom';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
  });

  async function signIn(login: string, password: string): Promise<void> {
    const host = hostElement(fixture);
    typeInto(requireElement(host, '#login', HTMLInputElement), login);
    typeInto(requireElement(host, '#password', HTMLInputElement), password);
    await fixture.whenStable();
    buttonByText(host, 'Войти').click();
    await fixture.whenStable();
  }

  it('disables submit until the form is filled', () => {
    expect(buttonByText(hostElement(fixture), 'Войти').disabled).toBe(true);
  });

  it('signs in and opens the start page of the role', async () => {
    await signIn('teacher', 'secret-password');

    const request = backend.expectOne('/api/auth/login');
    expect(request.request.body).toEqual({ login: 'teacher', password: 'secret-password' });
    request.flush(authResponse('TEACHER'));

    expect(router.navigateByUrl).toHaveBeenCalledWith('/teacher');
  });

  it('returns to the requested page after sign-in', async () => {
    fixture.componentRef.setInput('returnUrl', '/teacher/students');
    await signIn('teacher', 'secret-password');

    backend.expectOne('/api/auth/login').flush(authResponse('TEACHER'));

    expect(router.navigateByUrl).toHaveBeenCalledWith('/teacher/students');
  });

  it('ignores foreign return urls', async () => {
    fixture.componentRef.setInput('returnUrl', 'https://evil.example');
    await signIn('ivan', 'secret-password');

    backend.expectOne('/api/auth/login').flush(authResponse('STUDENT'));

    expect(router.navigateByUrl).toHaveBeenCalledWith('/cabinet');
  });

  it('explains why sign-in failed', async () => {
    await signIn('teacher', 'wrong-password');

    backend
      .expectOne('/api/auth/login')
      .flush({ status: 401, code: 'auth.locked' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    expect(hostElement(fixture).textContent).toContain('Слишком много неудачных попыток');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('shows a generic message for unexpected errors', async () => {
    await signIn('teacher', 'secret-password');

    backend.expectOne('/api/auth/login').flush(null, { status: 0, statusText: 'Network' });
    await fixture.whenStable();

    expect(hostElement(fixture).textContent).toContain('Не удалось войти');
  });

  it('tells about an expired session', async () => {
    fixture.componentRef.setInput('expired', '1');
    await fixture.whenStable();

    expect(hostElement(fixture).textContent).toContain('Сессия истекла');
  });
});
