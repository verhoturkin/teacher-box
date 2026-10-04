import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 1.2: a group lesson charged at the price of the group, a Telemost room created on the
 * imitation of its API and a board that the student sees, a dialog with the Telegram bot (the
 * student asks to move a lesson with buttons, the teacher accepts it with the button under the
 * notification) and the help opened from a section.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const TELEGRAM = process.env['E2E_TELEGRAM_URL'] ?? 'http://localhost:8099';
const BOT_TOKEN = '123456:e2e-token';
const RUN = Date.now().toString(36);
const ANNA = `Анна ${RUN}`;
const BORIS = `Борис ${RUN}`;
const GROUP = `Группа ${RUN}`;
const ANNA_LOGIN = `anna-${RUN}`;
const ANNA_PASSWORD = `pass-${RUN}-anna`;
const TEACHER_CHAT = 777;
const STUDENT_CHAT = 778;

test.describe.configure({ mode: 'serial' });

interface Button {
  readonly text: string;
  readonly callback_data?: string;
  readonly url?: string;
}

interface SentMessage {
  readonly chatId: string;
  readonly text: string;
  readonly buttons: readonly (readonly Button[])[];
}

interface Created {
  readonly student: { readonly id: string };
  readonly invite: { readonly token: string };
}

let annaId = '';
let borisId = '';
let groupId = '';

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

const tokens = new Map<string, string>();

/** An access token of the user (valid for the few minutes of the run). */
async function token(request: APIRequestContext, login: string, password: string): Promise<string> {
  const known = tokens.get(login);
  if (known !== undefined) {
    return known;
  }
  const response = await request.post('/api/auth/login', { data: { login, password } });
  expect(response.ok(), `sign-in of ${login}: ${String(response.status())}`).toBe(true);
  const { accessToken } = (await response.json()) as { accessToken: string };
  tokens.set(login, accessToken);
  return accessToken;
}

async function api<T>(
  request: APIRequestContext,
  bearer: string,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  data?: unknown,
): Promise<T> {
  const response = await request.fetch(path, {
    method,
    headers: { Authorization: `Bearer ${bearer}` },
    ...(data === undefined ? {} : { data }),
  });
  expect(response.ok(), `${method} ${path}: ${String(response.status())}`).toBe(true);
  const text = await response.text();
  return (text === '' ? undefined : JSON.parse(text)) as T;
}

/** `dd.MM` of a day relative to today in Moscow, the time zone of the instance. */
function dayMonth(daysFromToday: number): string {
  const date = new Date(Date.now() + daysFromToday * 86_400_000);
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

/** An instant at the given Moscow hour of a day relative to today (Moscow is always UTC+3). */
function moscow(daysFromToday: number, hours: number): string {
  const date = new Date(Date.now() + daysFromToday * 86_400_000);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(date);
  return new Date(`${day}T${String(hours).padStart(2, '0')}:00:00+03:00`).toISOString();
}

async function sentTo(request: APIRequestContext, chat: number): Promise<SentMessage[]> {
  const all = (await (await request.get(`${TELEGRAM}/sent`)).json()) as SentMessage[];
  return all.filter((message) => message.chatId === String(chat));
}

/** Waits for the bot's message to the chat that contains the text; returns the latest such message. */
async function waitFor(
  request: APIRequestContext,
  chat: number,
  text: string,
  after = 0,
): Promise<SentMessage> {
  let found: SentMessage | undefined;
  await expect
    .poll(
      async () => {
        const messages = (await sentTo(request, chat)).slice(after);
        found = messages.filter((message) => message.text.includes(text)).at(-1);
        return found !== undefined;
      },
      { timeout: 45_000, message: `the bot writes «${text}» to ${String(chat)}` },
    )
    .toBe(true);
  return found as SentMessage;
}

/** The label without the icon before it (since 1.5 the bot's buttons carry one): «✅ Да» → «Да». */
function plain(text: string): string {
  return text.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+ /u, '');
}

function button(message: SentMessage, label: string | RegExp): string {
  const found = message.buttons
    .flat()
    .find((candidate) =>
      typeof label === 'string' ? plain(candidate.text) === label : label.test(candidate.text),
    );
  expect(found?.callback_data, `a button ${String(label)} in «${message.text}»`).toBeDefined();
  return found?.callback_data ?? '';
}

async function say(request: APIRequestContext, chat: number, text: string): Promise<number> {
  const before = (await sentTo(request, chat)).length;
  expect((await request.post(`${TELEGRAM}/inject`, { data: { text, chatId: chat } })).ok()).toBe(
    true,
  );
  return before;
}

async function press(request: APIRequestContext, chat: number, data: string): Promise<number> {
  const before = (await sentTo(request, chat)).length;
  expect((await request.post(`${TELEGRAM}/press`, { data: { data, chatId: chat } })).ok()).toBe(
    true,
  );
  return before;
}

