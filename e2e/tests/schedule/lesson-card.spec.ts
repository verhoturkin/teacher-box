import { bearer, startSession } from '../support/session';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { create } from '../support/create';

/**
 * Dialogs (ADR-0050) in the schedule: «Итог» of the lesson card marks, changes and clears the outcome; the
 * cancellation of a lesson of a series is a dialog of its own with the scope of the series; a form with typed
 * data asks «Отменить изменения?» before it closes; the answer to a student's request is the toggle
 * «Согласовать | Отклонить»; on a phone a form is a full-screen dialog with its action at the top.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const MARKED = `Итог ${RUN}`;
const UNDONE = `Отмена ${RUN}`;
const SERIES = `Серия ${RUN}`;
const ASKING = `Запрос ${RUN}`;
const STUDENT_PASSWORD = 'e2e-student-pass-289';
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WIDE = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

test.describe.configure({ mode: 'serial' });

async function post<T>(
  request: APIRequestContext,
  headers: Record<string, string>,
  path: string,
  data: unknown,
): Promise<T> {
  const response = await request.post(path, { headers, data });
  expect(response.ok(), `POST ${path}: ${String(response.status())}`).toBe(true);
  return (await response.json()) as T;
}

async function student(
  request: APIRequestContext,
  headers: Record<string, string>,
  displayName: string,
): Promise<string> {
  const created = await post<{ student: { id: string }; invite: { token: string } }>(
    request,
    headers,
    '/api/teacher/students',
    { displayName, email: null, phone: null, note: null },
  );
  return created.student.id;
}

/** A student with a login, who can ask for a change of a lesson. */
async function studentWithLogin(
  request: APIRequestContext,
  headers: Record<string, string>,
  displayName: string,
  login: string,
): Promise<string> {
  const created = await post<{ student: { id: string }; invite: { token: string } }>(
    request,
    headers,
    '/api/teacher/students',
    { displayName, email: null, phone: null, note: null },
  );
  await post(request, {}, `/api/auth/invites/${created.invite.token}/accept`, {
    login,
    password: STUDENT_PASSWORD,
  });
  return created.student.id;
}

function lesson(
  request: APIRequestContext,
  headers: Record<string, string>,
  data: Record<string, unknown>,
): Promise<{ id: string }> {
  return post(request, headers, '/api/teacher/schedule/lessons', {
    durationMinutes: 30,
    allowOverlap: true,
    ...data,
  });
}

async function openMonth(page: Page): Promise<void> {
  await page.setViewportSize(WIDE);
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/schedule');
  await page.getByRole('tab', { name: 'Вид: Месяц', exact: true }).click();
}

test('the calendar marks today in the week and in the month', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/schedule');
  await expect(page.locator('.tb-cal-day--today')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Вид: Месяц', exact: true }).click();
  await expect(page.locator('.tb-cal-date--today')).toHaveCount(1);
});

test('«Итог» marks, changes and clears the outcome of a lesson', async ({ page, request }) => {
  const headers = await bearer(request);
  const id = await student(request, headers, MARKED);
  await lesson(request, headers, {
    studentId: id,
    startsAt: new Date(Date.now() - 2 * HOUR).toISOString(),
  });
  await openMonth(page);
  await page.locator('.tb-lesson', { hasText: MARKED }).first().click();
  const card = page.getByRole('dialog', { name: MARKED });
  const held = card.getByRole('button', { name: 'Проведено' });
  const missed = card.getByRole('button', { name: 'Пропуск' });

  // nothing is selected until the teacher marks the lesson; a press saves at once
  await expect(held).toHaveAttribute('aria-pressed', 'false');
  await held.click();
  await expect(held).toHaveAttribute('aria-pressed', 'true');
  // another option replaces the mark
  await missed.click();
  await expect(missed).toHaveAttribute('aria-pressed', 'true');
  await expect(held).toHaveAttribute('aria-pressed', 'false');
  // a press on the selected option clears the mark
  await missed.click();
  await expect(missed).toHaveAttribute('aria-pressed', 'false');
  await expect(held).toHaveAttribute('aria-pressed', 'false');
  // and the card has no footer buttons for it
  await expect(card.getByRole('button', { name: 'Снять отметку' })).toHaveCount(0);
});

test('a mark needs no confirmation: the snackbar «Отменить» takes it back', async ({
  page,
  request,
}) => {
  const headers = await bearer(request);
  const id = await student(request, headers, UNDONE);
  await lesson(request, headers, {
    studentId: id,
    startsAt: new Date(Date.now() - 2 * HOUR).toISOString(),
  });
  const balance = async (): Promise<number> => {
    const response = await request.get(`/api/teacher/billing/students/${id}`, { headers });
    return ((await response.json()) as { balance: number }).balance;
  };
  const before = await balance();
  await openMonth(page);
  await page.locator('.tb-lesson', { hasText: UNDONE }).first().click();
  const card = page.getByRole('dialog', { name: UNDONE });
  const missed = card.getByRole('button', { name: 'Пропуск' });

  await missed.click();
  await expect(missed).toHaveAttribute('aria-pressed', 'true');
  // no confirmation dialog: the result is a snackbar with «Отменить»
  await expect(page.locator('.tb-snackbar__text', { hasText: 'Отмечено: пропуск' })).toBeVisible();
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();

  await expect(missed).toHaveAttribute('aria-pressed', 'false');
  expect(await balance()).toBe(before);
});

