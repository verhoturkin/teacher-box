import { startSession } from '../support/session';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startSession(page, 'teacher', process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass');
});

test('assignment panes share width and validation keeps recipients aligned with deadline', async ({
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
  const panes = page.locator('tb-panes > tb-pane');
  await expect(panes).toHaveCount(2);
  const widths = await panes.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().width),
  );
  expect(Math.abs(widths[0]! - widths[1]!)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Выдать', exact: true }).click();
  await expect(page.locator('#editor-title')).toHaveAttribute('aria-invalid', 'true');
  const member = page.locator('tb-member-picker .p-multiselect');
  const due = page.locator('#editor-due');
  const top = await member.evaluate((element) => element.getBoundingClientRect().top);
  expect(
    Math.abs(top - (await due.evaluate((element) => element.getBoundingClientRect().top))),
  ).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'ИИ-помощник', exact: true }).click();
  await expect(panes).toHaveCount(1);
});

test('materials search matches list searches and shares a row with chips and sorting', async ({
  page,
}) => {
  await page.goto('/teacher/homework');
  const reference = await page
    .locator('tb-pane tb-search-field')
    .evaluate((element) => element.getBoundingClientRect().width);
  console.log(`Homework search at 1440px: ${reference}px`);
  await page.goto('/teacher/students');
  const studentsWidth = await page
    .locator('tb-pane tb-search-field')
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(studentsWidth).toBe(reference);
  console.log(`Students search at 1440px: ${studentsWidth}px`);
  await page.goto('/teacher/materials');
  const search = page.locator('.tb-materials__bar tb-search-field');
  await expect(search).toBeVisible();
  const box = await search.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box!.width - reference)).toBeLessThanOrEqual(1);
  for (const selector of ['tb-filter-chips', '.tb-materials__sort']) {
    const control = await page.locator(`.tb-materials__bar ${selector}`).boundingBox();
    expect(control).not.toBeNull();
    expect(
      Math.abs(control!.y + control!.height / 2 - box!.y - box!.height / 2),
    ).toBeLessThanOrEqual(1);
  }
  await page.screenshot({
    path: 'test-results/version-0-30-0-materials.png',
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 500, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(500);
  await expect(search).toBeVisible();
});

test('billing student menu escapes the pane and keeps long names visible', async ({
  page,
  request,
}) => {
  const response = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass' },
  });
  const auth = (await response.json()) as { accessToken: string };
  const name = `Ученик с длинным именем для проверки меню ${Date.now()}`;
  const created = await request.post('/api/teacher/students', {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    data: { displayName: name },
  });
  expect(created.ok()).toBe(true);
  const student = (await created.json()) as { invite: { token: string } };
  const activated = await request.post(`/api/auth/invites/${student.invite.token}/accept`, {
    data: { login: `layout030${Date.now()}`, password: 'Layout-030-student-pass' },
  });
  expect(activated.ok()).toBe(true);
  await page.goto('/teacher/billing');
  await page.getByRole('combobox', { name: 'Операции ученика' }).click();
  const option = page.getByRole('option', { name, exact: true });
  await expect(option).toBeVisible();
  expect(await option.evaluate((element) => element.closest('tb-pane') === null)).toBe(true);
  const bounds = await option.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1440);
  await option.click();
});
