import { startSession, bearer as teacherHeaders } from '../support/session';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { laterThisWeek } from '../support/this-week';
import { create } from '../support/create';

/**
 * Version 0.6.10: Material 3 Expressive (ADR-0022) — fields 56 px with the label on the outline,
 * the search bar, Expressive menus, «Начать урок» as a split button with the browser in its menu,
 * and on a phone the actions of an upcoming lesson in its bottom sheet.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const MEETING = 'https://telemost.yandex.ru/j/16100000000000';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

async function signIn(page: Page, login: string, password: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await startSession(page, login, password);
}

/** A lesson start in «Ближайшие занятия» of the student: later this week, in Moscow. */
function upcomingStart(hours: number): string {
  const lesson = laterThisWeek(hours);
  // `days` counts from this machine's date (laterThisWeek), not from Moscow's
  const day = new Date(Date.now() + lesson.days * 86_400_000).toLocaleDateString('sv-SE');
  return `${day}T${String(lesson.hours).padStart(2, '0')}:00:00+03:00`;
}

/** A lesson going on now (a few minutes after midnight: soon). */
function ongoingStart(): string {
  const moscow = new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/Moscow' });
  const minutes = Number(moscow.slice(0, 2)) * 60 + Number(moscow.slice(3, 5));
  return new Date(Date.now() + (minutes < 10 ? 5 : -5) * 60_000).toISOString();
}

/** A student who signed up, with a meeting link and a lesson at `startsAt`. */
async function studentWithLesson(
  request: APIRequestContext,
  name: string,
  startsAt: string,
  meeting: boolean,
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
  const login = `s${RUN}${String(Math.random()).slice(2, 6)}`;
  const password = `pass-${RUN}-secret`;
  expect(
    (
      await request.post(`/api/auth/invites/${invite.token}/accept`, { data: { login, password } })
    ).ok(),
  ).toBe(true);
  if (meeting) {
    const room = await request.put('/api/teacher/meetings/rooms', {
      headers,
      data: { studentId: student.id, groupId: null, joinUrl: MEETING },
    });
    expect(room.ok()).toBe(true);
  }
  const lesson = await request.post('/api/teacher/schedule/lessons', {
    headers,
    data: { studentId: student.id, startsAt, durationMinutes: 120, allowOverlap: true },
  });
  expect(lesson.ok()).toBe(true);
  return { login, password };
}

test('a field is 56 px high with its label inside, primary in focus', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1280);
  await page.goto('/teacher/account');

  const input = page.locator('#account-name');
  const label = page.locator('label[for="account-name"]');
  const field = await input.boundingBox();
  const caption = await label.boundingBox();
  expect(Math.round(field?.height ?? 0)).toBe(56);
  // the filled name keeps its small label 8 dp from the top of the field
  expect(Math.round((caption?.y ?? 0) - (field?.y ?? 0))).toBe(8);

  const color = (): Promise<string> => label.evaluate((element) => getComputedStyle(element).color);
  const before = await color();
  await input.focus();
  await expect.poll(color).not.toBe(before);
  const primary = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--p-md-primary)';
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  });
  // the colour follows the focus through a short transition
  await expect.poll(color).toBe(primary);
});

async function filledMetrics(input: Locator) {
  return input.evaluate((element) => {
    const field = element.closest('.tb-field');
    const label = field?.querySelector('label');
    if (!field || !label) throw new Error('Missing filled field or label');
    const box = element.getBoundingClientRect();
    const caption = label.getBoundingClientRect();
    const style = getComputedStyle(element);
    const labelStyle = getComputedStyle(label);
    // the active indicator is the inset shadow of the control: its width and its colour
    const shadow = style.boxShadow.match(/^(.+?\)) 0px -?(\d+(?:\.\d+)?)px/);
    const probe = document.createElement('span');
    document.body.append(probe);
    const role = (name: string): string => {
      probe.style.color = `var(--p-md-${name})`;
      return getComputedStyle(probe).color;
    };
    const primary = role('primary');
    const error = role('error');
    const onSurface = role('on-surface');
    probe.remove();
    return {
      height: box.height,
      labelY: caption.y - box.y,
      labelX: caption.x - box.x,
      labelSize: labelStyle.fontSize,
      labelColor: labelStyle.color,
      labelFill: labelStyle.backgroundColor,
      labelTransform: labelStyle.transform,
      topBorder: style.borderTopWidth,
      sideBorder: style.borderLeftWidth,
      bottomRadius: style.borderBottomLeftRadius,
      indicatorHeight: `${shadow?.[2] ?? '0'}px`,
      indicatorColor: shadow?.[1] ?? '',
      errorIcon: getComputedStyle(field, '::before').content,
      // the small label of a textarea hides the text that scrolls under it
      maskHeight: getComputedStyle(label, '::before').height,
      maskFill: getComputedStyle(label, '::before').backgroundColor,
      fill: style.backgroundColor,
      primary,
      error,
      onSurface,
    };
  });
}

