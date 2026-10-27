import { startSession } from '../support/session';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.25.0, «Homework and Payments»: a work is accepted in the review sheet and the next work of the queue
 * opens at once; the Payments journal of the month narrows by the chips.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const WIDE = { width: 1920, height: 1080 };
const ASSIGNMENT = `Проверка ${RUN}`;
const PAYER = `Плательщик ${RUN}`;

test.describe.configure({ mode: 'serial' });

interface Created {
  readonly student: { readonly id: string };
  readonly invite: { readonly token: string };
}

let firstTaskId = '';

async function token(
  request: APIRequestContext,
  login = 'teacher',
  password = TEACHER_PASSWORD,
): Promise<string> {
  const response = await request.post('/api/auth/login', { data: { login, password } });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { accessToken: string }).accessToken;
}

async function api<T>(
  request: APIRequestContext,
  bearer: string,
  method: 'GET' | 'POST',
  path: string,
  data?: unknown,
): Promise<T> {
  const response = await request.fetch(path, {
    method,
    headers: { Authorization: `Bearer ${bearer}` },
    ...(data === undefined ? {} : { data }),
  });
  expect(response.ok(), `${method} ${path}: ${String(response.status())}`).toBe(true);
  return (await response.json()) as T;
}

/** A student with a cabinet who hands in the work of the assignment. */
async function submitted(
  request: APIRequestContext,
  teacher: string,
  name: string,
  login: string,
  assignmentId: string,
): Promise<{ studentId: string; taskId: string }> {
  const created = await api<Created>(request, teacher, 'POST', '/api/teacher/students', {
    displayName: name,
    email: null,
    phone: null,
    note: null,
  });
  const password = `pass-${RUN}-${login}`;
  const accepted = await request.post(`/api/auth/invites/${created.invite.token}/accept`, {
    data: { login, password },
  });
  expect(accepted.ok()).toBe(true);
  await api(
    request,
    teacher,
    'POST',
    `/api/teacher/homework/assignments/${assignmentId}/students`,
    {
      studentIds: [created.student.id],
    },
  );
  const own = await token(request, login, password);
  const tasks = await api<{ taskId: string; assignmentId: string }[]>(
    request,
    own,
    'GET',
    '/api/me/homework',
  );
  const task = tasks.find((candidate) => candidate.assignmentId === assignmentId);
  expect(task).toBeDefined();
  const taskId = task?.taskId ?? '';
  const sent = await request.post(`/api/me/homework/tasks/${taskId}/submissions`, {
    headers: { Authorization: `Bearer ${own}` },
    multipart: { text: `Ответ ${name}` },
  });
  expect(sent.ok()).toBe(true);
  return { studentId: created.student.id, taskId };
}

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize(WIDE);
  await startSession(page, 'teacher', TEACHER_PASSWORD);
}

let payerId = '';

test.beforeAll(async ({ request }) => {
  const teacher = await token(request);
  const assignment = await api<{ id: string }>(
    request,
    teacher,
    'POST',
    '/api/teacher/homework/assignments',
    { title: ASSIGNMENT, description: 'Решите задачи', dueAt: null, studentIds: [], videos: [] },
  );
  const first = await submitted(request, teacher, `Первый ${RUN}`, `first${RUN}`, assignment.id);
  await submitted(request, teacher, `Второй ${RUN}`, `second${RUN}`, assignment.id);
  firstTaskId = first.taskId;

  const payer = await api<Created>(request, teacher, 'POST', '/api/teacher/students', {
    displayName: PAYER,
    email: null,
    phone: null,
    note: null,
  });
  payerId = payer.student.id;
  await api(request, teacher, 'POST', '/api/teacher/billing/payments', {
    studentId: payerId,
    amount: 300_000,
    paidOn: new Date().toISOString().slice(0, 10),
  });
});

test('a work is accepted in the review sheet and the next one opens', async ({ page }) => {
  await signIn(page);
  await page.goto(`/teacher/homework/tasks/${firstTaskId}`);
  await expect(page.getByText('Ответ ученика').first()).toBeVisible();
  const sheet = page.getByRole('heading', { name: 'Проверка', exact: true });
  await expect(sheet).toBeVisible();
  await page.getByRole('button', { name: 'Принять', exact: true }).click();
  await expect(page.getByText('Работа принята').first()).toBeVisible();
  // the review goes on with the next work of the queue
  await expect(page).toHaveURL(/\/teacher\/homework\/tasks\/[0-9a-f-]{36}$/);
  await expect(page).not.toHaveURL(new RegExp(firstTaskId));
  await expect(sheet).toBeVisible();
});

test('the journal of the month narrows by the chips', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/billing');
  const payment = page.getByRole('listitem').filter({ hasText: `Оплата · ${PAYER}` });
  await expect(payment).toBeVisible();

  const chip = (name: string) => page.getByRole('button', { name, exact: true });
  await chip('Занятия').click();
  await expect(chip('Занятия')).toHaveAttribute('aria-pressed', 'true');
  await expect(payment).toHaveCount(0);

  await chip('Оплаты').click();
  await expect(chip('Оплаты')).toHaveAttribute('aria-pressed', 'true');
  await expect(payment).toBeVisible();

  await chip('Все').click();
  await expect(payment).toBeVisible();
});

test('the journal filter stays in the address and the journal downloads as CSV', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/teacher/billing?kind=payments');
  await expect(page.getByRole('button', { name: 'Оплаты', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Оплаты', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Ещё', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Скачать CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.csv$/);
});

test('an assignment is copied from the «⋮» menu of the list', async ({ page, request }) => {
  const title = `Копия ${RUN}`;
  await api(request, await token(request), 'POST', '/api/teacher/homework/assignments', {
    title,
    description: 'Текст',
    dueAt: null,
    studentIds: [],
    videos: [],
  });
  await signIn(page);
  await page.goto('/teacher/homework');
  await page.getByText('Активные').first().click();
  await page.getByRole('button', { name: `Действия: ${title}` }).click();
  await page.getByRole('menuitem', { name: 'Создать копию' }).click();
  await expect(page.getByLabel('Название').first()).toHaveValue(`${title} (копия)`);
});