test('a group lesson is charged at the price of the group', async ({ page, request }) => {
  const teacher = await token(request, 'teacher', TEACHER_PASSWORD);
  const anna = await api<Created>(request, teacher, 'POST', '/api/teacher/students', {
    displayName: ANNA,
  });
  const boris = await api<Created>(request, teacher, 'POST', '/api/teacher/students', {
    displayName: BORIS,
  });
  annaId = anna.student.id;
  borisId = boris.student.id;
  await api(request, teacher, 'POST', `/api/auth/invites/${anna.invite.token}/accept`, {
    login: ANNA_LOGIN,
    password: ANNA_PASSWORD,
  });
  groupId = (
    await api<{ id: string }>(request, teacher, 'POST', '/api/teacher/groups', {
      name: GROUP,
      memberIds: [annaId, borisId],
    })
  ).id;
  await api(request, teacher, 'PUT', `/api/teacher/billing/groups/${groupId}/price`, {
    lessonPrice: 80_000,
  });
  await api(request, teacher, 'POST', '/api/teacher/schedule/lessons', {
    groupId,
    startsAt: moscow(-1, 9),
    durationMinutes: 60,
    allowOverlap: true,
  });
  await api(request, teacher, 'POST', '/api/teacher/schedule/series', {
    groupId,
    weekdays: ['MONDAY', 'THURSDAY'],
    startTime: '19:00',
    durationMinutes: 90,
    startsOn: moscow(1, 12).slice(0, 10),
    allowOverlap: true,
  });

  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Расписание' })
    .click();
  await expect(page.locator('p-card').filter({ hasText: 'Регулярные занятия' })).toContainText(
    GROUP,
  );
  await page.getByRole('button', { name: new RegExp(`Отметить посещаемость: .*${GROUP}`) }).click();
  await page
    .getByRole('dialog', { name: 'Занятие' })
    .getByRole('button', { name: /Отметить посещаемость/ })
    .click();
  const attendance = page.getByRole('dialog', { name: 'Кто был на занятии' });
  await attendance
    .locator('li')
    .filter({ hasText: ANNA })
    .getByText('Был', { exact: true })
    .click();
  await attendance
    .locator('li')
    .filter({ hasText: BORIS })
    .getByText('Пропуск', { exact: true })
    .click();
  await attendance.getByRole('button', { name: 'Сохранить' }).click();
  await expect(attendance).toBeHidden();

  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Оплаты' })
    .click();
  await expect(page.getByRole('row', { name: new RegExp(ANNA) })).toContainText('800');
  await expect(page.getByRole('row', { name: new RegExp(BORIS) })).toContainText('800');
});

