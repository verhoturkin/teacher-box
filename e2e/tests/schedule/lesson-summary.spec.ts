import { bearer, startSession } from '../support/session';
import { type APIRequestContext, expect, test } from '@playwright/test';

/**
 * Lesson summary (0.37.0, in the lesson card since 0.41.0, saved by itself and never sent since
 * 0.62.2): the teacher marks a lesson held and writes the summary in the card; the student sees it in
 * «История занятий» without a notification, another student sees nothing.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const STUDENT_PASSWORD = 'e2e-student-pass-310';
const RUN = Date.now().toString(36);
const NAME = `Итоги ${RUN}`;
const OTHER = `Чужой ${RUN}`;
const COVERED = `Past Simple ${RUN}`;
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

test('the teacher writes a summary: it saves itself, the student sees it in the history, another does not', async ({
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

  // no send, no next-lesson topic, no private note: the text saves itself
  await expect(card.getByRole('button', { name: 'Отправить ученику' })).toHaveCount(0);
  await expect(card.getByLabel('Тема следующего занятия')).toHaveCount(0);
  await expect(card.getByLabel('Заметка для себя')).toHaveCount(0);
  await card.getByLabel('Что прошли').fill(COVERED);
  await expect(card.getByText(/сохранено · /)).toBeVisible();

  // the card stays open with the summary; opened again from the calendar it still has it
  await expect(card.getByLabel('Что прошли')).toHaveValue(COVERED);
  await page.reload();
  await page.getByRole('tab', { name: 'Вид: Месяц', exact: true }).click();
  await page.locator('.tb-lesson', { hasText: NAME }).first().click();
  await expect(page.getByRole('dialog', { name: NAME }).getByLabel('Что прошли')).toHaveValue(
    COVERED,
  );

  // the student: the history has it, the inbox has no «Итоги урока»
  const mine = await bearer(request, `sum-${RUN}`, STUDENT_PASSWORD);
  const own = await request.get('/api/me/schedule/history', { headers: mine });
  expect(await own.text()).toContain(COVERED);
  const inbox = await request.get('/api/me/notifications?page=0&size=20', { headers: mine });
  const body = (await inbox.json()) as { items: { title: string }[] };
  expect(body.items.some((item) => item.title.startsWith('Итоги урока'))).toBe(false);

  const student = await page.context().newPage();
  await student.setViewportSize({ width: 1440, height: 900 });
  await startSession(student, `sum-${RUN}`, STUDENT_PASSWORD);
  await student.goto('/cabinet/schedule');
  await expect(student.getByRole('heading', { name: 'История занятий' })).toBeVisible();
  await expect(student.getByText(COVERED)).toBeVisible();

  // another student sees no part of it
  const other = await bearer(request, `other-${RUN}`, STUDENT_PASSWORD);
  const foreign = await request.get('/api/me/schedule/history', { headers: other });
  expect(await foreign.text()).not.toContain(COVERED);
});
