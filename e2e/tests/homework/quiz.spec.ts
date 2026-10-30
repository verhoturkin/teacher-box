import { startSession } from '../support/session';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.39.0, auto-checked quizzes: an assignment with all six question types, a student who answers it in
 * the cabinet (a mixed result), the reveal rule, the best attempt, the teacher's override and the grade suggestion.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const WIDE = { width: 1920, height: 1080 };
const LOGIN = `quiz${RUN}`;
const PASSWORD = `pass-${RUN}-quiz`;
const MIXED = `Тест ${RUN}`;
const OPEN = `Тест с ключом ${RUN}`;
const BLANK = `Тест без ответа ${RUN}`;

test.describe.configure({ mode: 'serial' });

interface Created {
  readonly student: { readonly id: string };
  readonly invite: { readonly token: string };
}

interface TaskRow {
  readonly taskId: string;
  readonly assignmentId: string;
}

let mixedTask = '';
let openTask = '';
let blankTask = '';

async function token(request: APIRequestContext, login: string, password: string): Promise<string> {
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

const id = (): string => crypto.randomUUID();
const option = (text: string) => ({ id: id(), text });

function questions() {
  const single = [option('Москва'), option('Омск'), option('Самара')];
  const multiple = [option('2'), option('3'), option('4'), option('5')];
  const order = [option('Утро'), option('День'), option('Вечер')];
  return [
    {
      type: 'SINGLE_CHOICE',
      text: 'Столица России?',
      options: single,
      correct: [single[0]?.id],
    },
    {
      type: 'MULTIPLE_CHOICE',
      text: 'Какие числа простые?',
      options: multiple,
      correct: [multiple[0]?.id, multiple[1]?.id, multiple[3]?.id],
    },
    { type: 'SHORT_TEXT', text: 'Дерево на Новый год?', accepted: ['Ёлка', 'Ель'] },
    {
      type: 'NUMBER',
      text: 'Чему равно число пи с точностью до сотых?',
      value: 3.14,
      tolerance: 0.01,
    },
    {
      type: 'MATCHING',
      text: 'Город и страна',
      pairs: [
        { id: id(), left: 'Париж', right: 'Франция' },
        { id: id(), left: 'Берлин', right: 'Германия' },
        { id: id(), left: 'Рим', right: 'Италия' },
      ],
    },
    { type: 'ORDERING', text: 'Части суток по порядку', options: order },
  ];
}

async function assignTo(
  request: APIRequestContext,
  teacher: string,
  studentId: string,
  body: Record<string, unknown>,
): Promise<string> {
  const assignment = await api<{ id: string }>(
    request,
    teacher,
    'POST',
    '/api/teacher/homework/assignments',
    { description: 'Пройдите тест', studentIds: [], videos: [], ...body },
  );
  await api(
    request,
    teacher,
    'POST',
    `/api/teacher/homework/assignments/${assignment.id}/students`,
    { studentIds: [studentId] },
  );
  return assignment.id;
}

test.beforeAll(async ({ request }) => {
  const teacher = await token(request, 'teacher', TEACHER_PASSWORD);
  const created = await api<Created>(request, teacher, 'POST', '/api/teacher/students', {
    displayName: `Тестовый ${RUN}`,
    email: null,
    phone: null,
    note: null,
  });
  const accepted = await request.post(`/api/auth/invites/${created.invite.token}/accept`, {
    data: { login: LOGIN, password: PASSWORD },
  });
  expect(accepted.ok()).toBe(true);

  // the key stays hidden until the due date, two attempts, the best one counts
  const due = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const mixed = await assignTo(request, teacher, created.student.id, {
    title: MIXED,
    dueAt: due,
    questions: questions(),
    quizReveal: 'AFTER_DUE',
    quizAttempts: 2,
  });
  const single = [option('Да'), option('Нет')];
  const open = await assignTo(request, teacher, created.student.id, {
    title: OPEN,
    questions: [
      {
        type: 'SINGLE_CHOICE',
        text: 'Земля круглая?',
        options: single,
        correct: [single[0]?.id],
        explanation: 'Это шар, сплюснутый у полюсов',
      },
    ],
    quizReveal: 'AFTER_SUBMIT',
  });

  const blank = await assignTo(request, teacher, created.student.id, {
    title: BLANK,
    questions: [{ type: 'SHORT_TEXT', text: 'Без ответа?', accepted: ['да'] }],
    quizReveal: 'AFTER_SUBMIT',
  });

  const own = await token(request, LOGIN, PASSWORD);
  const tasks = await api<TaskRow[]>(request, own, 'GET', '/api/me/homework');
  mixedTask = tasks.find((task) => task.assignmentId === mixed)?.taskId ?? '';
  openTask = tasks.find((task) => task.assignmentId === open)?.taskId ?? '';
  blankTask = tasks.find((task) => task.assignmentId === blank)?.taskId ?? '';
  expect(blankTask).not.toBe('');
  expect(mixedTask).not.toBe('');
  expect(openTask).not.toBe('');
});

async function asStudent(page: Page, taskId: string): Promise<void> {
  await page.setViewportSize(WIDE);
  await startSession(page, LOGIN, PASSWORD);
  await page.goto(`/cabinet/homework/${taskId}`);
  await expect(page.getByRole('heading', { name: 'Тест', exact: true })).toBeVisible();
}

async function submitQuiz(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Сдать тест', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Сдать', exact: true }).click();
}