for (const theme of ['Светлая тема', 'Тёмная тема']) {
  for (const width of [1280, 390]) {
    test(`filled student fields follow M3 in ${theme} at ${String(width)}`, async ({
      page,
      request,
    }) => {
      await signIn(page, 'teacher', TEACHER_PASSWORD, width);
      await page.goto('/teacher/students');
      await page.locator('.tb-shell__user-button').click();
      await page.getByRole('menuitemradio', { name: theme, exact: true }).click();
      if (width < 600)
        await page.getByRole('button', { name: 'Добавить ученика', exact: true }).click();
      else await create(page, 'Ученик');
      const dialog = page.getByRole('dialog', { name: 'Новый ученик' });
      const email = dialog.locator('#email');
      await dialog.getByText('Новый ученик', { exact: true }).click();
      await expect.poll(async () => (await filledMetrics(email)).height).toBe(56);
      let metrics = await filledMetrics(email);
      expect(metrics).toMatchObject({
        labelY: 16,
        labelX: 16,
        labelSize: '16px',
        labelFill: 'rgba(0, 0, 0, 0)',
        labelTransform: 'none',
        topBorder: '0px',
        sideBorder: '0px',
        bottomRadius: '0px',
        indicatorHeight: '1px',
        indicatorColor: metrics.onSurface,
      });
      await email.focus();
      await expect.poll(async () => (await filledMetrics(email)).labelY).toBe(8);
      metrics = await filledMetrics(email);
      await expect
        .poll(() => filledMetrics(email))
        .toMatchObject({
          labelSize: '12px',
          labelColor: metrics.primary,
          indicatorHeight: '2px',
          indicatorColor: metrics.primary,
        });
      await email.fill('invalid');
      await email.press('Tab');
      await expect(email).toHaveAttribute('aria-invalid', 'true');
      metrics = await filledMetrics(email);
      await expect
        .poll(() => filledMetrics(email))
        .toMatchObject({
          labelY: 8,
          labelColor: metrics.error,
          indicatorHeight: '1px',
          indicatorColor: metrics.error,
        });
      expect((await filledMetrics(email)).errorIcon).not.toBe('none');
      await email.fill('student@example.com');
      await email.press('Tab');
      await expect(email).not.toHaveAttribute('aria-invalid', 'true');
      await expect.poll(async () => (await filledMetrics(email)).labelY).toBe(8);
      await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();

      const name = `Filled ${String(width)} ${theme} ${RUN}`;
      const response = await request.post('/api/teacher/students', {
        headers: await teacherHeaders(request),
        data: { displayName: name, email: null, phone: null, note: null },
      });
      expect(response.ok()).toBe(true);
      await page.reload();
      await page.getByRole('link', { name, exact: true }).click();
      await page.getByRole('tab', { name: 'Профиль', exact: true }).click();
      const profileName = page.locator('#profile-name');
      await expect.poll(async () => (await filledMetrics(profileName)).height).toBe(56);
      expect(await filledMetrics(profileName)).toMatchObject({ labelY: 8, labelSize: '12px' });
      const note = page.locator('#profile-note');
      expect(await filledMetrics(note)).toMatchObject({ labelY: 16, labelSize: '16px' });
      await note.focus();
      await expect.poll(async () => (await filledMetrics(note)).labelY).toBe(8);
      await note.fill('Заметка');
      await note.press('Tab');
      expect(await filledMetrics(note)).toMatchObject({ labelY: 8, labelSize: '12px' });
      await note.fill(
        Array.from({ length: 12 }, (_, line) => `Заметка ${String(line)}`).join('\n'),
      );
      await note.press('Control+End');
      await expect.poll(() => note.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      const noteMetrics = await filledMetrics(note);
      expect(noteMetrics).toMatchObject({
        labelY: 8,
        maskHeight: '24px',
        maskFill: noteMetrics.fill,
      });
      expect(await filledMetrics(page.locator('#profile-login'))).toMatchObject({
        height: 56,
        labelY: 8,
        labelSize: '12px',
      });
      if (theme === 'Светлая тема' && width === 1280) {
        await note.fill('Заметка об ученике');
        await profileName.focus();
        await expect(profileName).toBeFocused();
        const nameMetrics = await filledMetrics(profileName);
        await expect
          .poll(async () => (await filledMetrics(profileName)).indicatorColor)
          .toBe(nameMetrics.primary);
        await expect
          .poll(async () => (await filledMetrics(note)).indicatorColor)
          .toBe(nameMetrics.onSurface);
        await page.screenshot({ path: test.info().outputPath('student-filled-fields.png') });
      }
    });
  }
}

test('the search is a filled pill and a menu is an Expressive menu', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1280);
  await page.goto('/teacher/students');

  const search = page.getByPlaceholder('Поиск по имени');
  const style = await search.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      radius: parseFloat(computed.borderTopLeftRadius),
      background: computed.backgroundColor,
    };
  });
  expect(style.radius).toBeGreaterThanOrEqual(28);
  expect(style.background).not.toBe('rgba(0, 0, 0, 0)');

  await page.getByRole('button', { name: 'Меню пользователя' }).click();
  const menu = page.locator('.p-menu, .p-tieredmenu').filter({ hasText: 'Мой аккаунт' }).first();
  await expect(menu).toBeVisible();
  expect(await menu.evaluate((element) => getComputedStyle(element).borderTopLeftRadius)).toBe(
    '16px',
  );
  const item = menu.locator('.p-menu-item-content, .p-tieredmenu-item-content').first();
  expect(await item.evaluate((element) => getComputedStyle(element).borderTopLeftRadius)).toBe(
    '12px',
  );
});

