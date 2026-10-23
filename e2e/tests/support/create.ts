import { Page } from '@playwright/test';

/** What the teacher's «Создать» makes (232.1): its items in the rail. */
type CreateItem = 'Занятие' | 'Задание' | 'Оплата' | 'Ученик' | 'Доска' | 'Сообщение';

/**
 * «Создать › <item>» at the top of the teacher's rail: from 600 px the only create action of a section
 * (232.2); the item opens its section's form, «Сообщение» the dialog of a new message over the page (235.3).
 */
export async function create(page: Page, item: CreateItem): Promise<void> {
  const menu = page.locator('tb-create-menu');
  await menu.getByRole('button', { name: 'Создать' }).click();
  await menu
    .getByRole(item === 'Сообщение' ? 'button' : 'link', { name: item, exact: true })
    .click();
}
