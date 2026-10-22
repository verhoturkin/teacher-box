import { expect, test } from '@playwright/test';
import { create } from './create';

const PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин', { exact: true }).fill('teacher');
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
});

test('material creation uses one member field and a full-width search', async ({ page }) => {
  await page.goto('/teacher/materials');
  const search = page.locator('tb-search-field').last();
  await expect(search).toBeVisible();
  const width = await search.evaluate((field) => ({
    actual: field.getBoundingClientRect().width,
    parent: field.parentElement?.getBoundingClientRect().width ?? 0,
  }));
  expect(width.actual).toBeGreaterThan(width.parent * 0.9);
  await create(page, 'Доска');
  const dialog = page.getByRole('dialog', { name: 'Новая доска', exact: true });
  await expect(dialog.locator('tb-member-picker')).toHaveCount(1);
  await expect(dialog.getByLabel('Ученики и группы', { exact: true })).toBeAttached();
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
});

test('AI stays beside one Markdown field and preserves state through compact adaptation', async ({
  page,
}) => {
  await page.route('**/api/teacher/ai/status', (route) =>
    route.fulfill({
      json: {
        enabled: true,
        provider: 'anthropic',
        model: 'test',
        usedThisMonth: 0,
        monthlyTokenLimit: 2000000,
        limitReached: false,
      },
    }),
  );
  await page.route('**/api/teacher/ai/prompts', (route) => route.fulfill({ json: [] }));
  await page.goto('/teacher/homework/new');
  const supporting = page.locator('tb-pane[kind="sheet"]');
  await expect(supporting.locator('tb-homework-ai-panel')).toBeVisible();
  const prompt = supporting.locator('#ai-prompt');
  await prompt.fill('Составь три задачи');
  await page.locator('#editor-title').fill('Авторское название');
  await page.locator('#editor-text').fill('Авторский текст');
  await page.getByRole('button', { name: 'Просмотр', exact: true }).click();
  await expect(page.locator('.tb-preview')).toHaveText('Авторский текст');
  await expect(supporting.locator('tb-homework-ai-panel')).toBeVisible();
  await page.setViewportSize({ width: 500, height: 850 });
  await page.getByRole('button', { name: 'ИИ-помощник', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'ИИ-помощник', exact: true });
  await expect(modal).toBeVisible();
  await expect(modal.locator('#ai-prompt')).toHaveValue('Составь три задачи');
  await modal.getByRole('button', { name: /^Закрыть/ }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole('button', { name: 'ИИ-помощник', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(supporting.locator('#ai-prompt')).toHaveValue('Составь три задачи');
  await expect(page.locator('#editor-title')).toHaveValue('Авторское название');
  await expect(page.locator('.tb-preview')).toHaveText('Авторский текст');
  await expect(supporting).toHaveCSS('opacity', '1');
  await page.screenshot({
    path: 'test-results/version-0-29-0-editor.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 500, height: 850 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(500);
  await page.getByRole('button', { name: 'ИИ-помощник', exact: true }).click();
  await expect(modal).toBeVisible();
  expect(
    await modal.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(501);
  await expect(modal.locator('#ai-prompt')).toHaveValue('Составь три задачи');
});
