import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.14.0: kinds of homework and the assignment editor page. Homework on a board is created in the editor,
 * its due date follows the student's next lesson, and the student marks it done; an interactive page runs in its
 * sandbox in the student's task and its result reaches the teacher; without a configured AI the editor has no AI
 * panel.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const LIZA = `Лиза ${RUN}`;
const LIZA_LOGIN = `liza-${RUN}`;
const LIZA_PASSWORD = `pass-${RUN}-liza`;
const PAGE = `<!doctype html><html><body style="font-family: sans-serif">
<p>2 + 2 = ?</p>
<button id="four" onclick="document.body.dataset.done = '1';
  teacherbox.result({ score: 1, maxScore: 1, answers: [{ question: '2 + 2', answer: '4', correct: true }] })">4</button>
</body></html>`;

test.describe.configure({ mode: 'serial' });

let lizaId = '';

async function bearer(
  request: APIRequestContext,
  login: string,
  password: string,
): Promise<string> {
  const response = await request.post('/api/auth/login', { data: { login, password } });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { accessToken: string }).accessToken;
}

async function api<T>(
  request: APIRequestContext,
  token: string,
  method: 'GET' | 'POST',
  path: string,
  data?: unknown,
): Promise<T> {
  const response = await request.fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    ...(data === undefined ? {} : { data }),
  });
  expect(response.ok(), `${method} ${path}: ${String(response.status())}`).toBe(true);
  const text = await response.text();
  return (text === '' ? undefined : JSON.parse(text)) as T;
}

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#login').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('homework on a board: made in the editor, due at the next lesson, marked done', async ({
  page,
  browser,
  request,
}) => {
  const teacher = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const created = await api<{ student: { id: string }; invite: { token: string } }>(
    request,
    teacher,
    'POST',
    '/api/teacher/students',
    { displayName: LIZA },
  );
  lizaId = created.student.id;
  await api(request, teacher, 'POST', `/api/auth/invites/${created.invite.token}/accept`, {
    login: LIZA_LOGIN,
    password: LIZA_PASSWORD,
  });
  // 17:30 in the browser's time zone (Europe/Moscow, UTC+3, playwright.config.ts) the day after tomorrow
  const lesson = new Date();
  lesson.setUTCDate(lesson.getUTCDate() + 2);
  lesson.setUTCHours(14, 30, 0, 0);
  await api(request, teacher, 'POST', '/api/teacher/schedule/lessons', {
    studentId: lizaId,
    startsAt: lesson.toISOString(),
    durationMinutes: 60,
    allowOverlap: true,
  });

  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/homework');
  await page.locator('p-button.tb-page-fab').getByRole('button', { name: 'Новое задание' }).click();
  await expect(page).toHaveURL(/\/teacher\/homework\/new$/);
  await expect(page.locator('tb-homework-ai-panel')).toHaveCount(0);
  await page.getByText('На доске', { exact: true }).click();
  await page.locator('#editor-title').fill(`Схема ${RUN}`);
  await page.locator('#editor-text').fill('Нарисуйте схему круговорота воды');
  await page.locator('p-multiselect:has(#editor-students)').click();
  await page.getByRole('option', { name: LIZA }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText(/^До занятия /)).toBeVisible();
  const day = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow' }).format(lesson);
  await expect(page.locator('#editor-due')).toHaveValue(`${day} 17:30`);
  await page.locator('tb-page-header').getByRole('button', { name: 'Выдать' }).click();
  await expect(page.getByRole('heading', { name: `Схема ${RUN}` })).toBeVisible();
  await expect(page.getByText('На доске', { exact: true })).toBeVisible();

  const context = await browser.newContext();
  const student = await context.newPage();
  await signIn(student, LIZA_LOGIN, LIZA_PASSWORD);
  await student.goto('/cabinet/homework');
  await student.getByRole('link', { name: `Схема ${RUN}` }).click();
  await expect(student.getByText('Задание выполняется на доске')).toBeVisible();
  await expect(student.locator('#answer-text')).toHaveCount(0);
  await expect(student.locator('p-card').getByRole('link', { name: 'Мои доски' })).toBeVisible();
  await student.getByRole('button', { name: 'Готово' }).click();
  await expect(student.getByText('Отмечено «Готово»')).toBeVisible();
  await context.close();
});

test('an interactive page runs in its sandbox and its result reaches the teacher', async ({
  browser,
  request,
}) => {
  const teacher = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const assignment = await api<{ id: string }>(
    request,
    teacher,
    'POST',
    '/api/teacher/homework/assignments',
    {
      kind: 'INTERACTIVE',
      title: `Тест ${RUN}`,
      description: 'Выберите ответ',
      interactiveHtml: PAGE,
    },
  );
  const given = await api<{ tasks: { taskId: string }[] }>(
    request,
    teacher,
    'POST',
    `/api/teacher/homework/assignments/${assignment.id}/students`,
    { studentIds: [lizaId] },
  );
  const taskId = given.tasks[0]?.taskId ?? '';

  const context = await browser.newContext();
  const student = await context.newPage();
  await signIn(student, LIZA_LOGIN, LIZA_PASSWORD);
  await student.goto(`/cabinet/homework/${taskId}`);
  const frame = student.frameLocator('iframe.tb-interactive-frame');
  await frame.getByRole('button', { name: '4' }).click();
  await expect(student.getByText('Результат страницы: 1 из 1')).toBeVisible();
  await student.getByRole('button', { name: 'Готово' }).click();
  await expect(student.getByText('Учитель увидит, что задание выполнено')).toBeVisible();
  await context.close();

  const task = await api<{
    submissions: { result: { score: number; answers: { answer: string }[] } | null }[];
  }>(request, teacher, 'GET', `/api/teacher/homework/tasks/${taskId}`);
  expect(task.submissions[0]?.result?.score).toBe(1);
  expect(task.submissions[0]?.result?.answers[0]?.answer).toBe('4');
});
