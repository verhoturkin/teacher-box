import { startSession, bearer } from '../support/session';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.10.2: the unread notifications, each with «Отметить прочитанным», and «Прочитать все» (the home
 * card until 0.22.0, the bell's sheet since). Version 0.56.0: a tap anywhere on a row with a link opens its page,
 * marks it read and closes the sheet.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Ученик с уведомлениями ${RUN}`;
const LOGIN = `notify-${RUN}`;
const PASSWORD = 'student-pass-1';
const TAPPED = `Задание по ссылке ${RUN}`;
const TASKS = ['Первое', 'Второе', 'Третье'].map((name) => `${name} задание ${RUN}`);

test.describe.configure({ mode: 'serial' });

let studentId = '';

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await startSession(page, LOGIN, PASSWORD);
}

test.beforeAll(async ({ request }) => {
  const headers = await bearer(request);
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: STUDENT, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { student, invite } = (await created.json()) as {
    student: { id: string };
    invite: { token: string };
  };
  studentId = student.id;
  const accepted = await request.post(`/api/auth/invites/${invite.token}/accept`, {
    data: { login: LOGIN, password: PASSWORD },
  });
  expect(accepted.ok()).toBe(true);

  for (const title of TASKS) {
    const assignment = await request.post('/api/teacher/homework/assignments', {
      headers,
      data: { title, description: 'Упражнения', studentIds: [student.id] },
    });
    expect(assignment.ok()).toBe(true);
  }
  // the notifications are written after the events: wait for all three
  const studentHeaders = await bearer(request, LOGIN, PASSWORD);
  await expect
    .poll(async () => {
      const page = await request.get('/api/me/notifications?page=0&size=20&read=false', {
        headers: studentHeaders,
      });
      const body = (await page.json()) as { items: { title: string }[] };
      return TASKS.filter((task) => body.items.some((item) => item.title.includes(task))).length;
    })
    .toBe(TASKS.length);
});

// 0.22.0: the home card is gone — the unread notifications are in the bell's sheet
test('the bell’s sheet shows the unread notifications: ✓ one, then «Прочитать все»', async ({
  page,
}) => {
  await signIn(page);
  // the old address of the page opens the sheet on the home page
  const openSheet = async (): Promise<void> => {
    await page.goto('/cabinet/notifications');
    await expect(page).toHaveURL(/\/cabinet$/);
  };
  await openSheet();
  const sheet = page.getByRole('dialog', { name: 'Уведомления' });
  const list = sheet.getByRole('list', { name: 'Непрочитанные', exact: true });
  for (const task of TASKS) {
    await expect(list).toContainText(task);
  }

  const first = list.getByRole('listitem').filter({ hasText: TASKS[0] });
  await first.getByRole('button', { name: 'Отметить прочитанным' }).click();
  await expect(list).not.toContainText(TASKS[0] ?? '');
  await expect(list).toContainText(TASKS[1] ?? '');

  // opened again, the sheet keeps the read one away
  await openSheet();
  await expect(list).toContainText(TASKS[2] ?? '');
  await expect(list).not.toContainText(TASKS[0] ?? '');

  await sheet.getByRole('button', { name: 'Прочитать все' }).click();
  await expect(sheet.getByText('Новых уведомлений нет')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Прочитать все' })).toHaveCount(0);

  await openSheet();
  await expect(sheet.getByText('Новых уведомлений нет')).toBeVisible();
});

// 0.56.0: the whole row opens the page of the notification, not only its title
test('a tap on the row of a notification opens its page and marks it read', async ({
  page,
  request,
}) => {
  const assignment = await request.post('/api/teacher/homework/assignments', {
    headers: await bearer(request),
    data: { title: TAPPED, description: 'Упражнения', studentIds: [studentId] },
  });
  expect(assignment.ok()).toBe(true);
  const studentHeaders = await bearer(request, LOGIN, PASSWORD);
  await expect
    .poll(async () => {
      const found = await request.get('/api/me/notifications?page=0&size=20&read=false', {
        headers: studentHeaders,
      });
      const body = (await found.json()) as { items: { title: string }[] };
      return body.items.some((item) => item.title.includes(TAPPED));
    })
    .toBe(true);

  await signIn(page);
  await page.goto('/cabinet/notifications');
  const sheet = page.getByRole('dialog', { name: 'Уведомления' });
  const unread = sheet.getByRole('list', { name: 'Непрочитанные', exact: true });
  await expect(unread).toContainText(TAPPED);
  // near the bottom left corner of the row (its time line), away from the title text
  const row = unread.getByRole('listitem').filter({ hasText: TAPPED });
  const box = await row.boundingBox();
  expect(box).toBeTruthy();
  await row.click({ position: { x: 8, y: (box?.height ?? 16) - 8 } });
  await expect(page).toHaveURL(/\/cabinet\/homework\/[0-9a-f-]+$/);
  await expect(sheet).toHaveCount(0);

  await page.goto('/cabinet/notifications');
  await expect(sheet.getByText('Новых уведомлений нет')).toBeVisible();
});