test('a lesson of a series is cancelled in a dialog of its own, for this and the following', async ({
  page,
  request,
}) => {
  const headers = await bearer(request);
  const id = await student(request, headers, SERIES);
  // today, an hour ahead of the end of the day, repeating weekly: the first lesson is in this month
  const start = new Date();
  start.setHours(23, 0, 0, 0);
  if (start.getTime() < Date.now()) start.setTime(start.getTime() + DAY);
  await lesson(request, headers, {
    studentId: id,
    startsAt: start.toISOString(),
    repeatWeeks: 1,
    repeatUntil: new Date(start.getTime() + 21 * DAY).toISOString().slice(0, 10),
  });
  await openMonth(page);
  await page.locator('.tb-lesson', { hasText: SERIES }).first().click();
  const card = page.getByRole('dialog', { name: SERIES });
  await card.getByRole('button', { name: 'Другие действия' }).click();
  await page.getByRole('menuitem', { name: 'Отменить занятие…' }).click();
  // the card closes first: cancelling is a dialog of its own
  await expect(card).toBeHidden();
  const cancel = page.getByRole('dialog', { name: 'Отменить занятие' });
  await expect(cancel.getByRole('radiogroup', { name: 'Применить к' })).toBeVisible();
  await cancel.getByRole('radio', { name: 'Это и следующие' }).check();
  await expect(cancel).toContainText('Существующих занятий для изменения');
  await cancel.getByRole('button', { name: 'Отменить занятие' }).click();
  await expect(cancel).toBeHidden();

  const view = await request.get('/api/teacher/schedule/lessons', {
    headers,
    params: {
      from: new Date(Date.now() - DAY).toISOString().slice(0, 10),
      to: new Date(Date.now() + 40 * DAY).toISOString().slice(0, 10),
      studentId: id,
    },
  });
  expect(view.ok()).toBe(true);
  const ours = (await view.json()) as { status: string }[];
  expect(ours.length).toBeGreaterThan(1);
  expect(ours.every((item) => item.status === 'CANCELLED')).toBe(true);
});

test('a form with typed data asks «Отменить изменения?» before it closes', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/schedule');
  await create(page, 'Занятие');
  const form = page.getByRole('dialog', { name: 'Новое занятие' });
  await expect(form).toBeVisible();
  await page.locator('#schedule-lesson-topic').fill('Черновик');

  await page.keyboard.press('Escape');
  // from medium width the question is a step inside the dialog itself; on a phone it is «Отменить изменения?»
  const ask = form.getByText('Введённые данные не сохранятся.');
  await expect(ask).toBeVisible();
  // «Отмена» keeps the form and what was typed
  await form.getByRole('button', { name: 'Отмена' }).click();
  await expect(ask).toBeHidden();
  await expect(page.locator('#schedule-lesson-topic')).toHaveValue('Черновик');

  await page.keyboard.press('Escape');
  await form.getByRole('button', { name: 'Не сохранять' }).click();
  await expect(form).toBeHidden();
});

test('the teacher declines a request with the toggle «Согласовать | Отклонить»', async ({
  page,
  request,
}) => {
  const headers = await bearer(request);
  const login = `ask-${RUN}`;
  const id = await studentWithLogin(request, headers, ASKING, login);
  const planned = await lesson(request, headers, {
    studentId: id,
    startsAt: new Date(Date.now() + 5 * DAY).toISOString(),
  });
  const studentHeaders = await bearer(request, login, STUDENT_PASSWORD);
  await post(request, studentHeaders, `/api/me/schedule/lessons/${planned.id}/requests`, {
    kind: 'CANCEL',
    proposedStartsAt: null,
    comment: null,
  });

  await page.setViewportSize(WIDE);
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/schedule');
  const row = page.locator('li').filter({ hasText: ASKING }).filter({ hasText: 'отмена' });
  await row.getByRole('button', { name: 'Ответить' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Запрос ученика' });
  const approve = dialog.locator('p-togglebutton', { hasText: 'Согласовать' });
  const decline = dialog.locator('p-togglebutton', { hasText: 'Отклонить' });
  // the answer to approve is the default
  await expect(approve).toHaveAttribute('aria-pressed', 'true');
  await decline.click();
  await expect(decline).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByLabel('Комментарий ученику').fill('Лучше на другой день');
  // one submit button, named by the choice
  await dialog.locator('button[type="submit"]', { hasText: 'Отклонить' }).click();
  await expect(dialog).toBeHidden();

  const pending = await request.get('/api/teacher/schedule/requests', { headers });
  const requests = (await pending.json()) as { studentName: string | null }[];
  expect(requests.some((item) => item.studentName === ASKING)).toBe(false);
});

test('on a phone a form is a full-screen dialog with its action at the top', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/schedule');
  await page.getByRole('button', { name: 'Занятие', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Новое занятие' });
  await expect(form).toBeVisible();
  const box = await form.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width).toBeGreaterThanOrEqual(PHONE.width - 1);
  expect(box?.height).toBeGreaterThanOrEqual(PHONE.height - 9);
  const save = form.getByRole('button', { name: 'Сохранить' });
  const saveBox = await save.boundingBox();
  expect(saveBox?.y).toBeLessThan(80);
  expect(saveBox?.x).toBeGreaterThan(PHONE.width / 2);
});
