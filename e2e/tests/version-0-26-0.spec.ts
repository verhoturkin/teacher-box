import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.26.0, «Materials, cabinet, admin, search»: boards and textbooks in one Materials feed; the student's
 * bar of five destinations and the two-column home; the global search (Ctrl K) opens a student.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const WIDE = { width: 1920, height: 1080 };
const PHONE = { width: 390, height: 844 };
const STUDENT = `Поисков ${RUN}`;
const LOGIN = `search${RUN}`;
const PASSWORD = `pass-${RUN}`;
const BOARD = `Доска ${RUN}`;
const TEXTBOOK = `Учебник ${RUN}`;

test.describe.configure({ mode: 'serial' });

/** A small PDF of A4 pages, each with its number. */
function pdf(pages: number): Buffer {
  const objects: string[] = ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const contents: number[] = [];
  for (let page = 1; page <= pages; page++) {
    const stream = `BT /F1 48 Tf 100 700 Td (Page ${String(page)}) Tj ET`;
    objects.push(`<< /Length ${String(stream.length)} >>\nstream\n${stream}\nendstream`);
    contents.push(objects.length);
  }
  const pagesObject = objects.length + pages + 1;
  const kids = contents.map((content) => {
    objects.push(
      `<< /Type /Page /Parent ${String(pagesObject)} 0 R /MediaBox [0 0 595 842] ` +
        `/Contents ${String(content)} 0 R /Resources << /Font << /F1 1 0 R >> >> >>`,
    );
    return `${String(objects.length)} 0 R`;
  });
  objects.push(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${String(pages)} >>`);
  objects.push(`<< /Type /Catalog /Pages ${String(pagesObject)} 0 R >>`);
  let out = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = out.length;
    out += `${String(index + 1)} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = out.length;
  out += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;
  out += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${String(objects.length + 1)} /Root ${String(objects.length)} 0 R >>\n`;
  out += `startxref\n${String(xref)}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

async function token(request: APIRequestContext, login: string, password: string): Promise<string> {
  const response = await request.post('/api/auth/login', { data: { login, password } });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { accessToken: string }).accessToken;
}

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#login').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.beforeAll(async ({ request }) => {
  const headers = { Authorization: `Bearer ${await token(request, 'teacher', TEACHER_PASSWORD)}` };
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: STUDENT, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { student, invite } = (await created.json()) as {
    student: { id: string };
    invite: { token: string };
  };
  const accepted = await request.post(`/api/auth/invites/${invite.token}/accept`, {
    data: { login: LOGIN, password: PASSWORD },
  });
  expect(accepted.ok()).toBe(true);
  const board = await request.post('/api/teacher/boards', {
    headers,
    data: { kind: 'EXCALIDRAW', title: BOARD, url: null, studentIds: [student.id], groupIds: [] },
  });
  expect(board.ok()).toBe(true);
  const textbook = await request.post('/api/teacher/textbooks', {
    headers,
    multipart: {
      file: { name: `${TEXTBOOK}.pdf`, mimeType: 'application/pdf', buffer: pdf(3) },
      kind: 'TEXTBOOK',
      title: TEXTBOOK,
      course: 'Английский',
      studentIds: student.id,
    },
  });
  expect(textbook.ok()).toBe(true);
});

test('Materials show boards and textbooks in one feed and a card opens', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/materials');
  await expect(page.getByRole('link', { name: BOARD })).toBeVisible();
  await page.getByRole('button', { name: /^Учебники/ }).click();
  await expect(page.getByRole('button', { name: `Открыть ${TEXTBOOK}` })).toBeVisible();
  await page.getByRole('button', { name: /^Доски/ }).click();
  await page.getByRole('link', { name: BOARD }).click();
  await expect(page).toHaveURL(/\/teacher\/boards\/[0-9a-f-]+$/);
});

test('the student has a bar of five destinations and a home with materials', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, LOGIN, PASSWORD);
  const bar = page.getByRole('navigation', { name: 'Разделы' });
  await expect(bar.getByRole('link')).toHaveCount(5);
  for (const label of ['Главная', 'Расписание', 'Задания', 'Материалы', 'Оплаты']) {
    await expect(bar.getByRole('link', { name: label })).toBeVisible();
  }
  await page.setViewportSize(WIDE);
  await page.goto('/cabinet');
  await expect(page.getByRole('link', { name: BOARD }).first()).toBeVisible();
  await page.goto('/cabinet/materials');
  await page.getByRole('button', { name: /^Учебники/ }).click();
  await expect(page.getByRole('button', { name: `Открыть ${TEXTBOOK}` })).toBeVisible();
});

test('the global search finds a student with Ctrl K and opens them', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/today');
  const field = page.getByRole('combobox', { name: 'Поиск' });
  await expect(field).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(field).toBeFocused();
  await field.fill(STUDENT);
  await page
    .getByRole('option', { name: new RegExp(STUDENT) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/teacher\/students\//);
});
