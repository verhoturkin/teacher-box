import { bearer, startSession } from '../support/session';
import { expect, test } from '@playwright/test';

/**
 * Stage 362, student tags: the teacher creates a tag in «Настройки» → «Ученики», sets its value on the
 * student's card (Теги tab), and the student's cabinet shows no trace of it; a free-text tag (362.9) is
 * created in the dialog, written on the card, left out of the list filter and keeps its kind once used.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Теги ${RUN}`;
const TAG = `Уровень ${RUN}`;
const LOGIN = `tags-${RUN}`;
const PASSWORD = 'e2e-student-pass';

let studentId = '';

test.beforeAll(async ({ request }) => {
  const headers = await bearer(request);
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: STUDENT, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const body = (await created.json()) as { student: { id: string }; invite: { token: string } };
  studentId = body.student.id;
  const accepted = await request.post(`/api/auth/invites/${body.invite.token}/accept`, {
    data: { login: LOGIN, password: PASSWORD },
  });
  expect(accepted.ok()).toBe(true);
});

test('a tag set on a student is visible to the teacher only', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startSession(page, 'teacher', TEACHER_PASSWORD);

  const headers = await bearer(request);
  const tag = await request.post('/api/teacher/tags', {
    headers,
    data: { name: TAG, useInAi: true, values: ['A2', 'B1', 'B2'] },
  });
  expect(tag.status()).toBe(201);

  await page.goto('/teacher/settings/students');
  await expect(page.getByText(TAG)).toBeVisible();

  await page.goto(`/teacher/students/${studentId}?tab=tags`);
  await page.getByRole('combobox', { name: TAG }).click();
  await page.getByRole('option', { name: 'B1' }).click();
  await expect(page.getByText(`${TAG}: B1`)).toBeVisible();

  const studentHeaders = await bearer(request, LOGIN, PASSWORD);
  const me = await request.get('/api/me', { headers: studentHeaders });
  expect(me.ok()).toBe(true);
  expect(JSON.stringify(await me.json())).not.toContain(TAG);
  const tags = await request.get('/api/teacher/tags', { headers: studentHeaders });
  expect(tags.status()).toBe(403);

  const cabinet = await page.context().newPage();
  await startSession(cabinet, LOGIN, PASSWORD);
  await expect(cabinet.getByText(TAG)).toHaveCount(0);
  await expect(cabinet.getByText('B1', { exact: true })).toHaveCount(0);
});

test('a free-text tag is written on the card and locks its kind', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  const name = `Интересы ${RUN}`;

  // the list holds the previous test's tag, so «Тег» opens the dialog
  await page.goto('/teacher/settings/students');
  await page.getByRole('button', { name: 'Тег', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Название').fill(name);
  await dialog.getByRole('button', { name: 'Свободный текст' }).click();
  await expect(dialog.getByLabel('Новое значение')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Создать' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: name })).toContainText(
    'Свободный текст',
  );

  await page.goto(`/teacher/students/${studentId}?tab=tags`);
  const field = page.getByRole('listitem').filter({ hasText: name }).getByLabel('Текст');
  await field.fill('футбол, Minecraft');
  await field.press('Enter');
  await expect(page.getByText(`${name}: футбол, Minecraft`)).toBeVisible();
  const headers = await bearer(request);
  const student = await request.get(`/api/teacher/students/${studentId}`, { headers });
  expect(JSON.stringify(await student.json())).toContain('футбол, Minecraft');

  // the students' list filter offers list tags only
  await page.goto('/teacher/students');
  await page.getByRole('button', { name: 'Теги' }).click();
  await expect(page.getByRole('menuitem', { name: name })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.goto('/teacher/settings/students');
  await page.getByRole('button', { name: `Изменить тег «${name}»` }).click();
  await expect(page.getByRole('dialog')).toContainText('поэтому его тип не изменить');
});
