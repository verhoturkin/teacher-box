import { expect, test } from '@playwright/test';

/**
 * The teacher connects a Telegram bot in the interface: the wizard checks the token with the Bot API
 * (an imitation, e2e/telegram-mock), connects the teacher's own account and sends a test message.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const TELEGRAM = process.env['E2E_TELEGRAM_URL'] ?? 'http://localhost:8099';
const TOKEN = '123456:e2e-token';

interface SentMessage {
  readonly chatId: string;
  readonly text: string;
}

test('the teacher connects a Telegram bot step by step', async ({ page, request }) => {
  await page.goto('/login');
  await page.getByLabel('Логин').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/teacher$/);

  await page.getByRole('menuitem', { name: 'Уведомления' }).click();
  await page.getByRole('tab', { name: 'Мессенджеры' }).click();
  await expect(page).toHaveURL(/tab=messengers/);
  const bots = page.locator('tb-bots-panel');
  await bots.getByRole('listitem').filter({ hasText: 'Telegram' }).getByRole('button', { name: 'Подключить' }).click();

  const wizard = page.getByRole('dialog', { name: 'Подключение Telegram' });
  await expect(wizard.getByText('/newbot')).toBeVisible();
  await wizard.getByRole('button', { name: 'Бот создан, дальше' }).click();

  await wizard.locator('#bot-token').fill('123456:wrong');
  await wizard.getByRole('button', { name: 'Проверить и сохранить' }).click();
  await expect(wizard.getByText('Мессенджер не принял токен')).toBeVisible();

  await wizard.locator('#bot-token').fill(TOKEN);
  await wizard.getByRole('button', { name: 'Проверить и сохранить' }).click();
  await expect(wizard.getByText('Бот @teacherbox_e2e_bot работает.')).toBeVisible();

  await wizard.getByRole('button', { name: 'Подключить мой аккаунт' }).click();
  const open = wizard.getByRole('link', { name: /Открыть Telegram/ });
  const href = (await open.getAttribute('href')) ?? '';
  const code = new URL(href).searchParams.get('start') ?? '';
  expect(href).toMatch(/^https:\/\/t\.me\/teacherbox_e2e_bot\?start=/);

  // The teacher presses «Start» in Telegram: the bot receives «/start <code>».
  expect((await request.post(`${TELEGRAM}/inject`, { data: { text: `/start ${code}` } })).ok()).toBe(true);
  await expect(wizard.getByText('Отправим вам тестовое сообщение через бота.')).toBeVisible({ timeout: 30_000 });

  await wizard.getByRole('button', { name: 'Отправить тестовое сообщение' }).click();
  await expect(wizard.getByText('Тестовое сообщение отправлено')).toBeVisible();
  const sent = (await (await request.get(`${TELEGRAM}/sent`)).json()) as SentMessage[];
  expect(sent.map((message) => message.text)).toContainEqual(expect.stringContaining('Проверка связи'));

  await wizard.getByRole('button', { name: 'Готово' }).click();
  await expect(wizard).toBeHidden();
  await expect(bots.locator('li.tb-bot').filter({ hasText: 'Telegram' })).toContainText('@teacherbox_e2e_bot');
  await expect(page.locator('tb-channels-panel').getByText('@e2e_teacher')).toBeVisible();
});
