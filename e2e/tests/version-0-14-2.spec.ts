import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.14.2: homework as cards — the student's tasks, the students of an assignment with «Добавить» that opens
 * «Выдать ещё ученикам», the review queue; materials are a card list; the editor of a saved assignment has no
 * materials; the review form is as wide as its card; an assignment can be deleted.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const NINA = `Нина ${RUN}`;
const NINA_LOGIN = `nina-${RUN}`;
const NINA_PASSWORD = `pass-${RUN}-nina`;
const OLEG = `Олег ${RUN}`;
const TITLE = `Дроби ${RUN}`;

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
  path: string,
  data: unknown,
): Promise<T> {
  const response = await request.post(path, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), `POST ${path}: ${String(response.status())}`).toBe(true);
  const text = await response.text();
  return (text === '' ? undefined : JSON.parse(text)) as T;
}

async function student(
  request: APIRequestContext,
  teacher: string,
  name: string,
  login?: string,
  password?: string,
): Promise<string> {
  const created = await api<{ student: { id: string }; invite: { token: string } }>(
    request,
    teacher,
    '/api/teacher/students',
    { displayName: name },
  );
  if (login !== undefined) {
    await api(request, teacher, `/api/auth/invites/${created.invite.token}/accept`, {
      login,
      password,
    });
  }
  return created.student.id;
}

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#login').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('homework as cards, more students in a dialog, review and delete', async ({
  page,
  browser,
  request,
}) => {
  const teacher = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const nina = await student(request, teacher, NINA, NINA_LOGIN, NINA_PASSWORD);
  await student(request, teacher, OLEG);
  const assignment = await api<{ id: string; tasks: { taskId: string }[] }>(
    request,
    teacher,
    '/api/teacher/homework/assignments',
    { title: TITLE, description: 'Сложите дроби', studentIds: [nina] },
  );
  const upload = await request.post(
    `/api/teacher/homework/assignments/${assignment.id}/attachments`,
    {
      headers: { Authorization: `Bearer ${teacher}` },
      multipart: {
        files: {
          name: 'условие.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4'),
        },
      },
    },
  );
  expect(upload.ok()).toBe(true);

  const context = await browser.newContext();
  const cabinet = await context.newPage();
  await signIn(cabinet, NINA_LOGIN, NINA_PASSWORD);
  await cabinet.goto('/cabinet/homework');
  await expect(cabinet.locator('table')).toHaveCount(0);
  const task = cabinet.locator('ul.tb-list > li').filter({ hasText: TITLE });
  await expect(task).toContainText('без срока');
  await expect(task).toContainText('Выдано');
  await task.getByRole('link', { name: TITLE }).click();
  await cabinet.locator('#answer-text').fill('1/2 + 1/3 = 5/6');
  await cabinet.getByRole('button', { name: 'Отправить на проверку' }).click();
  await expect(cabinet.getByText('Ответ отправлен учителю')).toBeVisible();
  await context.close();

  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/homework/review');
  await expect(page.locator('table')).toHaveCount(0);
  const work = page.locator('ul.tb-list > li').filter({ hasText: NINA });
  await expect(work).toContainText(`${TITLE} · сдано`);
  await work.getByRole('link', { name: `Проверить: ${NINA}, ${TITLE}` }).click();
  const form = page.locator('form.tb-form');
  const card = form.locator('xpath=ancestor::p-card[1]');
  const formBox = await form.boundingBox();
  const cardBox = await card.boundingBox();
  expect(formBox!.width).toBeGreaterThan(cardBox!.width - 80);
  await expect(page.locator('#review-comment')).toHaveCSS('resize', 'vertical');
  await page.getByRole('button', { name: 'Принять' }).click();
  await expect(page.getByText('Работа принята').first()).toBeVisible();

  await page.goto(`/teacher/homework/${assignment.id}`);
  await expect(page.locator('ul[aria-label="Файлы"]')).toContainText('условие.pdf');
  const students = page.locator('ul[aria-label="Ученики"] > li');
  await expect(students).toHaveCount(1);
  await expect(students.first()).toContainText('Сдано');
  await expect(students.first()).toContainText('Принято');
  await page.locator('.tb-card-title__actions').getByRole('button', { name: 'Добавить' }).click();
  const dialog = page.getByRole('dialog', { name: 'Выдать ещё ученикам' });
  await dialog.locator('p-multiselect:has(#assign-students)').click();
  await page.getByRole('option', { name: OLEG }).click();
  // Escape would close the dialog too: a click on its title closes only the list.
  await dialog.locator('.p-dialog-title').click();
  await expect(dialog.locator('p-multiselect:has(#assign-students)')).toContainText(OLEG);
  await dialog.getByRole('button', { name: 'Выдать' }).click();
  await expect(dialog).toBeHidden();
  await expect(students).toHaveCount(2);
  await expect(students.filter({ hasText: OLEG })).toContainText('Не сдано');

  await page.locator('tb-page-header').getByRole('link', { name: 'Изменить' }).click();
  await expect(page.locator('#editor-title')).toHaveValue(TITLE);
  await expect(page.getByRole('button', { name: 'Привязать учебник' })).toHaveCount(0);
  await expect(page.getByText('условие.pdf')).toHaveCount(0);
  await page.goBack();

  await page.locator('tb-page-header').getByRole('button', { name: 'Удалить…' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click();
  await expect(page).toHaveURL(/\/teacher\/homework$/);
  await expect(page.getByText(`Задание «${TITLE}» удалено`)).toBeVisible();
  await expect(page.locator('ul.tb-list > li').filter({ hasText: TITLE })).toHaveCount(0);
});
