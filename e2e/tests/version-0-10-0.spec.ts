import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.10.0: «Учебники» — a textbook with its file shared with a student, the search, a page as a picture
 * for a board; a textbook bound to an assignment by pages, the student gets only those pages; the system bars
 * of a phone in the portal's colours (theme-color and the web app manifest).
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Ученик с учебником ${RUN}`;
const TEXTBOOK = `Spotlight ${RUN}`;
const LOGIN = `book${RUN}`;
const PASSWORD = `pass-${RUN}-book`;

test.describe.configure({ mode: 'serial' });

let textbookId = '';
let taskId = '';

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

async function bearer(
  request: APIRequestContext,
  login = 'teacher',
  password = TEACHER_PASSWORD,
): Promise<Record<string, string>> {
  const response = await request.post('/api/auth/login', { data: { login, password } });
  expect(response.ok()).toBe(true);
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

async function signIn(page: Page, width = 1280, login = 'teacher', password = TEACHER_PASSWORD) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.beforeAll(async ({ request }) => {
  const headers = await bearer(request);
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

  const textbook = await request.post('/api/teacher/textbooks', {
    headers,
    multipart: {
      file: { name: `${TEXTBOOK}.pdf`, mimeType: 'application/pdf', buffer: pdf(5) },
      kind: 'TEXTBOOK',
      title: TEXTBOOK,
      course: 'Английский',
      studentIds: student.id,
    },
  });
  expect(textbook.ok()).toBe(true);
  textbookId = ((await textbook.json()) as { id: string }).id;

  const assignment = await request.post('/api/teacher/homework/assignments', {
    headers,
    data: {
      title: `Задание с учебником ${RUN}`,
      description: 'Упражнения',
      studentIds: [student.id],
    },
  });
  expect(assignment.ok()).toBe(true);
  const { id, tasks } = (await assignment.json()) as { id: string; tasks: { taskId: string }[] };
  taskId = tasks[0]?.taskId ?? '';
  const bound = await request.post(`/api/teacher/homework/assignments/${id}/textbooks`, {
    headers,
    data: { textbookId, pages: '2 – 3' },
  });
  expect(bound.ok()).toBe(true);
});

test('the teacher finds the textbook in «Учебники», its PDF pages are counted', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/teacher/textbooks');
  const list = page.getByRole('list', { name: 'Учебники' });
  await expect(list.getByRole('listitem').filter({ hasText: TEXTBOOK })).toContainText(
    'Учебник · Английский · PDF, 5 с.',
  );
  await expect(list.getByRole('listitem').filter({ hasText: TEXTBOOK })).toContainText(STUDENT);

  await page.getByRole('textbox', { name: 'Поиск по названию' }).fill(`нет такого ${RUN}`);
  await expect(page.getByText('Ничего не найдено')).toBeVisible();
  await page.getByRole('textbox', { name: 'Поиск по названию' }).fill(RUN);
  await expect(list.getByRole('listitem')).toHaveCount(1);
});

test('a page of a PDF is a picture for a board', async ({ request }) => {
  const headers = await bearer(request);
  const picture = await request.get(`/api/teacher/textbooks/${textbookId}/pages/2`, { headers });
  expect(picture.ok()).toBe(true);
  expect(picture.headers()['content-type']).toBe('image/png');
  expect((await picture.body()).subarray(1, 4).toString('latin1')).toBe('PNG');
  const past = await request.get(`/api/teacher/textbooks/${textbookId}/pages/6`, { headers });
  expect(past.status()).toBe(404);
});

test('the student has the textbook and only the bound pages in the task', async ({
  page,
  request,
}) => {
  await signIn(page, 1280, LOGIN, PASSWORD);
  await page.goto('/cabinet/textbooks');
  await expect(page.getByRole('list', { name: 'Учебники' })).toContainText(TEXTBOOK);

  await page.goto(`/cabinet/homework/${taskId}`);
  const textbooks = page.getByRole('list', { name: 'Учебники задания' });
  await expect(textbooks).toContainText(TEXTBOOK);
  await expect(textbooks).toContainText('с. 2-3');

  const headers = await bearer(request, LOGIN, PASSWORD);
  const pages = await request.get(`/api/me/homework/tasks/${taskId}/textbooks/${textbookId}`, {
    headers,
  });
  expect(pages.ok()).toBe(true);
  expect(pages.headers()['content-type']).toBe('application/pdf');
  expect(decodeURIComponent(pages.headers()['content-disposition'] ?? '')).toContain(
    '(с. 2-3).pdf',
  );
});

test('the system bars of a phone take the colour of the top bar', async ({ page, request }) => {
  await signIn(page, 390);
  const header = await page
    .locator('.tb-shell__header')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const meta = await page.locator('meta[name="theme-color"]').getAttribute('content');
  const rgb = (hex: string): string =>
    `rgb(${[1, 3, 5].map((start) => String(parseInt(hex.slice(start, start + 2), 16))).join(', ')})`;
  expect(rgb(meta ?? '')).toBe(header);

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = (await (await request.get(href ?? '')).json()) as {
    name: string;
    display: string;
    theme_color: string;
    icons: { sizes: string }[];
  };
  expect(manifest.display).toBe('standalone');
  expect(manifest.theme_color).toBe(meta);
  expect(manifest.icons.map((icon) => icon.sizes)).toContain('512x512');
});
