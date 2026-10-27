import { bearer, startSession } from '../support/session';
import { type APIRequestContext, expect, test } from '@playwright/test';

/**
 * Lesson summary (0.37.0): the teacher marks a lesson held, writes «Итоги урока» and shares it; the student
 * gets the notification and sees the summary in «История занятий», another student sees nothing, and the
 * private note never reaches the student.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const STUDENT_PASSWORD = 'e2e-student-pass-310';
const RUN = Date.now().toString(36);
const NAME = `Итоги ${RUN}`;
const OTHER = `Чужой ${RUN}`;
const COVERED = `Past Simple ${RUN}`;
const NEXT = `Повторить ошибки ${RUN}`;
const NOTE = `Только для себя ${RUN}`;
const HOUR = 3_600_000;

test.describe.configure({ mode: 'serial' });

async function withLogin(
  request: APIRequestContext,
  headers: Record<string, string>,
  displayName: string,
  login: string,
): Promise<string> {
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { student, invite } = (await created.json()) as {
    student: { id: string };
    invite: { token: string };
  };
  const accepted = await request.post(`/api/auth/invites/${invite.token}/accept`, {
    data: { login, password: STUDENT_PASSWORD },
  });
  expect(accepted.ok()).toBe(true);
  return student.id;
}

test('the teacher shares a summary: the student gets it in the inbox and the history, another does not', async ({
  page,
  request,
}) => {
  const headers = await bearer(request);
  const studentId = await withLogin(request, headers, NAME, `sum-${RUN}`);
  await withLogin(request, headers, OTHER, `other-${RUN}`);
  const created = await request.post('/api/teacher/schedule/lessons', {
    headers,
    data: {
      studentId,
      durationMinutes: 30,
      allowOverlap: true,
      startsAt: new Date(Date.now() - 2 * HOUR).toISOString(),
    },
  });
  expect(created.ok()).toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/schedule');
  await page.getByRole('tab', { name: 'Вид: Месяц', exact: true }).click();
  await page.locator('.tb-lesson', { hasText: NAME }).first().click();
  const card = page.getByRole('dialog', { name: NAME });
  await card.getByRole('button', { name: 'Проведено' }).click();
  await expect(card.getByRole('button', { name: 'Проведено' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await card.getByRole('button', { name: 'Итоги урока' }).click();
  const dialog = page.getByRole('dialog', { name: 'Итоги урока' });
  // nothing to send until the summary has text
  await expect(dialog.getByRole('button', { name: 'Сохранить и отправить' })).toBeDisabled();
  await dialog.getByLabel('Что прошли').fill(COVERED);
  await dialog.getByLabel('Что дальше').fill(NEXT);
  await dialog.getByLabel('Заметка для себя').fill(NOTE);
  await dialog.getByRole('button', { name: 'Сохранить и отправить' }).click();
  await expect(page.getByText('Итоги отправлены')).toBeVisible();

  // the student: the inbox record and the history, without the private note
  const mine = await bearer(request, `sum-${RUN}`, STUDENT_PASSWORD);
  await expect
    .poll(async () => {
      const inbox = await request.get('/api/me/notifications?page=0&size=20', { headers: mine });
      const body = (await inbox.json()) as { items: { title: string }[] };
      return body.items.some((item) => item.title.startsWith('Итоги урока'));
    })
    .toBe(true);
  const own = await request.get('/api/me/schedule/history', { headers: mine });
  const text = await own.text();
  expect(text).toContain(COVERED);
  expect(text).not.toContain(NOTE);

  const student = await page.context().newPage();
  await student.setViewportSize({ width: 1440, height: 900 });
  await startSession(student, `sum-${RUN}`, STUDENT_PASSWORD);
  await student.goto('/cabinet/schedule');
  await expect(student.getByRole('heading', { name: 'История занятий' })).toBeVisible();
  await expect(student.getByText(COVERED)).toBeVisible();
  await expect(student.getByText(NOTE)).toHaveCount(0);

  // another student sees no part of it
  const other = await bearer(request, `other-${RUN}`, STUDENT_PASSWORD);
  const foreign = await request.get('/api/me/schedule/history', { headers: other });
  expect(await foreign.text()).not.toContain(COVERED);
});