test('a Telemost room and a board reach the student', async ({ page, browser, request }) => {
  const teacher = await token(request, 'teacher', TEACHER_PASSWORD);
  await api(request, teacher, 'POST', '/api/teacher/schedule/lessons', {
    studentId: annaId,
    startsAt: moscow(1, 15),
    durationMinutes: 60,
    topic: 'Проценты',
    allowOverlap: true,
  });

  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Ученики' })
    .click();
  await page.getByRole('button', { name: `Добавить видеовстречу: ${ANNA}` }).click();
  await page.getByRole('button', { name: 'Создать встречу в Телемосте' }).click();
  // Anna's own row: the row of her group has her name too
  const row = page.getByRole('row', { name: new RegExp(`^${ANNA}`) });
  await expect(row).toContainText('Телемост');

  await page.getByRole('button', { name: `Добавить доску: ${ANNA}` }).click();
  await page.locator('#board-title').fill('Алгебра');
  await page.locator('#board-url').fill('https://app.holst.so/board/e2e');
  const boards = page.getByRole('dialog', { name: `Доски: ${ANNA}` });
  await boards.getByRole('button', { name: 'Добавить доску', exact: true }).click();
  await expect(boards.getByRole('link', { name: 'Алгебра' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(row.getByRole('link', { name: 'Алгебра' })).toHaveAttribute(
    'href',
    'https://app.holst.so/board/e2e',
  );

  const student = await (await browser.newContext()).newPage();
  await signIn(student, ANNA_LOGIN, ANNA_PASSWORD);
  await expect(student).toHaveURL(/\/cabinet$/);
  await expect(
    student.locator('tb-my-boards-card').getByRole('link', { name: /Алгебра/ }),
  ).toHaveAttribute('href', 'https://app.holst.so/board/e2e');
  await student
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Расписание' })
    .click();
  await expect(student.getByRole('link', { name: /Войти в урок/ }).first()).toHaveAttribute(
    'href',
    /^https:\/\/telemost\.yandex\.ru\/j\/\d+/,
  );
});

test('the student asks to move a lesson in Telegram and the teacher accepts it with a button', async ({
  request,
}) => {
  test.setTimeout(240_000);
  const teacher = await token(request, 'teacher', TEACHER_PASSWORD);
  const student = await token(request, ANNA_LOGIN, ANNA_PASSWORD);

  const bots = await api<{ channel: string; configured: boolean; teacherLinked: boolean }[]>(
    request,
    teacher,
    'GET',
    '/api/teacher/notifications/channels',
  );
  const telegram = bots.find((bot) => bot.channel === 'TELEGRAM');
  if (telegram?.configured !== true) {
    await api(request, teacher, 'PUT', '/api/teacher/notifications/channels/TELEGRAM', {
      token: BOT_TOKEN,
    });
  }
  if (telegram?.teacherLinked !== true) {
    const { code } = await api<{ code: string }>(
      request,
      teacher,
      'POST',
      '/api/me/channels/TELEGRAM/link-code',
    );
    const before = await say(request, TEACHER_CHAT, code);
    await waitFor(request, TEACHER_CHAT, 'Готово!', before);
  }
  const { code } = await api<{ code: string }>(
    request,
    student,
    'POST',
    '/api/me/channels/TELEGRAM/link-code',
  );
  await waitFor(request, STUDENT_CHAT, 'Готово!', await say(request, STUDENT_CHAT, code));

  await api(request, teacher, 'POST', '/api/teacher/schedule/lessons', {
    studentId: annaId,
    startsAt: moscow(3, 12),
    durationMinutes: 60,
    allowOverlap: true,
  });

  const menu = await waitFor(
    request,
    STUDENT_CHAT,
    'Что вы хотите сделать?',
    await say(request, STUDENT_CHAT, '/menu'),
  );
  const which = await waitFor(
    request,
    STUDENT_CHAT,
    'Какое занятие перенести?',
    await press(request, STUDENT_CHAT, button(menu, 'Перенести занятие')),
  );
  const day = await waitFor(
    request,
    STUDENT_CHAT,
    'На какой день перенести?',
    await press(request, STUDENT_CHAT, button(which, new RegExp(`${dayMonth(3)} 12:00`))),
  );
  await waitFor(
    request,
    STUDENT_CHAT,
    'Во сколько?',
    await press(request, STUDENT_CHAT, button(day, new RegExp(dayMonth(4)))),
  );
  const comment = await waitFor(
    request,
    STUDENT_CHAT,
    'комментарий',
    // Early morning: the other scenarios keep the teacher busy in the afternoon and evening.
    await say(request, STUDENT_CHAT, '08:30'),
  );
  const confirm = await waitFor(
    request,
    STUDENT_CHAT,
    'Попросить учителя перенести занятие',
    await press(request, STUDENT_CHAT, button(comment, 'Без комментария')),
  );
  expect(confirm.text).toContain(`${dayMonth(4)}, 08:30`);
  await waitFor(
    request,
    STUDENT_CHAT,
    'Запрос отправлен учителю',
    await press(request, STUDENT_CHAT, button(confirm, 'Да')),
  );

  const notification = await waitFor(request, TEACHER_CHAT, `${ANNA} просит перенести занятие`);
  const accept = await waitFor(
    request,
    TEACHER_CHAT,
    'Перенести занятие (',
    await press(request, TEACHER_CHAT, button(notification, 'Принять')),
  );
  await waitFor(
    request,
    TEACHER_CHAT,
    'Занятие перенесено',
    await press(request, TEACHER_CHAT, button(accept, 'Да')),
  );

  const requests = await api<{ status: string; proposedStartsAt: string }[]>(
    request,
    student,
    'GET',
    '/api/me/schedule/requests',
  );
  expect(requests[0]?.status).toBe('APPROVED');
  expect(requests[0]?.proposedStartsAt).toBe(moscow(4, 8).replace(':00:00.000Z', ':30:00Z'));
});

test('the help opens from a section', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Расписание' })
    .click();
  // the home page has its «?» too: the click waits for the schedule
  await expect(page).toHaveURL(/\/teacher\/schedule$/);
  await page.locator('.tb-page-heading').getByRole('button', { name: 'Справка' }).click();

  const panel = page.locator('.tb-help-drawer');
  await expect(panel).toContainText('Расписание и запросы');
  await expect(panel).toContainText('Запросы учеников');
  await panel.getByRole('link', { name: 'Вся справка' }).click();
  await expect(page).toHaveURL(/\/teacher\/help\/schedule$/);
  await expect(page.getByRole('heading', { name: 'Расписание и запросы' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Поиск по справке' }).fill('телемост');
  await page.getByRole('link', { name: 'Видеовстречи' }).click();
  await expect(page).toHaveURL(/\/teacher\/help\/meetings$/);
});
