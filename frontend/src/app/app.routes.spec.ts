import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { AuthService } from '@core/auth/auth.service';
import { AppTitleStrategy } from '@core/routing/app-title-strategy';
import { authResponse } from '@testing/auth';

describe('app routes', () => {
  let harness: RouterTestingHarness;
  let auth: AuthService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
        providePrimeNG(),
        MessageService,
        { provide: TitleStrategy, useClass: AppTitleStrategy },
      ],
    });
    auth = TestBed.inject(AuthService);
    harness = await RouterTestingHarness.create();
  });

  function text(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  function title(): string {
    return TestBed.inject(Title).getTitle();
  }

  it('shows the sign-in page to anonymous visitors', async () => {
    await harness.navigateByUrl('/');

    expect(TestBed.inject(Router).url).toBe('/login');
    expect(text()).toContain('Вход в Teacher Box');
    expect(title()).toBe('Вход — Teacher Box');
  });

  it('leads the teacher to the teacher area', async () => {
    auth.acceptSession(authResponse('TEACHER'));

    await harness.navigateByUrl('/');

    expect(TestBed.inject(Router).url).toBe('/teacher');
    expect(text()).toContain('Кабинет учителя');
    expect(text()).toContain('Добро пожаловать в Teacher Box');
    expect(title()).toBe('Главная — Teacher Box');
  });

  it('opens the students page for the teacher', async () => {
    auth.acceptSession(authResponse('TEACHER'));

    await harness.navigateByUrl('/teacher/students');
    TestBed.inject(HttpTestingController).expectOne('/api/teacher/students').flush([]);
    await harness.fixture.whenStable();

    expect(title()).toBe('Ученики — Teacher Box');
    expect(text()).toContain('Пока нет ни одного ученика');
  });

  it('leads a student to the personal area and account page', async () => {
    auth.acceptSession(authResponse('STUDENT'));

    await harness.navigateByUrl('/');
    expect(text()).toContain('Личный кабинет');
    expect(title()).toBe('Личный кабинет — Teacher Box');

    await harness.navigateByUrl('/cabinet/account');
    TestBed.inject(HttpTestingController).expectOne('/api/me').flush({
      id: '1',
      role: 'STUDENT',
      displayName: 'Иван Петров',
      login: 'ivan',
      email: null,
      phone: null,
    });
    await harness.fixture.whenStable();
    expect(title()).toBe('Мой аккаунт — Teacher Box');
    expect(text()).toContain('ivan');
  });

  it('opens the teacher account page', async () => {
    auth.acceptSession(authResponse('TEACHER'));

    await harness.navigateByUrl('/teacher/account');

    TestBed.inject(HttpTestingController).expectOne('/api/me');
    expect(title()).toBe('Мой аккаунт — Teacher Box');
  });

  it('opens invitation links without signing in', async () => {
    await harness.navigateByUrl('/invite/abc');

    TestBed.inject(HttpTestingController).expectOne('/api/auth/invites/abc');
    expect(title()).toBe('Приглашение — Teacher Box');
  });

  it('shows the not found page for unknown urls', async () => {
    await harness.navigateByUrl('/no/such/page');

    expect(text()).toContain('404');
    expect(title()).toBe('Страница не найдена — Teacher Box');
  });
});
