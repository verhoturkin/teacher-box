import { bearer, startSession } from '../support/session';
import { type Browser, expect, test } from '@playwright/test';

/**
 * Homework redesign (339–342): an assignment is made and issued in the quick dialog, it shows up in the
 * «По ученикам» journal of the week, and the student answers on the task page with a draft that survives a reload.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Ответчик ${RUN}`;
const LOGIN = `answer${RUN}`;
const PASSWORD = `pass-${RUN}-answer`;
const TITLE = `Быстрое ${RUN}`;
const WIDE = { width: 1920, height: 1080 };

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  const headers = await bearer(request);
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: STUDENT, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { invite } = (await created.json()) as { invite: { token: string } };
  const accepted = await request.post(`/api/auth/invites/${invite.token}/accept`, {
    data: { login: LOGIN, password: PASSWORD },
  });
  expect(accepted.ok()).toBe(true);
});

test('an assignment is made and issued in the quick dialog', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/homework');
  await page.getByRole('button', { name: 'Новое задание' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Ученик или группа' }).click();
  await page.getByRole('option', { name: STUDENT }).click();
  await page.keyboard.press('Escape');
  await dialog.locator('#create-text').fill(`${TITLE}\nРешите три примера`);
  await dialog.getByRole('button', { name: 'Без срока' }).click();
  await dialog.getByRole('button', { name: 'Выдать', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole('link', { name: TITLE })).toBeVisible();
});

test('the journal of the week shows the issued assignment', async ({ request, page }) => {
  const headers = await bearer(request);
  const assignment = await request.post('/api/teacher/homework/assignments', {
    headers,
    data: {
      title: `Журнал ${RUN}`,
      description: 'Текст',
      dueAt: new Date().toISOString(),
      studentIds: [],
      videos: [],
    },
  });
  expect(assignment.ok()).toBe(true);
  const { id } = (await assignment.json()) as { id: string };
  const students = (await (await request.get('/api/teacher/students', { headers })).json()) as {
    id: string;
    displayName: string;
  }[];
  const studentId = students.find((candidate) => candidate.displayName === STUDENT)?.id;
  expect(studentId).toBeDefined();
  const given = await request.post(`/api/teacher/homework/assignments/${id}/students`, {
    headers,
    data: { studentIds: [studentId] },
  });
  expect(given.ok()).toBe(true);

  await page.setViewportSize(WIDE);
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/homework?view=journal');
  await expect(page.getByRole('link', { name: `Журнал ${RUN}` })).toBeVisible();
  await expect(
    page.getByRole('button', { name: new RegExp(`^${STUDENT}, Журнал ${RUN}:`) }),
  ).toBeVisible();
});

async function studentSession(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  await startSession(page, LOGIN, PASSWORD);
  return page;
}

test('the student answers on the task page and the draft survives a reload', async ({
  browser,
}) => {
  const student = await studentSession(browser);
  await student.setViewportSize(WIDE);
  await student.goto('/cabinet/homework');
  await student.getByRole('link', { name: TITLE }).click();
  const answer = student.locator('#answer-text');
  await answer.fill('Первый черновик');
  await expect(student.getByText('черновик сохранён')).toBeVisible();
  await student.reload();
  await expect(student.locator('#answer-text')).toHaveValue('Первый черновик');

  await student.locator('#answer-text').fill('3 + 4 = 7');
  await student.getByRole('button', { name: 'Сдать', exact: true }).click();
  await expect(student.getByText('3 + 4 = 7')).toBeVisible();
});
