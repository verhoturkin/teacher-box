import { startSession, bearer } from '../support/session';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { create } from '../support/create';
import { todayThereAt } from '../support/this-week';

/**
 * Version 0.18.1: no divider under the top bar on a phone; «Перенести» / «Отменить перенос» lie in the middle
 * of a dragged lesson's card; a chip of a chosen student is removed with «×», not a circle with «!»; no
 * divider above «Прочитанные» in the inbox.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Ученик 0.18.1 ${RUN}`;

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page, width = 1280): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await startSession(page, 'teacher', TEACHER_PASSWORD);
}

test.beforeAll(async ({ request }) => {
  const headers = await bearer(request);
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: STUDENT, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { student } = (await created.json()) as { student: { id: string } };
  const lesson = await request.post('/api/teacher/schedule/lessons', {
    headers,
    data: {
      studentId: student.id,
      startsAt: todayThereAt(10),
      durationMinutes: 60,
      allowOverlap: true,
    },
  });
  expect(lesson.ok()).toBe(true);
});

test('the top bar has no divider below it on a phone', async ({ page }) => {
  await signIn(page, 375);
  const bar = page.locator('.tb-shell__header');
  await expect(bar).toBeVisible();
  expect(await bar.evaluate((node) => getComputedStyle(node).borderBottomWidth)).toBe('0px');
});

test('the move buttons lie in the middle of a dragged lesson card', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/schedule');
  const card = page.locator('.tb-lesson', { hasText: STUDENT });
  await card.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) {
    return;
  }
  const x = box.x + box.width / 2;
  const y = box.y + 6;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 40, { steps: 5 });
  await page.mouse.move(x, y + box.height * 2, { steps: 10 });
  await page.mouse.up();

  const moving = page.locator('.tb-lesson--moving');
  await expect(moving.getByRole('button', { name: 'Перенести' })).toBeVisible();
  const offset = await moving.evaluate((node) => {
    const group = node.querySelector('.tb-lesson-move');
    if (group === null) {
      return null;
    }
    const buttons = Array.from(group.querySelectorAll('button'), (b) => b.getBoundingClientRect());
    const left = Math.min(...buttons.map((b) => b.left));
    const right = Math.max(...buttons.map((b) => b.right));
    const top = Math.min(...buttons.map((b) => b.top));
    const bottom = Math.max(...buttons.map((b) => b.bottom));
    const own =
      node.querySelector('.fc-event-main')?.getBoundingClientRect() ?? node.getBoundingClientRect();
    return {
      x: Math.abs((left + right) / 2 - (own.left + own.right) / 2),
      y: Math.abs((top + bottom) / 2 - (own.top + own.bottom) / 2),
    };
  });
  expect(offset).not.toBeNull();
  expect(offset?.x ?? 99).toBeLessThanOrEqual(2);
  expect(offset?.y ?? 99).toBeLessThanOrEqual(2);

  await moving.getByRole('button', { name: 'Отменить перенос' }).click();
  await expect(page.locator('.tb-lesson--moving')).toHaveCount(0);
});

test('a chosen student chip is removed with «×»', async ({ page }) => {
  await signIn(page);
  // 0.22.0: the messages are the tab «Отправленные» of the bell's sheet (235.1)
  await page.goto('/teacher?notifications=sent');
  await page.getByRole('button', { name: 'Написать ученикам' }).click();
  const dialog = page.getByRole('dialog', { name: 'Сообщение ученикам' });
  await dialog.locator('p-multiselect').click();
  await page.getByRole('option', { name: STUDENT }).click();
  await page.keyboard.press('Escape');

  const chipIcon = dialog.locator('.p-chip svg[data-p-icon="times-circle"]');
  await expect(chipIcon).toBeVisible();
  const masks = await page.evaluate(() => {
    const mask = (selector: string): string | null => {
      const node = document.querySelector(selector);
      return node === null ? null : getComputedStyle(node).maskImage;
    };
    return {
      chip: mask('.p-chip svg[data-p-icon="times-circle"]'),
      close: mask('.p-dialog svg[data-p-icon="times"]'),
    };
  });
  expect(masks.chip).not.toBeNull();
  expect(masks.chip).toBe(masks.close);
});

test('no divider above «Прочитанные» in the inbox', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher?notifications=inbox');
  const read = page.locator('.tb-inbox-read');
  await expect(read).toBeVisible();
  expect(await read.evaluate((node) => getComputedStyle(node).borderTopWidth)).toBe('0px');
});

test('«Создать › Сообщение» writes from any page; the open «Отправленные» shows the message', async ({
  page,
}) => {
  // extra-large: the bell's sheet is the third pane and stays open beside the page (235.1, 235.3)
  await signIn(page, 1920);
  await page.goto('/teacher/students?notifications=sent');
  const sheet = page.locator('#tb-notifications-sheet');
  await expect(sheet.getByRole('button', { name: 'Написать ученикам' })).toBeVisible();

  await create(page, 'Сообщение');
  const dialog = page.getByRole('dialog', { name: 'Сообщение ученикам' });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/teacher\/students$/);
  await dialog.locator('p-multiselect').click();
  await page.getByRole('option', { name: STUDENT }).click();
  await page.keyboard.press('Escape');
  const subject = `Перенос ${RUN}`;
  await dialog.getByLabel('Тема').fill(subject);
  await dialog.getByRole('button', { name: 'Отправить' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Сообщение отправлено, получателей: 1')).toBeVisible();
  await expect(sheet.getByText(subject)).toBeVisible();
});
