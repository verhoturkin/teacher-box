import { type APIRequestContext, expect, test } from '@playwright/test';
import { create } from './create';

const PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function headers(request: APIRequestContext): Promise<Record<string, string>> {
  const response = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: PASSWORD },
  });
  expect(response.ok()).toBe(true);
  const value = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${value.accessToken}` };
}

async function addStudent(request: APIRequestContext, name: string) {
  const auth = await headers(request);
  const response = await request.post('/api/teacher/students', {
    headers: auth,
    data: { displayName: name },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { student: { id: string }; invite: { token: string } };
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин', { exact: true }).fill('teacher');
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
});

test('material creation uses one member field and a full-width search', async ({ page }) => {
  await page.goto('/teacher/materials');
  const search = page.locator('tb-search-field').last();
  await expect(search).toBeVisible();
  const width = await search.evaluate((field) => ({
    actual: field.getBoundingClientRect().width,
    parent: field.parentElement?.getBoundingClientRect().width ?? 0,
  }));
  expect(width.actual).toBeGreaterThan(width.parent * 0.9);
  await create(page, 'Доска');
  const dialog = page.getByRole('dialog', { name: 'Новая доска', exact: true });
  await expect(dialog.locator('tb-member-picker')).toHaveCount(1);
  await expect(dialog.getByLabel('Ученики и группы', { exact: true })).toBeAttached();
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
});

test('AI stays beside one Markdown field and preserves state through compact adaptation', async ({
  page,
}) => {
  await page.route('**/api/teacher/ai/status', (route) =>
    route.fulfill({
      json: {
        enabled: true,
        provider: 'anthropic',
        model: 'test',
        usedThisMonth: 0,
        monthlyTokenLimit: 2000000,
        limitReached: false,
      },
    }),
  );
  await page.route('**/api/teacher/ai/prompts', (route) => route.fulfill({ json: [] }));
  await page.goto('/teacher/homework/new');
  const supporting = page.locator('tb-pane[kind="sheet"]');
  await expect(supporting.locator('tb-homework-ai-panel')).toBeVisible();
  const prompt = supporting.locator('#ai-prompt');
  await prompt.fill('Составь три задачи');
  await page.locator('#editor-title').fill('Авторское название');
  await page.locator('#editor-text').fill('Авторский текст');
  await page.getByRole('button', { name: 'Просмотр', exact: true }).click();
  await expect(page.locator('.tb-preview')).toHaveText('Авторский текст');
  await expect(supporting.locator('tb-homework-ai-panel')).toBeVisible();
  await page.setViewportSize({ width: 500, height: 850 });
  await page.getByRole('button', { name: 'ИИ-помощник', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'ИИ-помощник', exact: true });
  await expect(modal).toBeVisible();
  await expect(modal.locator('#ai-prompt')).toHaveValue('Составь три задачи');
  await modal.getByRole('button', { name: /^Закрыть/ }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole('button', { name: 'ИИ-помощник', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(supporting.locator('#ai-prompt')).toHaveValue('Составь три задачи');
  await expect(page.locator('#editor-title')).toHaveValue('Авторское название');
  await expect(page.locator('.tb-preview')).toHaveText('Авторский текст');
  await expect(supporting).toHaveCSS('opacity', '1');
  await page.screenshot({
    path: 'test-results/version-0-29-0-editor.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 500, height: 850 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(500);
  await page.getByRole('button', { name: 'ИИ-помощник', exact: true }).click();
  await expect(modal).toBeVisible();
  expect(
    await modal.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(501);
  await expect(modal.locator('#ai-prompt')).toHaveValue('Составь три задачи');
});

test('combined grants, bounded material cards and the final preview survive immediate board exit', async ({
  page,
  request,
}) => {
  const name = `Повтор 029 ${Date.now()}`;
  const student = await addStudent(request, name);
  const auth = await headers(request);
  const groupName = `Группа ${name}`;
  const group = await request.post('/api/teacher/groups', {
    headers: auth,
    data: { name: groupName, memberIds: [student.student.id] },
  });
  expect(group.ok()).toBe(true);
  await page.goto('/teacher/materials?tab=boards');
  await create(page, 'Доска');
  const dialog = page.getByRole('dialog', { name: 'Новая доска', exact: true });
  await dialog.locator('#board-title').fill(name);
  await dialog.locator('tb-member-picker p-multiselect').click();
  await page.getByRole('option', { name: `Ученик: ${name}`, exact: true }).click();
  await page.getByRole('option', { name: `Группа: ${groupName}`, exact: true }).click();
  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: 'Создать', exact: true }).click();
  const card = page.locator('tb-material-card').filter({ hasText: name }).first();
  await expect(card).toContainText(groupName);
  expect(
    await card.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(241);
  const link = card.getByRole('link', { name, exact: true });
  const id = (await link.getAttribute('href'))?.split('/').pop();
  await link.click();
  const canvas = page.locator('.excalidraw canvas.interactive');
  await expect(canvas).toBeVisible({ timeout: 30000 });
  await page
    .locator('.excalidraw .App-toolbar')
    .getByTitle(/^Прямоугольник/)
    .click();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('No drawing canvas');
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5 + 100, box.y + box.height * 0.5 + 60, { steps: 6 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/materials/);
  await expect(card.locator('img')).toBeVisible();
  const metadata = await request.get(`/api/boards/${id}`, { headers: auth });
  expect(metadata.ok()).toBe(true);
  const scene = (await metadata.json()) as { elements: { isDeleted?: boolean }[] };
  expect(scene.elements.some((element) => !element.isDeleted)).toBe(true);
  await card.getByRole('link', { name, exact: true }).click();
  await expect(canvas).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(card.locator('img')).toBeVisible();
});

test('all five repeat choices, conversion, occurrence move, following edit and stop reach the student', async ({
  page,
  request,
}) => {
  const name = `Занятие 029 ${Date.now()}`;
  const created = await addStudent(request, name);
  const auth = await headers(request);
  const login = `repeat029${Date.now()}`;
  const password = 'Repeat-029-student-pass';
  expect(
    (
      await request.post(`/api/auth/invites/${created.invite.token}/accept`, {
        data: { login, password },
      })
    ).ok(),
  ).toBe(true);
  await page.goto('/teacher/schedule');
  await create(page, 'Занятие');
  const dialog = page.getByRole('dialog', { name: 'Новое занятие', exact: true });
  for (const label of [
    'Один раз',
    'Каждую неделю',
    'Каждые 2 недели',
    'Каждые 3 недели',
    'Каждые 4 недели',
  ]) {
    await dialog.getByLabel('Повтор', { exact: true }).click();
    await page.getByRole('option', { name: label, exact: true }).click();
    await expect(dialog.locator('p-select[formcontrolname="repeatWeeks"]')).toContainText(label);
  }
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  const startsAt = new Date(Date.now() + 2 * 86400000).toISOString();
  const planned = await request.post('/api/teacher/schedule/lessons', {
    headers: auth,
    data: {
      studentId: created.student.id,
      startsAt,
      durationMinutes: 60,
      repeatWeeks: 0,
      allowOverlap: true,
      topic: name,
    },
  });
  expect(planned.ok()).toBe(true);
  const root = (await planned.json()) as { id: string; version: number };
  const change = async (id: string, start: string, repeatWeeks: number, scope: string) => {
    const response = await request.put(`/api/teacher/schedule/lessons/${id}`, {
      headers: auth,
      data: {
        startsAt: start,
        durationMinutes: 60,
        repeatWeeks,
        scope,
        topic: name,
        allowOverlap: true,
      },
    });
    expect(response.ok()).toBe(true);
    return (await response.json()) as { id: string; occurrenceDate: string; repeatWeeks: number };
  };
  const converted = await change(root.id, startsAt, 1, 'ONLY');
  expect(converted.id).toBe(root.id);
  const from = startsAt.slice(0, 10);
  const to = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
  const list = async () => {
    const response = await request.get(
      `/api/teacher/schedule/lessons?from=${from}&to=${to}&studentId=${created.student.id}`,
      { headers: auth },
    );
    expect(response.ok()).toBe(true);
    return (await response.json()) as { id: string; startsAt: string; occurrenceDate: string }[];
  };
  const before = await list();
  expect(before.length).toBeGreaterThan(5);
  const moved = before[1];
  if (!moved) throw new Error('Missing generated occurrence');
  const movedResult = await change(
    moved.id,
    new Date(Date.parse(moved.startsAt) + 86400000).toISOString(),
    1,
    'ONLY',
  );
  expect(movedResult.occurrenceDate).toBe(moved.occurrenceDate);
  const following = await request.get(`/api/teacher/schedule/lessons/${root.id}/following`, {
    headers: auth,
  });
  expect(((await following.json()) as { protectedLessons: string[] }).protectedLessons).toContain(
    moved.id,
  );
  await change(root.id, startsAt, 2, 'FOLLOWING');
  expect((await list()).some((lesson) => lesson.id === moved.id)).toBe(true);
  await change(root.id, startsAt, 0, 'FOLLOWING');
  expect((await list()).map((lesson) => lesson.id)).toEqual([root.id, moved.id]);
  // A fresh browser session verifies the student's own occurrence projection.
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('Логин', { exact: true }).fill(login);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto('/cabinet/schedule');
  await page.getByRole('tab', { name: 'Вид: Месяц', exact: true }).click();
  await expect(page.locator('tb-schedule-calendar')).toContainText(name);
});

test('profile labels use their containing surface and long search results scroll with the keyboard', async ({
  page,
  request,
}) => {
  const prefix = `Поиск029${Date.now()}`;
  const students = [];
  for (let index = 0; index < 8; index++)
    students.push(await addStudent(request, `${prefix} ${index}`));
  await page.goto(`/teacher/students/${students[0]?.student.id}?tab=profile`);
  await page.getByRole('tab', { name: 'Профиль', exact: true }).click();
  const label = page.locator('tb-student-profile-tab .tb-field > label').first();
  await expect(label).toBeVisible();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    expect(
      await label.evaluate((element) =>
        getComputedStyle(element).getPropertyValue('--tb-field-surface').trim(),
      ),
    ).not.toBe('');
  }
  await page.setViewportSize({ width: 1440, height: 320 });
  const search = page.locator('tb-global-search input').first();
  await search.fill(prefix);
  const panel = page.locator('.tb-search__panel').first();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('option')).toHaveCount(5);
  const more = panel.getByRole('button', { name: /Ещё/ });
  if (await more.isVisible()) await more.click();
  await search.focus();
  for (let index = 0; index < 8; index++) await page.keyboard.press('ArrowDown');
  expect(
    await panel.evaluate(
      (element) => element.scrollHeight > element.clientHeight && element.scrollTop > 0,
    ),
  ).toBe(true);
  await expect(search).toHaveAttribute('aria-activedescendant', /.+/);
});
