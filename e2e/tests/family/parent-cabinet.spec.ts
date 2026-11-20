import { type APIRequestContext, type Browser, type Page, expect, test } from '@playwright/test';
import { bearer, startSession } from '../support/session';
import { enterDateTime } from '../support/date-time';
import { laterThisWeek } from '../support/this-week';

/**
 * Stage 455.2, the parent's cabinet (ADR-0069): the teacher invites a parent from the student's card →
 * the parent accepts the link and lands in /family/<child> → sees the child's lessons, homework and
 * payments, and gets 404 for another student → asks to move a lesson → the teacher agrees → the answer
 * and the new lesson reach the parent's inbox with the child's first name; the teacher hides payments
 * → the student loses them, the parent keeps them.
 */

test.describe.configure({ mode: 'serial' });

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const CHILD = `Петя Семейный-${RUN}`;
const OTHER = `Чужой ${RUN}`;
const PARENT = 'Анна';
const CHILD_LOGIN = `child-${RUN}`;
const PARENT_LOGIN = `parent-${RUN}`;
const PASSWORD = 'e2e-family-pass';
const TOPIC = `Дроби ${RUN}`;
const HOMEWORK = `Задачи про дроби ${RUN}`;

let childId = '';
let otherId = '';
let lessonId = '';
let inviteLink = '';

async function newStudent(
  request: APIRequestContext,
  headers: Record<string, string>,
  displayName: string,
): Promise<{ id: string; token: string }> {
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const body = (await created.json()) as { student: { id: string }; invite: { token: string } };
  return { id: body.student.id, token: body.invite.token };
}

async function signedIn(browser: Browser, login: string, password: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await startSession(page, login, password);
  return page;
}

test.beforeAll(async ({ request }) => {
  const headers = await bearer(request);
  const child = await newStudent(request, headers, CHILD);
  childId = child.id;
  const accepted = await request.post(`/api/auth/invites/${child.token}/accept`, {
    data: { login: CHILD_LOGIN, password: PASSWORD },
  });
  expect(accepted.ok()).toBe(true);
  otherId = (await newStudent(request, headers, OTHER)).id;
  const today = new Date().toISOString().slice(0, 10);
  const paid = await request.post('/api/teacher/billing/payments', {
    headers,
    data: { studentId: childId, amount: 250_000, paidOn: today, comment: 'Перевод от мамы' },
  });
  expect(paid.ok()).toBe(true);
  const assignment = await request.post('/api/teacher/homework/assignments', {
    headers,
    data: { title: HOMEWORK, description: 'Номера 1–5', studentIds: [childId] },
  });
  expect(assignment.ok()).toBe(true);
});

test('the teacher invites a parent from the student card', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  await page.goto(`/teacher/students/${childId}?tab=profile`);
  await page.getByRole('button', { name: 'Пригласить родителя' }).click();
  const dialog = page.getByRole('dialog', { name: 'Пригласить родителя' });
  await dialog.getByLabel('Имя родителя').fill(PARENT);
  await dialog.getByRole('button', { name: 'Пригласить', exact: true }).click();
  const link = page.getByRole('textbox', { name: 'Ссылка-приглашение' });
  await expect(link).toHaveValue(/\/invite\//);
  inviteLink = await link.inputValue();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('list', { name: 'Родители ученика' })).toContainText(PARENT);
});

