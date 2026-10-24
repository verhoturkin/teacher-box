import { startSession, bearer } from '../support/session';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.9.2: students' photos in billing (and other lists), the teacher's photo, «Мой аккаунт» and the
 * teacher's «Настройки» full width (folding sections, no «Интеграции», «Профиль» or address), no section
 * titles on a phone.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Фото в оплатах ${RUN}`;
/** A 1×1 PNG: the server checks the type by its first bytes. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page, width = 1280): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await startSession(page, 'teacher', TEACHER_PASSWORD);
}

test('portal gallery previews appearance locally and persists named preferences', async ({
  page,
}) => {
  await signIn(page, 1920);
  const headers = await bearer(page.request);
  const previous = (await (await page.request.get('/api/teacher/portal', { headers })).json()) as {
    name: string;
    address: string | null;
    accent: string;
    scheme: string;
    contrast: string;
  };
  try {
    await page.goto('/teacher/settings/portal');
    const cards = page.locator('.tb-portal-grid > .tb-portal-card');
    await expect(cards).toHaveCount(3);
    const identity = page.locator('.tb-portal-identity');
    const appearance = page.locator('.tb-portal-appearance');
    const preview = page.locator('.tb-portal-preview');
    const [identityBox, appearanceBox, previewBox] = await Promise.all([
      identity.boundingBox(),
      appearance.boundingBox(),
      preview.boundingBox(),
    ]);
    expect(
      identityBox &&
        appearanceBox &&
        previewBox &&
        Math.abs(identityBox.x - appearanceBox.x) < 1 &&
        previewBox.x > identityBox.x &&
        appearanceBox.y > identityBox.y,
    ).toBeTruthy();
    await page.screenshot({ path: test.info().outputPath('portal-three-cards.png') });
    await appearance.getByRole('button', { name: /Справка/ }).click();
    await expect(
      page.getByRole('dialog').getByText('Оформление и телефон', { exact: true }),
    ).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }).click();
    const gallery = page.getByRole('radiogroup', { name: 'Цветовая схема', exact: true });
    await expect(gallery.getByRole('radio')).toHaveCount(9);
    await gallery.getByRole('radio', { name: 'Монохромная', exact: true }).check();
    await page
      .getByRole('radiogroup', { name: 'Контраст', exact: true })
      .getByRole('radio', { name: 'Повышенный', exact: true })
      .check();
    const unsaved = (await (await page.request.get('/api/teacher/portal', { headers })).json()) as {
      scheme: string;
    };
    expect(unsaved.scheme).toBe(previous.scheme);
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText('Настройки портала сохранены')).toBeVisible();
    await page.reload();
    await expect(gallery.getByRole('radio', { name: 'Монохромная', exact: true })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Повышенный', exact: true })).toBeChecked();
    await page.getByRole('radio', { name: 'Свой цвет', exact: true }).click();
    await expect(page.locator('.p-colorpicker-panel')).not.toBeVisible();
    await page.locator('#portal .p-colorpicker-preview').click();
    await expect(page.locator('.p-colorpicker-panel')).toBeVisible();
    await expect(page.locator('.p-anchored-overlay-enter-active')).toHaveCount(0);
    await page.getByRole('heading', { name: 'Цветовая схема' }).click();
    await expect(page.locator('.p-colorpicker-panel')).not.toBeVisible();
    await page.locator('#portal-own-color').fill('#0f766e');
    await page.getByRole('button', { name: 'Отмена', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Монохромная', exact: true })).toBeChecked();
    await page.setViewportSize({ width: 390, height: 844 });
    const [compactIdentity, compactAppearance, compactPreview] = await Promise.all([
      identity.boundingBox(),
      appearance.boundingBox(),
      preview.boundingBox(),
    ]);
    expect(
      compactIdentity &&
        compactAppearance &&
        compactPreview &&
        compactAppearance.y > compactIdentity.y &&
        compactPreview.y > compactAppearance.y &&
        compactPreview.x + compactPreview.width <= 390,
    ).toBeTruthy();
  } finally {
    const response = await page.request.put('/api/teacher/portal', { headers, data: previous });
    expect(response.ok()).toBe(true);
  }
});

test.beforeAll(async ({ request }) => {
  const created = await request.post('/api/teacher/students', {
    headers: await bearer(request),
    data: { displayName: STUDENT, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { invite } = (await created.json()) as { invite: { token: string } };
  const login = `pay${RUN}`;
  const password = `pass-${RUN}-pay`;
  const accepted = await request.post(`/api/auth/invites/${invite.token}/accept`, {
    data: { login, password },
  });
  expect(accepted.ok()).toBe(true);
  const photo = await request.put('/api/me/avatar', {
    headers: await bearer(request, login, password),
    multipart: { file: { name: 'me.png', mimeType: 'image/png', buffer: PNG } },
  });
  expect(photo.ok()).toBe(true);
});

test('the teacher sees the student photo in the list of students', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/students');
  const row = page.locator('.tb-list > li').filter({ hasText: STUDENT });
  await expect(row.locator('tb-avatar img')).toBeVisible();
});

test('the teacher sets a photo in «Мой аккаунт» of the settings', async ({ page }) => {
  // 234.1: the account is the detail pane beside the categories; at 1600 px it holds both forms in a row
  await signIn(page, 1600);
  await page.goto('/teacher/account');
  await expect(page).toHaveURL(/\/teacher\/settings\/account$/);
  await expect(page.locator('.tb-account__role')).toHaveText('Учитель');
  await page
    .locator('input[type="file"][aria-label="Файл фото"]')
    .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Фото сохранено')).toBeVisible();
  await expect(page.locator('.tb-shell__user-button tb-avatar img')).toBeVisible();

  // «Имя» and «Смена пароля» side by side
  const cards = page.locator('.tb-account__forms > p-card');
  await expect(cards).toHaveCount(2);
  const [name, password] = await Promise.all([
    cards.nth(0).boundingBox(),
    cards.nth(1).boundingBox(),
  ]);
  expect(Math.round(name?.y ?? 0)).toBe(Math.round(password?.y ?? 1));

  await page.getByRole('button', { name: 'Убрать фото' }).click();
  await expect(page.locator('.tb-shell__user-button tb-avatar img')).toHaveCount(0);
});

test('the settings list their categories, without integrations, profile or address', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/teacher/settings');
  // 234.1: list-detail of the categories instead of the fold cards
  const list = page.getByRole('navigation', { name: 'Категории настроек' });
  // 234.2: «Расписание и календарь» and «Звонки»
  for (const category of [
    'Мой аккаунт',
    'Портал',
    'Расписание и календарь',
    'Звонки',
    'Мессенджеры',
    // 234.4: «Оплаты» and «ИИ-помощник»
    'Оплаты',
    'ИИ-помощник',
    'Данные',
  ]) {
    await expect(list.getByRole('link', { name: new RegExp(`^${category}`) })).toBeVisible();
  }
  const main = page.locator('main');
  await expect(main).not.toContainText('Интеграции');
  await expect(main).not.toContainText('Профиль');
  await expect(page.locator('#portal')).toHaveCount(0);

  await list.getByRole('link', { name: /^Портал/ }).click();
  await expect(page).toHaveURL(/\/teacher\/settings\/portal$/);
  await expect(page.locator('#portal-name')).toBeVisible();
  await expect(page.locator('#portal-address')).toHaveCount(0);
});

test('the schedule and calendar category holds the time zone and the subscription', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/teacher/settings/calendar');
  await expect(page.locator('#time-zone')).toContainText('Часовой пояс');
  await expect(page.locator('#google')).toBeVisible();
  await expect(page.locator('tb-calendar-feed-panel')).toContainText('Календарь на телефоне');
  await expect(page.locator('#meetings')).toHaveCount(0);

  // 234.2: the schedule no longer holds the subscription
  await page.goto('/teacher/schedule');
  await expect(page.locator('tb-schedule-page')).toBeVisible();
  await expect(page.locator('tb-calendar-feed-panel')).toHaveCount(0);
});

test('the payments category holds the price for new students, the AI page is a category', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/teacher/settings/payments');
  await expect(page.locator('#default-price')).toContainText('Цена для новых учеников');

  // 234.4: the payments page no longer holds the price
  await page.goto('/teacher/billing');
  await expect(page.locator('tb-billing-overview-page')).toBeVisible();
  await expect(page.locator('#default-price')).toHaveCount(0);

  // the instance has no AI service: the category says so
  await page.goto('/teacher/ai');
  await expect(page).toHaveURL(/\/teacher\/settings\/ai$/);
  await expect(page.locator('tb-ai-settings-panel')).toContainText('ИИ-помощник не настроен');
  await expect(page.getByRole('navigation', { name: 'Разделы' })).not.toContainText('ИИ-помощник');
});

test('a phone shows no section titles; nested pages keep theirs', async ({ page }) => {
  await signIn(page, 375);
  await page.goto('/teacher/students');
  const title = page.locator('h1.tb-page-title');
  await expect(title).toHaveText('Ученики');
  await expect.poll(async () => (await title.boundingBox())?.height ?? 0).toBeLessThanOrEqual(1);

  await page.goto('/teacher/billing/report');
  await expect(page.locator('h1.tb-page-title')).toBeVisible();
  await expect(
    page.locator('main').getByRole('link', { name: 'Оплаты', exact: true }),
  ).toBeVisible();
});
