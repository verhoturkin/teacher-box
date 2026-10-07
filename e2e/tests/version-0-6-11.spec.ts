import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { laterThisWeek } from './this-week';

/**
 * Version 0.6.11: broken scenarios, contrast and accessibility after the UI audit of 2026-09-29
 * (ADR-0023, ADR-0024, ADR-0025) — dialogs of opened sections in the middle of the screen, a failed
 * load with «Повторить», readable colors of every portal color, a visible focus, a modal bottom
 * sheet, field errors as text and no critical or serious axe findings on the main screens.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);

async function signIn(page: Page, login: string, password: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function teacherHeaders(request: APIRequestContext): Promise<Record<string, string>> {
  const login = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  const { accessToken } = (await login.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

/** A student who signed up, with a lesson later this week. */
async function studentWithLesson(
  request: APIRequestContext,
  name: string,
): Promise<{ login: string; password: string }> {
  const headers = await teacherHeaders(request);
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: name, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { student, invite } = (await created.json()) as {
    student: { id: string };
    invite: { token: string };
  };
  const login = `a${RUN}${String(Math.random()).slice(2, 6)}`;
  const password = `pass-${RUN}-secret`;
  expect(
    (
      await request.post(`/api/auth/invites/${invite.token}/accept`, { data: { login, password } })
    ).ok(),
  ).toBe(true);
  const lesson = laterThisWeek(18);
  // `days` counts from this machine's date (laterThisWeek), not from Moscow's
  const day = new Date(Date.now() + lesson.days * 86_400_000).toLocaleDateString('sv-SE');
  const startsAt = `${day}T${String(lesson.hours).padStart(2, '0')}:00:00+03:00`;
  expect(
    (
      await request.post('/api/teacher/schedule/lessons', {
        headers,
        data: { studentId: student.id, startsAt, durationMinutes: 60, allowOverlap: true },
      })
    ).ok(),
  ).toBe(true);
  return { login, password };
}

/** The WCAG contrast of two CSS colors the page computed (`rgb(...)`). */
function contrast(first: string, second: string): number {
  const luminance = (color: string): number => {
    const [red = 0, green = 0, blue = 0] = (color.match(/[\d.]+/g) ?? []).map((value) => {
      const channel = Number(value) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** The colors of roles as the page computed them. */
function roles(page: Page, names: string[]): Promise<Record<string, string>> {
  return page.evaluate((list) => {
    const result: Record<string, string> = {};
    for (const name of list) {
      const probe = document.createElement('span');
      probe.style.color = `var(--p-md-${name})`;
      document.body.append(probe);
      result[name] = getComputedStyle(probe).color;
      probe.remove();
    }
    return result;
  }, names);
}

test('a dialog of an opened section is in the middle of the screen', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1280);
  await page.goto('/teacher/notifications?open=messengers');
  const bots = page.locator('tb-bots-panel');
  await expect(bots.getByRole('listitem').first()).toBeVisible();
  // any bot that is not connected yet (the messengers scenario connects Telegram)
  await bots.getByRole('button', { name: 'Подключить' }).first().click();

  const dialog = page.getByRole('dialog', { name: /^Подключение / });
  await expect(dialog).toBeVisible();
  const mask = await page.locator('.p-dialog-mask').first().boundingBox();
  expect(mask?.x).toBe(0);
  expect(mask?.y).toBe(0);
  expect(mask?.width).toBe(1280);
  const box = await dialog.boundingBox();
  expect((box?.y ?? -1) >= 0 && (box?.y ?? 0) + (box?.height ?? 0) <= 900).toBe(true);
});

test('a failed load says so with «Повторить», not «nothing here»', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1280);
  await page.route('**/api/teacher/students', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/problem+json',
      body: JSON.stringify({ status: 500, code: 'internal.error' }),
    }),
  );
  await page.goto('/teacher/students');

  await expect(page.getByText('Не удалось загрузить учеников')).toBeVisible();
  await expect(page.getByText('Учеников пока нет')).toHaveCount(0);
  await expect(page.locator('.p-toast-message')).toHaveCount(0);

  await page.unroute('**/api/teacher/students');
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByText('Не удалось загрузить учеников')).toHaveCount(0);
});