test('«Начать урок» is a split button with the browser in its menu', async ({
  browser,
  request,
}) => {
  const name = `Сплит ${RUN}`;
  await studentWithLesson(request, name, ongoingStart(), true);
  const context = await browser.newContext({ userAgent: WINDOWS });
  const page = await context.newPage();
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1280);

  // 0.15.3: no «Сегодня» on the home page — the details of the lesson in the schedule have the button
  await page.goto('/teacher/schedule');
  // the list view: the week grid starts at 07:00, a lesson at night is not in it
  await page.getByRole('tab', { name: /Список/ }).click();
  await page.locator('tb-schedule-calendar').getByText(name).first().click();
  const row = page.getByRole('dialog').filter({ hasText: name });
  const split = row.getByRole('group', { name: 'Начать урок' });
  await expect(split.getByRole('button', { name: 'Начать урок' })).toBeVisible();
  await expect(row.getByRole('link', { name: 'в браузере' })).toHaveCount(0);

  await split.getByRole('button', { name: 'Другие способы открыть встречу' }).click();
  const browserItem = page.getByRole('menuitem', { name: 'Открыть в браузере' });
  await expect(browserItem).toBeVisible();
  await expect(browserItem.locator('a')).toHaveAttribute('href', MEETING);
  await context.close();
});

test('on a phone an upcoming lesson opens its actions in the bottom sheet', async ({
  page,
  request,
}) => {
  const online = await studentWithLesson(request, `Лист ${RUN}`, upcomingStart(21), true);
  await signIn(page, online.login, online.password, 360);
  await page.goto('/cabinet/schedule');

  const row = page.locator('ul.tb-list > li').first();
  // the online lesson keeps its video icon in the markup; on a phone the lead is hidden (0.15.2)
  await expect(row.locator('.tb-list__lead .tb-i-videocam')).toHaveCount(1);
  await expect(row.locator('.tb-list__lead')).toBeHidden();
  await expect(row.getByRole('button', { name: 'Перенести' })).toHaveCount(0);
  await expect(row.getByRole('link', { name: /Войти в урок/ })).toHaveCount(0);

  await row.click();
  const sheet = page.locator('.p-drawer.tb-d--sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('link', { name: /Войти в урок/ })).toHaveAttribute('href', MEETING);
  const halves = await sheet.locator('.tb-button-group .p-button').evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { top: Math.round(box.top), width: Math.round(box.width) };
    }),
  );
  expect(halves).toHaveLength(2);
  expect(halves[0]?.top).toBe(halves[1]?.top);
  expect(Math.abs((halves[0]?.width ?? 0) - (halves[1]?.width ?? -9))).toBeLessThanOrEqual(1);

  await sheet.getByRole('button', { name: 'Перенести' }).click();
  await expect(page.getByRole('dialog').filter({ hasText: 'Перенести занятие' })).toBeVisible();
});

test('on a phone the nearest lesson stacks its buttons', async ({ page, request }) => {
  const plain = await studentWithLesson(request, `Главная ${RUN}`, upcomingStart(20), false);
  await signIn(page, plain.login, plain.password, 360);

  const hero = page.locator('tb-next-lesson-widget');
  const group = hero.locator('.tb-button-group');
  await expect(group.getByRole('button', { name: 'Перенести' })).toBeVisible();
  const tops = await group
    .locator('.p-button')
    .evaluateAll((buttons) =>
      buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
    );
  expect(tops).toHaveLength(2);
  expect(tops[0]).toBe(tops[1]);
});
