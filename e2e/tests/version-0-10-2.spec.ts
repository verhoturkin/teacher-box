import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.10.2: the unread notifications, each with «Отметить прочитанным», and «Прочитать все» (the home
 * card until 0.22.0, the bell's sheet since).
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Ученик с уведомлениями ${RUN}`;
const LOGIN = `notify-${RUN}`;
const PASSWORD = 'student-pass-1';
const TASKS = ['Первое', 'Второе', 'Третье'].map((name) => `${name} задание ${RUN}`);

test.describe.configure({ mode: 'serial' });

async function bearer(
  request: APIRequestContext,
  login = 'teacher',
  password = TEACHER_PASSWORD,
): Promise<Record<string, string>> {
  const response = await request.post('/api/auth/login', { data: { login, password } });
  expect(response.ok()).toBe(true);
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill(LOGIN);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
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
