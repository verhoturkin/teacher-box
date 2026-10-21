import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { AuthService } from '@core/auth/auth.service';
import { NotificationsSheetState } from '@core/notifications/notifications-sheet-state';
import { AppTitleStrategy } from '@core/routing/app-title-strategy';
import { authResponse } from '@testing/auth';
import { aGroup, aStudent } from '@testing/identity-fixtures';
import { portalSettings } from '@testing/portal-fixtures';
import { testProvidersWithRouter } from '@testing/setup';

// The first navigation loads lazy chunks cold, which can be slow under a parallel coverage run.
describe('app routes', { timeout: 20_000 }, () => {
  let harness: RouterTestingHarness;
  let auth: AuthService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: testProvidersWithRouter(provideRouter(routes, withComponentInputBinding()), {
        provide: TitleStrategy,
        useClass: AppTitleStrategy,
      }),
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

  it('leads the administrator to the status and the other administration pages', async () => {
    auth.acceptSession(authResponse('ADMIN'));
    const backend = TestBed.inject(HttpTestingController);

    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/admin/status');
    expect(title()).toBe('Состояние — Teacher Box');
    expect(text()).toContain('Состояние');
    backend.match(() => true);

    for (const [url, heading] of [
      ['/admin/logs', 'Журнал'],
      ['/admin/integrations', 'Интеграции'],
      ['/admin/backups', 'Копии'],
      ['/admin/account', 'Мой аккаунт'],
    ] as const) {
      await harness.navigateByUrl(url);
      expect(title()).toBe(`${heading} — Teacher Box`);
      backend.match(() => true);
    }
    await harness.navigateByUrl('/teacher');
    expect(TestBed.inject(Router).url).toBe('/admin/status');
    backend.match(() => true);
  });

  it('redirects the old administration pages to Состояние and Журнал (247.1)', async () => {
    auth.acceptSession(authResponse('ADMIN'));
    const backend = TestBed.inject(HttpTestingController);

    await harness.navigateByUrl('/admin/events');
    expect(TestBed.inject(Router).url).toBe('/admin/logs?view=events');
    backend.match(() => true);

    await harness.navigateByUrl('/admin/diagnostics');
    expect(TestBed.inject(Router).url).toBe('/admin/status');
    backend.match(() => true);
  });

  it('shows the sign-in page to anonymous visitors', async () => {
    await harness.navigateByUrl('/');

    expect(TestBed.inject(Router).url).toBe('/login');
    expect(text()).toContain('Вход в Teacher Box');
    expect(title()).toBe('Вход — Teacher Box');
  });

  it('leads the teacher to the teacher area', async () => {
    auth.acceptSession(authResponse('TEACHER'));

    const navigation = harness.navigateByUrl('/');
    await vi.waitFor(() => {
      TestBed.inject(HttpTestingController)
        .expectOne('/api/teacher/portal')
        .flush(portalSettings({ setupCompleted: true }));
    });
    await navigation;

    expect(TestBed.inject(Router).url).toBe('/teacher');
    expect(text()).not.toContain('Кабинет учителя');
    expect(text()).toContain('Сегодня');
    expect(title()).toBe('Сегодня — Teacher Box');
  });

  it('opens the first setup until it is done', async () => {
    auth.acceptSession(authResponse('TEACHER'));
    const backend = TestBed.inject(HttpTestingController);

    const navigation = harness.navigateByUrl('/teacher');
    await vi.waitFor(() => {
      backend.expectOne('/api/teacher/portal').flush(portalSettings({ setupCompleted: false }));
    });
    await navigation;

    expect(TestBed.inject(Router).url).toBe('/teacher/setup');
    expect(title()).toBe('Первоначальная настройка — Teacher Box');
    backend.match(() => true);
  });

  it('asks for a new password before anything else', async () => {
    const response = authResponse('TEACHER');
    auth.acceptSession({ ...response, user: { ...response.user, passwordChangeRequired: true } });

    await harness.navigateByUrl('/teacher/students');

    expect(TestBed.inject(Router).url).toBe('/teacher/setup');
    expect(text()).toContain('Придумайте свой пароль');
    TestBed.inject(HttpTestingController).match(() => true);
  });

  it('opens the students page for the teacher', async () => {
    auth.acceptSession(authResponse('TEACHER'));

    await harness.navigateByUrl('/teacher/students');
    const backend = TestBed.inject(HttpTestingController);
    // the page and the colours of the teacher's lists, loaded when the teacher's area opens
    const lists = backend.match(
      (request) => request.url === '/api/teacher/students' || request.url === '/api/teacher/groups',
    );
    expect(lists.map((request) => request.request.url).sort()).toEqual([
      '/api/teacher/groups',
      '/api/teacher/groups',
      '/api/teacher/students',
      '/api/teacher/students',
    ]);
    for (const request of lists) {
      request.flush([]);
    }
    await harness.fixture.whenStable();

    expect(title()).toBe('Ученики — Teacher Box');
    expect(text()).toContain('Учеников пока нет');
  });

  it('opens the card of a student or a group beside the same list (237.2)', async () => {
    auth.acceptSession(authResponse('TEACHER'));
    const backend = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);

    await harness.navigateByUrl('/teacher/students/s-1');
    const page = harness.routeDebugElement?.componentInstance as unknown;
    for (const request of backend.match(() => true)) {
      const url = request.request.url;
      if (url === '/api/teacher/students') {
        request.flush([aStudent({ id: 's-1', displayName: 'Мария' })]);
      } else if (url === '/api/teacher/groups') {
        request.flush([aGroup({ id: 'g-1', name: 'ОГЭ' })]);
      } else {
        request.flush(null, { status: 500, statusText: 'Error' });
      }
    }
    await harness.fixture.whenStable();
    expect(title()).toBe('Мария — Ученики — Teacher Box');

    // the page stays: the list is not read again, the card changes
    await harness.navigateByUrl('/teacher/groups/g-1');
    expect(harness.routeDebugElement?.componentInstance).toBe(page);
    expect(backend.match('/api/teacher/students')).toEqual([]);
    expect(backend.match('/api/teacher/groups')).toEqual([]);
    expect(title()).toBe('ОГЭ — Ученики — Teacher Box');

    await harness.navigateByUrl('/teacher/students');
    expect(harness.routeDebugElement?.componentInstance).toBe(page);
    expect(title()).toBe('Ученики — Teacher Box');

    // the groups have no page of their own
    await harness.navigateByUrl('/teacher/groups');
    expect(router.url).toBe('/teacher/students');
    await harness.navigateByUrl('/teacher/students/s-1/more');
    expect(text()).toContain('Страница не найдена');
  });

  it('leads a student to the personal area and account page', async () => {
    auth.acceptSession(authResponse('STUDENT'));

    await harness.navigateByUrl('/');
    expect(text()).toContain('Главная');
    expect(title()).toBe('Главная — Teacher Box');

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

  it('opens the billing pages', async () => {
    auth.acceptSession(authResponse('TEACHER'));
    const backend = TestBed.inject(HttpTestingController);

    await harness.navigateByUrl('/teacher/billing');
    backend.expectOne('/api/teacher/billing/overview');
    expect(title()).toBe('Оплаты — Teacher Box');

    await harness.navigateByUrl('/teacher/billing/report');
    backend.expectOne((request) => request.url === '/api/teacher/billing/reports/monthly');
    expect(title()).toBe('Отчёт за месяц — Teacher Box');

    // the history of a student's payments is the Оплаты tab of the card (237.4)
    await harness.navigateByUrl('/teacher/billing/students/s-1');
    expect(TestBed.inject(Router).url).toBe('/teacher/students/s-1?tab=payments');
    expect(title()).toBe('Ученики — Teacher Box');
    backend.match(() => true);

    auth.acceptSession(authResponse('STUDENT'));
    await harness.navigateByUrl('/cabinet/billing');
    backend.expectOne('/api/me/billing');
    expect(title()).toBe('Оплаты — Teacher Box');
  });

  it('opens the homework pages', async () => {
    auth.acceptSession(authResponse('TEACHER'));
    const backend = TestBed.inject(HttpTestingController);

    await harness.navigateByUrl('/teacher/homework');
    backend.expectOne('/api/teacher/homework/assignments');
    backend.expectOne('/api/teacher/homework/review-queue');
    expect(title()).toBe('Задания — Teacher Box');

    // the queue is the «На проверку» filter of the list
    await harness.navigateByUrl('/teacher/homework/review');
    expect(TestBed.inject(Router).url).toBe('/teacher/homework');
    expect(title()).toBe('Задания — Teacher Box');

    await harness.navigateByUrl('/teacher/homework/tasks/t-1');
    backend.expectOne('/api/teacher/homework/tasks/t-1');
    // the work and the assignment open beside the list: the route's title is the list's
    expect(title()).toBe('Задания — Teacher Box');

    await harness.navigateByUrl('/teacher/homework/a-1');
    backend.expectOne('/api/teacher/homework/assignments/a-1');
    expect(title()).toBe('Задания — Teacher Box');

    auth.acceptSession(authResponse('STUDENT'));
    await harness.navigateByUrl('/cabinet/homework');
    backend.expectOne('/api/me/homework');
    expect(title()).toBe('Задания — Teacher Box');

    await harness.navigateByUrl('/cabinet/homework/t-1');
    backend.expectOne('/api/me/homework/tasks/t-1');
    expect(title()).toBe('Задания — Teacher Box');
  });

  it('leads the teacher from the account page to its category of the settings', async () => {
    auth.acceptSession(authResponse('TEACHER'));

    await harness.navigateByUrl('/teacher/account');

    expect(TestBed.inject(Router).url).toBe('/teacher/settings/account');
    TestBed.inject(HttpTestingController).expectOne('/api/me');
    expect(text()).toContain('Мой аккаунт');
  });

  it('leads the student’s notifications page to the home page with the bell’s sheet open', async () => {
    auth.acceptSession(authResponse('STUDENT'));

    await harness.navigateByUrl('/cabinet/notifications?from=bot');

    await vi.waitFor(() => {
      expect(TestBed.inject(Router).url).toBe('/cabinet?from=bot');
    });
    const sheet = TestBed.inject(NotificationsSheetState);
    expect(sheet.open()).toBe(true);
    expect(sheet.tab()).toBe('inbox');
    TestBed.inject(HttpTestingController).match(() => true);
  });

  it('opens the student’s account with the messengers and what to send', async () => {
    auth.acceptSession(authResponse('STUDENT'));

    await harness.navigateByUrl('/cabinet/account');

    expect(title()).toBe('Мой аккаунт — Teacher Box');
    expect(harness.routeNativeElement?.querySelector('tb-channels-panel')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('tb-preferences-panel')).not.toBeNull();
    TestBed.inject(HttpTestingController).match(() => true);
  });

  it.each([
    ['/teacher/notifications', '/teacher', 'inbox'],
    ['/teacher/notifications?tab=inbox', '/teacher', 'inbox'],
    ['/teacher/notifications?from=mail', '/teacher?from=mail', 'inbox'],
  ])('leads %s to the home page with the bell’s sheet open: %s, %s', async (from, to, tab) => {
    auth.acceptSession(authResponse('TEACHER'));

    await harness.navigateByUrl(from);

    await vi.waitFor(() => {
      expect(TestBed.inject(Router).url).toBe(to);
    });
    const sheet = TestBed.inject(NotificationsSheetState);
    expect(sheet.open()).toBe(true);
    expect(sheet.tab()).toBe(tab);
    TestBed.inject(HttpTestingController).match(() => true);
  });

  it.each([
    ['/teacher/notifications?open=messengers', '/teacher/settings/messengers'],
    ['/teacher/notifications?open=unknown,students', '/teacher/settings/messengers'],
    ['/teacher/notifications?tab=preferences', '/teacher/settings/messengers'],
  ])('leads the old links to the messengers into the settings: %s → %s', async (from, to) => {
    auth.acceptSession(authResponse('TEACHER'));

    await harness.navigateByUrl(from);

    expect(TestBed.inject(Router).url).toBe(to);
    TestBed.inject(HttpTestingController).match(() => true);
  });

  it('leads the AI assistant page to its category of the settings', async () => {
    auth.acceptSession(authResponse('TEACHER'));

    await harness.navigateByUrl('/teacher/ai');

    expect(TestBed.inject(Router).url).toBe('/teacher/settings/ai');
    expect(title()).toBe('ИИ-помощник — Настройки — Teacher Box');
    TestBed.inject(HttpTestingController).match(() => true);
  });

  it('opens the settings page for the teacher', async () => {
    auth.acceptSession(authResponse('TEACHER'));

    await harness.navigateByUrl('/teacher/settings');

    TestBed.inject(HttpTestingController).expectOne('/api/teacher/notifications/status');
    // beside the list from expanded: the first category
    expect(title()).toBe('Мой аккаунт — Настройки — Teacher Box');
    TestBed.inject(HttpTestingController).expectOne('/api/me');
  });

  it.each([
    ['/teacher/settings/portal', '/teacher/settings/portal'],
    ['/teacher/settings?open=portal', '/teacher/settings/portal'],
    ['/teacher/settings?open=calendar', '/teacher/settings/calendar'],
    ['/teacher/settings?open=unknown,deliveries,data', '/teacher/settings/messengers'],
    ['/teacher/settings?open=data', '/teacher/settings/data'],
    ['/teacher/settings?open=unknown', '/teacher/settings?open=unknown'],
    ['/teacher/settings?google=connected', '/teacher/settings/calendar?google=connected'],
    ['/teacher/settings?drive=denied&open=portal', '/teacher/settings/data?drive=denied'],
    ['/teacher/settings/calendar?google=failed', '/teacher/settings/calendar?google=failed'],
    ['/teacher/settings/no-such-category', '/teacher/settings'],
    ['/teacher/settings/calls', '/teacher/settings/calls'],
    ['/teacher/calls', '/teacher/settings/calls'],
    ['/teacher/settings/payments', '/teacher/settings/payments'],
    ['/teacher/settings?open=ai', '/teacher/settings/ai'],
  ])('leads the old and unknown addresses of the settings: %s → %s', async (from, to) => {
    auth.acceptSession(authResponse('TEACHER'));

    await harness.navigateByUrl(from);

    expect(TestBed.inject(Router).url).toBe(to);
    expect(title()).toContain('Настройки');
    TestBed.inject(HttpTestingController).match(() => true);
  });

  it('has no addresses under a category of the settings', async () => {
    auth.acceptSession(authResponse('TEACHER'));

    await harness.navigateByUrl('/teacher/settings/portal/extra');

    expect(text()).toContain('Такой страницы нет');
    TestBed.inject(HttpTestingController).match(() => true);
  });

  it('opens invitation links without signing in', async () => {
    await harness.navigateByUrl('/invite/abc');

    TestBed.inject(HttpTestingController).expectOne('/api/auth/invites/abc');
    expect(title()).toBe('Приглашение — Teacher Box');
  });

  it('shows the not found page for unknown urls', async () => {
    await harness.navigateByUrl('/no/such/page');

    expect(text()).toContain('Страница не найдена');
    expect(title()).toBe('Страница не найдена — Teacher Box');
    // a visitor who is not signed in has no frame: the page brings its own main
    expect(document.body.querySelector('main.tb-not-found-page')).not.toBeNull();
  });

  it('keeps the frame of the role around the not found page', async () => {
    auth.acceptSession(authResponse('TEACHER'));
    const backend = TestBed.inject(HttpTestingController);

    await harness.navigateByUrl('/teacher/no-such-page');
    backend.match(() => true);

    expect(text()).toContain('Такой страницы нет');
    expect(title()).toBe('Страница не найдена — Teacher Box');
    expect(document.body.querySelector('tb-shell')).not.toBeNull();
    expect(document.body.querySelectorAll('main')).toHaveLength(1);
    expect(document.body.querySelector('main.tb-not-found-page')).toBeNull();
  });
});