test('every portal color keeps buttons, links and red text readable in both themes', async ({
  page,
  request,
}) => {
  const headers = await teacherHeaders(request);
  const portal = (await (await request.get('/api/teacher/portal', { headers })).json()) as {
    name: string;
    address: string | null;
    accent: string;
  };
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1280);
  try {
    for (const accent of ['indigo', 'blue', 'teal', 'emerald', 'violet', 'pink', '#fbc02d']) {
      const saved = await request.put('/api/teacher/portal', {
        headers,
        data: { name: portal.name, address: portal.address ?? '', accent },
      });
      expect(saved.ok()).toBe(true);
      for (const dark of [false, true]) {
        await page.evaluate((on) => {
          localStorage.setItem('tb.theme', on ? 'dark' : 'light');
        }, dark);
        await page.goto('/teacher');
        await page.waitForLoadState('networkidle');
        const color = await roles(page, [
          'primary',
          'on-primary',
          'error',
          'surface',
          'surface-container',
          'surface-container-lowest',
          'surface-container-low',
          'primary-container',
          'on-surface-variant',
        ]);
        const pairs: [string, string, string][] = [
          ['кнопка', 'on-primary', 'primary'],
          ['ссылка на карточке', 'primary', 'surface-container-lowest'],
          ['ссылка на странице', 'primary', 'surface-container'],
          ['ссылка на плитке', 'primary', 'surface-container-low'],
          ['ссылка на hero', 'primary', 'primary-container'],
          ['красный текст на плитке', 'error', 'surface-container-low'],
          ['пояснение на плитке', 'on-surface-variant', 'surface-container-low'],
        ];
        for (const [what, text, ground] of pairs) {
          expect
            .soft(contrast(color[text] ?? '', color[ground] ?? ''), `${accent} ${what}`)
            .toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  } finally {
    await request.put('/api/teacher/portal', {
      headers,
      data: { name: portal.name, address: portal.address ?? '', accent: portal.accent },
    });
    await page.evaluate(() => {
      localStorage.removeItem('tb.theme');
    });
  }
});

test('the focus is a visible ring in the navigation, on the current section too', async ({
  page,
}) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1280);
  const nav = page.getByRole('navigation', { name: 'Разделы' });
  const home = nav.getByRole('link', { name: 'Главная' });
  await expect(home).toHaveAttribute('aria-current', 'page');

  await home.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const ring = await home.evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.outlineWidth, style: style.outlineStyle };
  });
  expect(ring).toEqual({ width: '3px', style: 'solid' });
});

test('the bottom sheet of a lesson is a modal dialog with the focus inside', async ({
  browser,
  request,
}) => {
  const student = await studentWithLesson(request, `Лист ${RUN}`);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await signIn(page, student.login, student.password, 390);
  await page.goto('/cabinet/schedule');
  await page
    .getByRole('button', { name: /^Занятие: / })
    .first()
    .click();

  const sheet = page.locator('.p-drawer.tb-sheet');
  await expect(sheet).toHaveAttribute('role', 'dialog');
  await expect(sheet).toHaveAttribute('aria-modal', 'true');
  expect(await sheet.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await context.close();
});

test('a form shows what is wrong at the field instead of a disabled button', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1280);
  await page.goto('/teacher/students');
  await page.getByRole('button', { name: 'Добавить ученика' }).first().click();
  const dialog = page.getByRole('dialog');
  const save = dialog.getByRole('button', { name: 'Сохранить' });
  await expect(save).toBeEnabled();

  await save.click();
  await expect(dialog.getByText('Заполните поле')).toBeVisible();
  await expect(page.locator('#displayName')).toBeFocused();
  await expect(page.locator('#displayName')).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByRole('button', { name: 'Закрыть' })).toBeVisible();
});

test('axe finds nothing critical or serious on the main screens', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1280);
  for (const path of ['/teacher', '/teacher/students', '/teacher/billing', '/teacher/homework']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      // FullCalendar renders empty role=list days (an upstream issue, the audit's DA-080)
      .exclude('.fc')
      .analyze();
    const severe = result.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(
      severe.map((violation) => `${path}: ${violation.id} (${String(violation.nodes.length)})`),
    ).toEqual([]);
  }
});