test('the parent accepts the link and sees the child', async ({ browser, request }) => {
  const parent = await (await browser.newContext()).newPage();
  await parent.goto(inviteLink);
  await parent.getByLabel('Логин').fill(PARENT_LOGIN);
  await parent.locator('#password').fill(PASSWORD);
  await parent.locator('#confirm').fill(PASSWORD);
  await parent.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(parent).toHaveURL(new RegExp(`/family/${childId}$`));

  // a lesson planned now reaches the parent's inbox, named after the child (455.1)
  const headers = await bearer(request);
  const lesson = await laterThisWeek(13);
  const planned = await request.post('/api/teacher/schedule/lessons', {
    headers,
    data: {
      studentId: childId,
      startsAt: lesson.startsAt,
      durationMinutes: 60,
      topic: TOPIC,
      allowOverlap: true,
    },
  });
  expect(planned.ok()).toBe(true);
  ({ id: lessonId } = (await planned.json()) as { id: string });

  await parent.goto(`/family/${childId}/schedule?lesson=${lessonId}`);
  await expect(parent.getByText(TOPIC).first()).toBeVisible();
  await parent.goto(`/family/${childId}/homework`);
  await expect(parent.getByText(HOMEWORK).first()).toBeVisible();
  await parent.goto(`/family/${childId}/billing`);
  await expect(parent.getByText('Перевод от мамы').first()).toBeVisible();

  await parent.goto('/family?notifications=inbox');
  const sheet = parent.getByRole('dialog', { name: 'Уведомления' });
  await expect(sheet.getByRole('button', { name: /^Петя · Новое занятие/ }).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("another student's data is not found for the parent", async ({ request }) => {
  const headers = await bearer(request, PARENT_LOGIN, PASSWORD);
  const children = await request.get('/api/guardian/children', { headers });
  expect(children.ok()).toBe(true);
  const listed = JSON.stringify(await children.json());
  expect(listed).toContain(childId);
  expect(listed).not.toContain(otherId);
  for (const path of [
    `/api/guardian/students/${otherId}/schedule/lessons?from=2026-01-01&to=2030-12-31`,
    `/api/guardian/students/${otherId}/schedule/lessons/${lessonId}`,
    `/api/guardian/students/${otherId}/homework`,
    `/api/guardian/students/${otherId}/billing`,
  ]) {
    expect((await request.get(path, { headers })).status(), path).toBe(404);
  }
  expect((await request.get(`/api/guardian/students/${childId}/billing`, { headers })).ok()).toBe(
    true,
  );
  // the parent is not a student and not the teacher
  expect((await request.get('/api/me/billing', { headers })).status()).toBeGreaterThanOrEqual(400);
  expect((await request.get('/api/teacher/students', { headers })).status()).toBe(403);
});

test('the parent asks to move a lesson and the teacher agrees', async ({ page, browser }) => {
  const parent = await signedIn(browser, PARENT_LOGIN, PASSWORD);
  await parent.goto(`/family/${childId}/schedule`);
  await parent.getByRole('button', { name: 'Перенести' }).first().click();
  // another slot than the student's request in journeys/teacher-and-student (day +4, 16:00)
  await enterDateTime(parent, 'request-start', 5, 19, 30, true);
  await parent.getByLabel('Комментарий учителю').fill('Петя на соревнованиях');
  await parent.getByRole('button', { name: 'Отправить учителю' }).click();
  await expect(parent.locator('.tb-my-schedule-side')).toContainText(`Запрос родителя (${PARENT})`);

  await page.setViewportSize({ width: 1440, height: 900 });
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/schedule');
  await expect(page.getByText(`от родителя (${PARENT})`).first()).toBeVisible();
  await page.getByRole('button', { name: `Ответить: ${CHILD}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Согласовать' }).last().click();
  await expect(page.getByRole('button', { name: `Ответить: ${CHILD}` })).toBeHidden();

  await parent.goto('/family?notifications=inbox');
  const sheet = parent.getByRole('dialog', { name: 'Уведомления' });
  await expect(
    sheet.getByRole('button', { name: /^Петя · Перенос согласован/ }).first(),
  ).toBeVisible({
    timeout: 20_000,
  });
});

test('payments hidden from the student stay with the parent', async ({
  page,
  browser,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  await page.goto(`/teacher/students/${childId}?tab=profile`);
  const hidden = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      new URL(response.url()).pathname.endsWith(`/students/${childId}/visibility`),
  );
  await page.locator('label[for="payments-guardians-only"]').click();
  expect((await hidden).ok()).toBe(true);
  await expect(page.locator('#payments-guardians-only')).toBeChecked();

  const childHeaders = await bearer(request, CHILD_LOGIN, PASSWORD);
  expect((await request.get('/api/me/billing', { headers: childHeaders })).status()).toBe(404);
  const child = await signedIn(browser, CHILD_LOGIN, PASSWORD);
  await expect(
    child.getByRole('navigation', { name: 'Разделы' }).getByRole('link', { name: 'Оплаты' }),
  ).toHaveCount(0);

  const parentHeaders = await bearer(request, PARENT_LOGIN, PASSWORD);
  const ledger = await request.get(`/api/guardian/students/${childId}/billing`, {
    headers: parentHeaders,
  });
  expect(ledger.ok()).toBe(true);
  const parent = await signedIn(browser, PARENT_LOGIN, PASSWORD);
  await parent.goto(`/family/${childId}/billing`);
  await expect(parent.getByText('Перевод от мамы').first()).toBeVisible();
});