/** Moves the items with the arrow buttons until they stand in `wanted` order. */
async function putInOrder(page: Page, wanted: readonly string[]): Promise<void> {
  for (const [target, text] of wanted.entries()) {
    const items = page.locator('.tb-quiz-order__text');
    for (;;) {
      const texts = await items.allTextContents();
      const at = texts.map((item) => item.trim()).indexOf(text);
      if (at <= target) {
        break;
      }
      await page
        .getByRole('button', { name: new RegExp(`^Поднять выше: ${String(at + 1)}\\.`) })
        .click();
      // the list re-renders after the click: read it again only when the item has moved
      await expect(items.nth(at - 1)).toHaveText(text);
    }
  }
}

test('a student answers all six types and sees a mixed score without the key', async ({ page }) => {
  await asStudent(page, mixedTask);
  await expect(page.getByText('Осталось попыток: 2')).toBeVisible();
  await page.getByRole('button', { name: 'Начать тест', exact: true }).click();

  await page.getByRole('radio', { name: 'Москва' }).check();
  for (const text of ['2', '3', '5']) {
    await page.getByRole('checkbox', { name: text, exact: true }).check();
  }
  // case, «ё» and spaces do not matter
  await page.getByRole('textbox', { name: 'Ответ', exact: true }).fill('  елка ');
  await page.getByRole('textbox', { name: 'Число', exact: true }).fill('3.14');
  // one pair is right, so the all-or-nothing question is wrong
  const pairs: [string, string][] = [
    ['Париж', 'Франция'],
    ['Берлин', 'Италия'],
    ['Рим', 'Германия'],
  ];
  for (const [left, right] of pairs) {
    await page.getByRole('combobox', { name: `Пара для «${left}»` }).click();
    await page.getByRole('option', { name: right, exact: true }).click();
  }
  await putInOrder(page, ['Утро', 'День', 'Вечер']);
  await submitQuiz(page);

  await expect(page.getByText('Лучший результат: 5 из 6')).toBeVisible();
  await expect(page.getByText('Осталось попыток: 1')).toBeVisible();
  await expect(page.getByText('Верные ответы появятся после срока сдачи.')).toBeVisible();
  await expect(page.getByText('Верный ответ', { exact: true })).toHaveCount(0);
});

test('a worse second attempt does not lower the best one', async ({ page, request }) => {
  const own = await token(request, LOGIN, PASSWORD);
  const started = await api<{ openAttempt: { id: string } }>(
    request,
    own,
    'POST',
    `/api/me/homework/tasks/${mixedTask}/quiz/attempts`,
  );
  await api(
    request,
    own,
    'POST',
    `/api/me/homework/tasks/${mixedTask}/quiz/attempts/${started.openAttempt.id}/submit`,
  );
  await asStudent(page, mixedTask);
  await expect(page.getByText('Лучший результат: 5 из 6')).toBeVisible();
  await expect(page.getByText('Осталось попыток: 0')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Пройти ещё раз' })).toHaveCount(0);
});

test('with the rule «right after submitting» the key and the explanation are shown', async ({
  page,
}) => {
  await asStudent(page, openTask);
  await page.getByRole('button', { name: 'Начать тест', exact: true }).click();
  await page.getByRole('radio', { name: 'Нет' }).check();
  await submitQuiz(page);

  await expect(page.getByText('Лучший результат: 0 из 1')).toBeVisible();
  await expect(page.getByText(/Неверно · 0 б./)).toBeVisible();
  await expect(page.getByText('Верный ответ', { exact: true })).toBeVisible();
  await expect(page.getByText('Это шар, сплюснутый у полюсов')).toBeVisible();
});

test('the teacher sees the best attempt, overrides a wrong answer and the grade follows', async ({
  page,
  request,
}) => {
  // hand the work in (multipart, as the cabinet does) so it reaches the review
  const own = await token(request, LOGIN, PASSWORD);
  const sent = await request.post(`/api/me/homework/tasks/${mixedTask}/submissions`, {
    headers: { Authorization: `Bearer ${own}` },
    multipart: { text: 'Готово' },
  });
  expect(sent.ok() || sent.status() === 409).toBe(true);

  await page.setViewportSize(WIDE);
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  await page.goto(`/teacher/homework/tasks/${mixedTask}`);
  await expect(page.getByText('Тест: 5 из 6')).toBeVisible();
  await expect(page.getByLabel('Оценка')).toHaveValue('5 из 6');

  await page.getByRole('button', { name: 'Засчитать', exact: true }).click();
  await expect(page.getByText('Тест: 6 из 6')).toBeVisible();
  await expect(page.getByLabel('Оценка')).toHaveValue('6 из 6');
});

test('the teacher credits a question the student left unanswered', async ({ page, request }) => {
  const own = await token(request, LOGIN, PASSWORD);
  const started = await api<{ openAttempt: { id: string } }>(
    request,
    own,
    'POST',
    `/api/me/homework/tasks/${blankTask}/quiz/attempts`,
  );
  await api(
    request,
    own,
    'POST',
    `/api/me/homework/tasks/${blankTask}/quiz/attempts/${started.openAttempt.id}/submit`,
  );
  const sent = await request.post(`/api/me/homework/tasks/${blankTask}/submissions`, {
    headers: { Authorization: `Bearer ${own}` },
    multipart: { text: 'Готово' },
  });
  expect(sent.ok() || sent.status() === 409).toBe(true);

  await page.setViewportSize(WIDE);
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  await page.goto(`/teacher/homework/tasks/${blankTask}`);
  await expect(page.getByText('Тест: 0 из 1')).toBeVisible();
  await page.getByRole('button', { name: 'Засчитать', exact: true }).click();
  await expect(page.getByText('Тест: 1 из 1')).toBeVisible();
});
