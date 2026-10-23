import { startSession } from '../support/session';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.13.0: the default topic of a student filled in for a new lesson; receipts of payments —
 * attached by the teacher in the portal, opened by the student, and sent to the Telegram bot, which
 * records the payment with the receipt.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const TELEGRAM = process.env['E2E_TELEGRAM_URL'] ?? 'http://localhost:8099';
const BOT_TOKEN = '123456:e2e-token';
const TEACHER_CHAT = 777;
const RUN = Date.now().toString(36);
// nine letters and digits in a row: an eight-character run would look like a link code to the bot
const VERA = `Вера ${RUN}0`;
const VERA_LOGIN = `vera-${RUN}`;
const VERA_PASSWORD = `pass-${RUN}-vera`;
/** A 1×1 PNG: the backend recognizes receipts by their first bytes. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test.describe.configure({ mode: 'serial' });

interface Button {
  readonly text: string;
  readonly callback_data?: string;
}

interface SentMessage {
  readonly chatId: string;
  readonly text: string;
  readonly buttons: readonly (readonly Button[])[];
}

interface Payment {
  readonly id: string;
  readonly amount: number;
  readonly receipt: { readonly filename: string; readonly contentType: string } | null;
}

let veraId = '';

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
  method: 'GET' | 'POST' | 'PUT',
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
  await startSession(page, login, password);
}

async function sentTo(request: APIRequestContext): Promise<SentMessage[]> {
  const all = (await (await request.get(`${TELEGRAM}/sent`)).json()) as SentMessage[];
  return all.filter((message) => message.chatId === String(TEACHER_CHAT));
}

async function waitFor(
  request: APIRequestContext,
  text: string,
  after: number,
): Promise<SentMessage> {
  let found: SentMessage | undefined;
  await expect
    .poll(
      async () => {
        found = (await sentTo(request))
          .slice(after)
          .filter((message) => message.text.includes(text))
          .at(-1);
        return found !== undefined;
      },
      { timeout: 45_000, message: `the bot writes «${text}»` },
    )
    .toBe(true);
  return found as SentMessage;
}

async function inject(request: APIRequestContext, data: Record<string, unknown>): Promise<number> {
  const before = (await sentTo(request)).length;
  const response = await request.post(`${TELEGRAM}/inject`, {
    data: { chatId: TEACHER_CHAT, ...data },
  });
  expect(response.ok()).toBe(true);
  return before;
}

async function press(
  request: APIRequestContext,
  message: SentMessage,
  label: string,
): Promise<number> {
  const found = message.buttons
    .flat()
    .find((button) => button.text.replace(/^[\p{Extended_Pictographic}️‍]+ /u, '') === label);
  expect(found?.callback_data, `a button «${label}» in «${message.text}»`).toBeDefined();
  const before = (await sentTo(request)).length;
  const response = await request.post(`${TELEGRAM}/press`, {
    data: { chatId: TEACHER_CHAT, data: found?.callback_data },
  });
  expect(response.ok()).toBe(true);
  return before;
}

test('a new lesson gets the default topic of the student', async ({ page, request }) => {
  const teacher = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const created = await api<{ student: { id: string }; invite: { token: string } }>(
    request,
    teacher,
    'POST',
    '/api/teacher/students',
    { displayName: VERA, defaultTopic: 'Химия ЕГЭ' },
  );
  veraId = created.student.id;
  await api(request, teacher, 'POST', `/api/auth/invites/${created.invite.token}/accept`, {
    login: VERA_LOGIN,
    password: VERA_PASSWORD,
  });

  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/schedule?create=lesson');
  const dialog = page.getByRole('dialog', { name: 'Новое занятие' });
  await dialog.locator('p-select:has(#schedule-lesson-student)').click();
  await page.getByRole('option', { name: VERA }).click();
  await expect(dialog.locator('#schedule-lesson-topic')).toHaveValue('Химия ЕГЭ');
});

test('the teacher attaches a receipt and the student opens it', async ({ page, request }) => {
  const teacher = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const payment = await api<Payment>(request, teacher, 'POST', '/api/teacher/billing/payments', {
    studentId: veraId,
    amount: 200_000,
    paidOn: new Date().toISOString().slice(0, 10),
  });

  await signIn(page, 'teacher', TEACHER_PASSWORD);
  // 0.23.0: the old address of the history opens the Оплаты tab of the card
  await page.goto(`/teacher/billing/students/${veraId}`);
  await expect(page).toHaveURL(
    (url) => url.pathname === `/teacher/students/${veraId}` && url.search === '?tab=payments',
  );
  await page.getByRole('button', { name: /^Чек оплаты от / }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Прикрепить чек' }).click();
  await (await chooser).setFiles({ name: 'чек.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Чек прикреплён')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Открыть чек оплаты от / })).toBeVisible();

  const student = await bearer(request, VERA_LOGIN, VERA_PASSWORD);
  const receipt = await request.get(`/api/me/billing/payments/${payment.id}/receipt`, {
    headers: { Authorization: `Bearer ${student}` },
  });
  expect(receipt.ok()).toBe(true);
  expect(receipt.headers()['content-type']).toBe('image/png');
  expect(Buffer.compare(await receipt.body(), PNG)).toBe(0);

  await page.context().clearCookies();
  await signIn(page, VERA_LOGIN, VERA_PASSWORD);
  await page.goto('/cabinet/billing');
  await expect(page.getByRole('button', { name: /^Открыть чек оплаты от / })).toBeVisible();
});

test('a receipt sent to the bot records the payment with it', async ({ request }) => {
  const teacher = await bearer(request, 'teacher', TEACHER_PASSWORD);
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
    await waitFor(request, 'Готово!', await inject(request, { text: code }));
  }

  const who = await waitFor(
    request,
    'Чек получен',
    await inject(request, {
      text: 'за октябрь',
      document: { name: 'receipt.png', base64: PNG.toString('base64') },
    }),
  );
  expect(who.text).toContain('Кто оплатил?');
  const amount = await waitFor(
    request,
    `Сколько оплатил(а) ${VERA}?`,
    await inject(request, { text: VERA }),
  );
  const confirm = await waitFor(request, 'с чеком?', await inject(request, { text: '1500' }));
  await waitFor(request, 'Оплата записана', await press(request, confirm, 'Да'));
  expect(amount.text).toContain(VERA);

  const ledger = await api<{ payments: Payment[] }>(
    request,
    teacher,
    'GET',
    `/api/teacher/billing/students/${veraId}`,
  );
  const recorded = ledger.payments.find((payment) => payment.amount === 150_000);
  expect(recorded?.receipt).toEqual(
    expect.objectContaining({ filename: 'receipt.png', contentType: 'image/png' }),
  );
});
