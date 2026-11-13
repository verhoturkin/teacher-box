/**
 * Capture real UI against an EMPTY, disposable local instance (never production).
 * Start backend with TEACHERBOX_DATA_DIR pointing to a fresh directory and the password below;
 * start frontend on :4200, then run: node scripts/readme-screenshots.mjs
 * Requires e2e/npm ci, JDK 25 backend, and Chromium (CHROMIUM_PATH overrides its location).
 * Set DEMO_CAPTURE_ONLY=1 to recapture the already seeded instance.
 * DEMO_SCREENS=home,schedule limits page captures (the review and board are always refreshed).
 */
import {
  chromium,
  expect,
} from "../e2e/node_modules/@playwright/test/index.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const baseURL = process.env.DEMO_BASE_URL ?? "http://localhost:4200";
if (!["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
  throw new Error(
    "Use a disposable local instance. Remote seeding is forbidden.",
  );
}
const password = process.env.DEMO_PASSWORD ?? "readme-demo-pass";
const out = new URL("../docs/assets/readme/", import.meta.url).pathname;
const statePath = "/tmp/teacherbox-readme-state.json";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  baseURL,
  viewport: { width: 1440, height: 1000 },
  locale: "ru-RU",
  timezoneId: "Europe/Moscow",
  colorScheme: "light",
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function login(ctx, login) {
  const response = await ctx.request.post("/api/auth/login", {
    data: { login, password },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return { Authorization: `Bearer ${(await response.json()).accessToken}` };
}
const headers = await login(context, "teacher");
async function api(path, data, method = "POST", auth = headers) {
  const response = await context.request.fetch(`/api/${path}`, {
    method,
    headers: auth,
    ...(data === undefined ? {} : { data }),
  });
  if (!response.ok())
    throw new Error(
      `${method} ${path}: ${response.status()} ${await response.text()}`,
    );
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
const now = new Date();
const date = (days) =>
  new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);
const instant = (days, hour = 15) =>
  `${date(days)}T${String(hour).padStart(2, "0")}:00:00Z`;
async function extraFixtures(state) {
  for (const days of [3, 7])
    await api("teacher/schedule/lessons", {
      groupId: state.groups[0].id,
      startsAt: instant(days, 14),
      durationMinutes: 90,
      title:
        days === 3
          ? "ЕГЭ: производная и касательная"
          : "Параметры: графический метод",
      allowOverlap: true,
    });
  const choiceIds = [
    "10000000-0000-4000-8000-000000000001",
    "10000000-0000-4000-8000-000000000002",
    "10000000-0000-4000-8000-000000000003",
  ];
  const quiz = await api("teacher/homework/assignments", {
    title: "Мини-тест: квадратные уравнения",
    description:
      "Проверь себя перед занятием. Три коротких вопроса: выбери ответ, вычисли дискриминант и запиши название теоремы.",
    dueAt: instant(2),
    quizAttempts: 3,
    studentIds: [state.students[0].id, state.students[2].id],
    questions: [
      {
        type: "SINGLE_CHOICE",
        text: "Какие корни у уравнения x² − 5x + 6 = 0?",
        points: 1,
        options: [
          { id: choiceIds[0], text: "2 и 3" },
          { id: choiceIds[1], text: "−2 и −3" },
          { id: choiceIds[2], text: "1 и 6" },
        ],
        correct: [choiceIds[0]],
        explanation: "Разложение на множители: (x − 2)(x − 3) = 0.",
      },
      {
        type: "NUMBER",
        text: "Найдите дискриминант уравнения x² − 6x + 5 = 0.",
        points: 2,
        value: 16,
        tolerance: 0,
      },
      {
        type: "SHORT_TEXT",
        text: "Как называется теорема о сумме и произведении корней?",
        points: 1,
        accepted: ["теорема Виета", "Виета"],
      },
    ],
  });
  const studentContext = await browser.newContext({ baseURL });
  const studentAuth = await login(studentContext, "demo-student-1");
  const tasks = await api("me/homework", undefined, "GET", studentAuth);
  state.quizTask = tasks.find((t) => t.assignmentId === quiz.id).taskId;
  await studentContext.close();
  for (const [title, text] of [
    [
      "Практика к ЕГЭ",
      "Составь пять задач по теме занятия: от базового уровня до профильного ЕГЭ. Добавь подсказку к самой сложной задаче.",
    ],
    [
      "Разбор ошибок",
      "Объясни ошибку ученика доброжелательно. Задай наводящий вопрос и предложи одну похожую задачу для закрепления.",
    ],
    [
      "Олимпиадная разминка",
      "Подготовь три нестандартные задачи для 9 класса. Для каждой предложи два подхода к решению.",
    ],
  ])
    await api("teacher/ai/prompts", { title, text });
  await api("teacher/backups", null);
}
let state;
try {
  if (process.env.DEMO_CAPTURE_ONLY === "1") {
    state = JSON.parse(await readFile(statePath, "utf8"));
  } else {
    const existing = await api("teacher/students", undefined, "GET");
    if (existing.length)
      throw new Error(
        "Seeding requires an EMPTY instance. Use a fresh data directory.",
      );
    await page.goto("/");
    await page.waitForURL(/teacher/);
    if (page.url().includes("/setup")) {
      await page.getByLabel("Ваше имя").fill("Анна Соколова");
      const title = page.getByLabel("Название портала", { exact: true });
      if (await title.count()) await title.fill("Математика с Анной");
      await page.getByRole("button", { name: "Далее", exact: true }).click();
      await page.getByLabel("Цена занятия", { exact: true }).fill("1800");
      await page.getByRole("button", { name: "Далее", exact: true }).click();
      await page.getByRole("button", { name: "Далее", exact: true }).click();
      await page.getByRole("button", { name: "Перейти в портал" }).click();
      await page.waitForURL(/\/teacher$/);
    }
    const names = [
      "Алиса Морозова",
      "Михаил Волков",
      "София Лебедева",
      "Артём Козлов",
      "Ева Новикова",
      "Даниил Орлов",
      "Полина Белова",
      "Илья Соколов",
    ];
    const colors = [
      "VIOLET",
      "BLUE",
      "PINK",
      "GREEN",
      "ORANGE",
      "CYAN",
      "PURPLE",
      "LIME",
    ];
    const topics = [
      "Подготовка к ЕГЭ · профиль",
      "Алгебра · 9 класс",
      "Геометрия · 10 класс",
      "Подготовка к ОГЭ",
    ];
    const students = [];
    const studentHeaders = [];
    for (let i = 0; i < names.length; i++) {
      const created = await api("teacher/students", {
        displayName: names[i],
        email: `student${i + 1}@example.test`,
        note: [
          "Цель: 85+ баллов. Разбираем задачи с параметром.",
          "Уверенно решает уравнения. Повторить геометрию.",
          "Готовимся к олимпиаде, любит нестандартные задачи.",
        ][i % 3],
        defaultTopic: topics[i % 4],
        color: colors[i],
      });
      students.push(created.student);
      await api(`auth/invites/${created.invite.token}/accept`, {
        login: `demo-student-${i + 1}`,
        password,
      });
      const ctx = await browser.newContext({ baseURL });
      studentHeaders.push(await login(ctx, `demo-student-${i + 1}`));
      await ctx.close();
    }
    const groups = [];
    for (const [name, indexes, color] of [
      ["ЕГЭ · Профиль", [0, 2, 4, 6], "VIOLET"],
      ["ОГЭ · Уверенный старт", [1, 3, 5], "GREEN"],
      ["Олимпиадная мастерская", [0, 6, 7], "ORANGE"],
    ]) {
      groups.push(
        await api("teacher/groups", {
          name,
          memberIds: indexes.map((i) => students[i].id),
          defaultTopic: name,
          color,
        }),
      );
    }
    // A varied current week, with past outcomes and future individual/group lessons.
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
    monday.setUTCHours(0, 0, 0, 0);
    const lessons = [];
    for (let day = 0; day < 7; day++) {
      for (let slot = 0; slot < (day === 6 ? 1 : 3); slot++) {
        const startsAt = new Date(
          monday.getTime() + (day * 24 + 8 + slot * 3) * 3600000,
        ).toISOString();
        const isGroup = slot === 2;
        const lesson = await api("teacher/schedule/lessons", {
          ...(isGroup
            ? { groupId: groups[day % 3].id }
            : { studentId: students[(day + slot * 2) % 8].id }),
          startsAt,
          durationMinutes: isGroup ? 90 : 60,
          title: [
            "Квадратные уравнения",
            "Производная и её применение",
            "Треугольники и окружности",
            "Задачи с параметром",
            "Вероятность и статистика",
            "Пробный вариант ЕГЭ",
            "Разбор олимпиадных задач",
          ][day],
          allowOverlap: true,
        });
        lessons.push(lesson);
        if (new Date(startsAt).getTime() + 5400000 < now.getTime() && !isGroup)
          await api(
            `teacher/schedule/lessons/${lesson.id}/outcome`,
            { outcome: "CONDUCTED" },
            "PUT",
          );
      }
    }
    await api("teacher/schedule/lessons", {
      studentId: students[0].id,
      startsAt: new Date(now.getTime() + 35 * 60000).toISOString(),
      durationMinutes: 60,
      title: "ЕГЭ: задачи с параметром",
      allowOverlap: true,
    });
    for (let i = 0; i < students.length; i++) {
      for (let j = 0; j < 3; j++)
        await api("teacher/billing/lessons", {
          studentId: students[i].id,
          date: date(-j - 1),
          price: 180000,
          durationMinutes: 60,
          topic: topics[i % 4],
          status: "CONDUCTED",
        });
      if (i !== 3 && i !== 6)
        await api("teacher/billing/payments", {
          studentId: students[i].id,
          amount: [900000, 540000, 360000, 720000][i % 4],
          paidOn: date(-i % 3),
          comment: [
            "Абонемент на ноябрь",
            "Оплата четырёх занятий",
            "Перевод за занятия",
          ][i % 3],
        });
    }
    const assignments = [];
    const titles = [
      "Квадратные уравнения: от простого к сложному",
      "Производная: исследуем график функции",
      "Геометрия: вписанные углы",
      "Пробный вариант ЕГЭ № 3",
      "Вероятность: независимые события",
      "Задачи с параметром · практика",
      "Дроби и степени: повторение",
    ];
    for (let i = 0; i < titles.length; i++) {
      const description = `## Разбираем тему шаг за шагом\n\n${i === 0 ? "Решите уравнения и проверьте корни подстановкой." : "Запишите ход решения и объясните, почему выбрали этот способ."}\n\n1. Решите уравнение **x² − 5x + 6 = 0**.\n2. Найдите значение выражения при x = 3.\n3. ⭐ Составьте свою задачу по теме.\n\n> В ответе важен ход рассуждений. Можно приложить фотографию тетради.`;
      const a = await api("teacher/homework/assignments", {
        title: titles[i],
        description,
        dueAt: instant(i === 6 ? -1 : i + 1),
        studentIds: [
          students[0].id,
          students[(i % 7) + 1].id,
          students[((i + 2) % 7) + 1].id,
        ],
      });
      assignments.push(a);
      if (i < 4) {
        const tasks = await api(
          "me/homework",
          undefined,
          "GET",
          studentHeaders[0],
        );
        const task = tasks.find((t) => t.assignmentId === a.id);
        const response = await context.request.post(
          `/api/me/homework/tasks/${task.taskId}/submissions`,
          {
            headers: studentHeaders[0],
            multipart: {
              text: "1. x² − 5x + 6 = (x − 2)(x − 3) = 0.\nПолучаем x = 2 или x = 3.\nПроверка: 4 − 10 + 6 = 0; 9 − 15 + 6 = 0.\n\n2. При x = 3 значение выражения равно 0.\n\nВ третьем задании пока сомневаюсь: можно ли использовать дискриминант?",
            },
          },
        );
        expect(response.ok(), await response.text()).toBeTruthy();
        if (i === 2 || i === 3)
          await api(`teacher/homework/tasks/${task.taskId}/review`, {
            decision: i === 2 ? "ACCEPT" : "RETURN",
            grade: i === 2 ? "5" : null,
            comment:
              i === 2
                ? "Отлично! Все шаги обоснованы, так держать."
                : "Верный подход! Добавь проверку корней в последнем задании.",
          });
      }
    }
    await api("teacher/homework/assignments", {
      title: "Тригонометрия: формулы приведения",
      description:
        "Черновик следующей недели: теория, примеры и самостоятельная практика.",
      studentIds: [],
    });
    const boards = [];
    for (const [i, title] of [
      "Квадратные уравнения · Алиса",
      "Графики функций · ЕГЭ",
      "Геометрия · разбор задач",
      "Олимпиадная мастерская",
    ].entries()) {
      boards.push(
        await api("teacher/boards", {
          kind: "EXCALIDRAW",
          title,
          studentIds: [students[0].id, students[(i + 1) % 8].id],
          groupIds: i === 1 ? [groups[0].id] : [],
        }),
      );
    }
    await api("teacher/boards", {
      kind: "LINK",
      title: "Интерактивные модели · GeoGebra",
      url: "https://www.geogebra.org/geometry",
      studentIds: [students[0].id],
      groupIds: [],
    });
    // Original sample books: no copyrighted scans or external assets.
    function workbookPdf(title, pages) {
      const objects = [
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      ];
      const streams = [];
      for (let n = 1; n <= pages; n++) {
        const content = `0.28 0.24 0.65 rg 0 680 595 162 re f BT /F1 28 Tf 1 1 1 rg 48 755 Td (${title}) Tj 0 -45 Td /F1 15 Tf (TEACHER BOX / MATH LAB / ${n}) Tj ET\nBT /F1 20 Tf 0.2 0.2 0.3 rg 48 615 Td (Practice ${n}: explore and explain) Tj /F1 14 Tf 0 -50 Td (1. Solve: x^2 - 5x + 6 = 0) Tj 0 -40 Td (2. Check each root by substitution.) Tj 0 -40 Td (3. Draw the graph and find its intersections.) Tj 0 -40 Td (Challenge: create a similar equation.) Tj ET\n0.8 0.8 0.9 RG 1 w 48 120 500 220 re S BT /F1 12 Tf 0.5 0.5 0.6 rg 60 310 Td (Your solution and notes) Tj ET`;
        objects.push(
          `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
        );
        streams.push(objects.length);
      }
      const parent = objects.length + pages + 1;
      const kids = streams.map((id) => {
        objects.push(
          `<< /Type /Page /Parent ${parent} 0 R /MediaBox [0 0 595 842] /Contents ${id} 0 R /Resources << /Font << /F1 1 0 R >> >> >>`,
        );
        return `${objects.length} 0 R`;
      });
      objects.push(
        `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages} >>`,
      );
      objects.push(`<< /Type /Catalog /Pages ${parent} 0 R >>`);
      let pdf = "%PDF-1.4\n";
      const offsets = objects.map((o, i) => {
        const offset = pdf.length;
        pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
        return offset;
      });
      const xref = pdf.length;
      pdf +=
        `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
        offsets
          .map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
          .join("");
      pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
      return Buffer.from(pdf, "ascii");
    }
    for (const [i, title] of [
      "Алгебра · практикум",
      "Геометрия · рабочая тетрадь",
      "ЕГЭ · задачи с параметром",
      "Олимпиадная математика",
    ].entries()) {
      const response = await context.request.post("/api/teacher/textbooks", {
        headers,
        multipart: {
          file: {
            name: `math-lab-${i + 1}.pdf`,
            mimeType: "application/pdf",
            buffer: workbookPdf(
              [
                "Algebra workbook",
                "Geometry workbook",
                "Exam preparation",
                "Math challenges",
              ][i],
              8 + i * 4,
            ),
          },
          kind: i === 1 ? "WORKBOOK" : "TEXTBOOK",
          title,
          course: "Математика",
          studentIds: state?.students?.[0]?.id ?? students[0].id,
        },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      const book = await response.json();
      if (i === 0)
        await api(
          `teacher/homework/assignments/${assignments[0].id}/textbooks`,
          { textbookId: book.id, pages: "2-4" },
        );
    }
    // A real, editable Excalidraw scene, saved through the board API.
    const elements = [];
    function element(type, x, y, width, height, extra = {}) {
      const id = `demo-${elements.length}`;
      elements.push({
        id,
        type,
        x,
        y,
        width,
        height,
        angle: 0,
        strokeColor: "#37306b",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: elements.length + 1,
        version: 1,
        versionNonce: elements.length + 100,
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        ...extra,
      });
    }
    function text(x, y, value, size = 24, color = "#37306b") {
      element("text", x, y, 650, size * 1.5, {
        text: value,
        originalText: value,
        fontSize: size,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        containerId: null,
        autoResize: true,
        lineHeight: 1.25,
        strokeColor: color,
      });
    }
    element("rectangle", 60, 70, 1050, 110, {
      backgroundColor: "#eee9ff",
      strokeColor: "#b7a6ed",
      roundness: { type: 3 },
    });
    text(95, 100, "Квадратные уравнения", 36);
    text(95, 225, "x² − 5x + 6 = 0", 32);
    text(95, 300, "D = b² − 4ac = 25 − 24 = 1", 26);
    element("rectangle", 75, 365, 470, 105, {
      backgroundColor: "#d3f9d8",
      strokeColor: "#2b8a3e",
      roundness: { type: 3 },
    });
    text(100, 395, "x₁ = 2         x₂ = 3", 30, "#2b8a3e");
    text(95, 525, "Проверка:  4 − 10 + 6 = 0 ✓", 24);
    text(95, 575, "                   9 − 15 + 6 = 0 ✓", 24);
    element("rectangle", 650, 225, 430, 240, {
      backgroundColor: "#fff3bf",
      strokeColor: "#e6b800",
      roundness: { type: 3 },
    });
    text(680, 255, "Теорема Виета", 28, "#9c6f00");
    text(680, 320, "x₁ + x₂ = 5", 26, "#9c6f00");
    text(680, 375, "x₁ · x₂ = 6", 26, "#9c6f00");
    text(660, 535, "Попробуй самостоятельно:", 24);
    text(660, 585, "x² − 7x + 12 = 0", 28);
    await api(
      `boards/${boards[0].id}/scene`,
      {
        elements,
        appState: { viewBackgroundColor: "#ffffff" },
        baseVersion: 0,
      },
      "PUT",
    );
    await login(context, "teacher");
    await page.goto(`/teacher/boards/${boards[0].id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".excalidraw canvas").first()).toBeVisible();
    await page.waitForTimeout(1500);
    const preview = await page
      .locator(".excalidraw canvas")
      .first()
      .screenshot();
    const previewResponse = await context.request.put(
      `/api/teacher/boards/${boards[0].id}/preview`,
      {
        headers: { ...headers, "Content-Type": "image/png" },
        data: preview,
      },
    );
    expect(previewResponse.ok(), await previewResponse.text()).toBeTruthy();
    await api("teacher/notifications/broadcast", {
      title: "План на следующую неделю",
      body: "Продолжаем подготовку к ЕГЭ: производная и задачи с параметром. До воскресенья сдайте практику, а на занятие принесите вопросы. Хороших выходных! 🌿",
      studentIds: students.map((s) => s.id),
    });
    state = { students, groups, assignments, boards };
    await extraFixtures(state);
    await writeFile(statePath, JSON.stringify(state));
  }
  await login(context, "teacher");
  await mkdir(out, { recursive: true });
  const selected = process.env.DEMO_SCREENS?.split(",");
  async function capture(name, route, target = page) {
    if (selected && !selected.includes(name)) return;
    await target.goto(route);
    await target.waitForLoadState("networkidle");
    expect(new URL(target.url()).pathname).toBe(
      new URL(route, baseURL).pathname,
    );
    await target.evaluate(() => document.fonts.ready);
    await expect(target.locator("h1").first()).toBeVisible();
    if (route.includes("notifications="))
      await expect(
        target.getByRole("dialog", { name: "Уведомления", exact: true }),
      ).toBeVisible();
    if (name === "cabinet-quiz") {
      await target
        .getByRole("button", { name: /^(Начать тест|Продолжить тест)$/ })
        .click();
      await target.getByRole("button", { name: /^Вопрос 1(?:,|$)/ }).click();
      await target.getByRole("radio", { name: "2 и 3", exact: true }).check();
    }
    await target.screenshot({
      path: `${out}${name}.png`,
      animations: "disabled",
    });
    console.log(`${name}: ${target.url()}`);
  }
  await capture("home", "/teacher");
  await capture("schedule", "/teacher/schedule");
  await capture("students", `/teacher/students/${state.students[1].id}`);
  await capture("student-profile", `/teacher/students/${state.students[0].id}`);
  await capture("groups", `/teacher/groups/${state.groups[0].id}`);
  await capture("homework", "/teacher/homework");
  await capture("assignment", `/teacher/homework/${state.assignments[0].id}`);
  await page.goto("/teacher/homework");
  await page.getByRole("button", { name: "Проверить все подряд" }).click();
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("textbox", { name: "Комментарий", exact: true })
    .fill(
      "Верное решение! Корни проверены подстановкой. В задаче со звёздочкой попробуй применить теорему Виета — обсудим на занятии.",
    );
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.screenshot({
    path: `${out}homework-review.png`,
    animations: "disabled",
  });
  await capture("billing", "/teacher/billing");
  await capture("billing-report", "/teacher/billing/report");
  await capture("boards", "/teacher/materials?tab=boards");
  await page.goto(`/teacher/boards/${state.boards[0].id}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".excalidraw")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: `${out}board-editor.png`,
    animations: "disabled",
  });
  await capture("textbooks", "/teacher/materials?tab=textbooks");
  await capture("notifications", "/teacher?notifications=inbox");
  await capture("settings", "/teacher/settings/lessons");
  await capture("ai", "/teacher/settings/ai");
  await capture("backups", "/teacher/settings/data");
  const studentContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  await login(studentContext, "demo-student-1");
  const studentPage = await studentContext.newPage();
  studentPage.on("pageerror", (error) => errors.push(error.message));
  for (const [name, route] of [
    ["cabinet-home", "/cabinet"],
    ["cabinet-schedule", "/cabinet/schedule"],
    [
      "cabinet-homework",
      `/cabinet/homework/${state.assignments[6].tasks[0].taskId}`,
    ],
    ["cabinet-billing", "/cabinet/billing"],
    ["cabinet-materials", "/cabinet/materials"],
    ["cabinet-notifications", "/cabinet?notifications=inbox"],
  ])
    await capture(name, route, studentPage);
  await capture(
    "cabinet-quiz",
    `/cabinet/homework/${state.quizTask}`,
    studentPage,
  );
  await studentPage.setViewportSize({ width: 390, height: 844 });
  await capture("cabinet-mobile", "/cabinet", studentPage);
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("teacher-mobile", "/teacher", page);
  if (errors.length) throw new Error(`Browser errors: ${errors.join("\n")}`);
} finally {
  await browser.close();
}
