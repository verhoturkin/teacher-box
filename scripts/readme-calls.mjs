/** Real local LiveKit calls with synthetic notebook camera streams; see docs/assets/readme/README.md. */
import {
  chromium,
  expect,
} from "../e2e/node_modules/@playwright/test/index.mjs";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseURL = process.env.DEMO_BASE_URL ?? "http://localhost:4200";
if (!["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
  throw new Error("Use the disposable local README demo instance.");
}
const password = process.env.DEMO_PASSWORD ?? "readme-demo-pass";
const state = JSON.parse(
  await readFile("/tmp/teacherbox-readme-state.json", "utf8"),
);
const output = new URL("../docs/assets/readme/", import.meta.url).pathname;
const mediaDirectory = await mkdtemp(join(tmpdir(), "teacherbox-call-media-"));
const browsers = [];
const errors = [];

// Original instructional artwork, streamed through Chromium's standard fake-camera device.
// The application, signalling, rooms, subscriptions and decoded WebRTC video remain real.
function notebook(kind) {
  const lines = Array.from(
    { length: 14 },
    (_, i) => `<path d="M100 ${100 + i * 27}H855" stroke="#dde6f1"/>`,
  ).join("");
  const sketches = [
    `<path d="M275 400V125 M170 330H725" stroke="#76879a" stroke-width="3"/>
     <path d="M320 170 Q520 550 720 170" fill="none" stroke="#7763cf" stroke-width="7"/>
     <path d="M325 325H715" stroke="#32a389" stroke-width="3" stroke-dasharray="8 8"/>
     <circle cx="405" cy="330" r="8" fill="#32a389"/><circle cx="635" cy="330" r="8" fill="#32a389"/>
`,
    `<text x="145" y="132" font-size="32">x² − 5x + 6 = 0</text>
     <text x="145" y="212" font-size="29">D = 25 − 24 = 1</text>
     <rect x="125" y="250" width="540" height="85" rx="18" fill="#d5f1dc"/>
     <text x="150" y="305" font-size="34" fill="#24734b">x₁ = 2       x₂ = 3</text>
     <text x="145" y="402" font-size="25">Проверка:  4 − 10 + 6 = 0 ✓</text>
     <text x="145" y="448" font-size="25">                   9 − 15 + 6 = 0 ✓</text>`,
    `<path d="M195 385L480 120L735 385Z" fill="#e5e0fa" stroke="#7763cf" stroke-width="5"/>
     <circle cx="475" cy="290" r="165" fill="none" stroke="#31a38a" stroke-width="4"/>
     <path d="M480 120V385" stroke="#ecb849" stroke-width="4" stroke-dasharray="10 7"/>
     <text x="470" y="100" font-size="28">A</text><text x="160" y="410" font-size="28">B</text>
     <text x="745" y="410" font-size="28">C</text><text x="160" y="465" font-size="25">Углы и окружности</text>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
    <rect width="960" height="540" fill="${["#cdc0b1", "#bcd6cc", "#c7c4d9"][kind]}"/>
    <rect x="65" y="37" width="825" height="488" rx="12" fill="#000" opacity=".12"/>
    <rect x="55" y="25" width="825" height="488" rx="10" fill="#fffdf7"/>
    ${lines}<path d="M120 25V513" stroke="#edc5c5" stroke-width="2"/>
    <g font-family="DejaVu Sans" fill="#31455c">${sketches[kind]}</g>
    <rect x="886" y="95" width="13" height="335" rx="6" fill="#48566e" transform="rotate(7 890 95)"/>
    <rect x="35" y="35" width="7" height="465" rx="3" fill="#5f6175" opacity=".25"/>
  </svg>`;
}
async function participant(login, kind) {
  const input = join(mediaDirectory, `${kind}.svg`);
  const camera = join(mediaDirectory, `${kind}.y4m`);
  await writeFile(input, notebook(kind));
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-loop",
    "1",
    "-i",
    input,
    "-r",
    "15",
    "-t",
    "1",
    "-pix_fmt",
    "yuv420p",
    camera,
  ]);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${camera}`,
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  browsers.push(browser);
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    colorScheme: "light",
    reducedMotion: "reduce",
    permissions: ["camera", "microphone"],
  });
  const response = await context.request.post("/api/auth/login", {
    data: { login, password },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return page;
}
async function openCall(page, ownerId, title) {
  await page.goto(`/call/${ownerId}`);
  const preview = page.getByRole("dialog", {
    name: `Звонок: ${title}`,
    exact: true,
  });
  await expect(preview).toBeVisible();
  await expect
    .poll(() => preview.locator("video").evaluate((v) => v.readyState), {
      timeout: 20000,
    })
    .toBeGreaterThanOrEqual(2);
  return preview;
}
async function enter(page, preview, title) {
  await preview.getByRole("button", { name: "Войти", exact: true }).click();
  const call = page.getByRole("dialog", { name: title, exact: true });
  await expect(call).toBeVisible();
  await expect(
    call.getByRole("button", { name: "Камера", exact: true }),
  ).toBeEnabled({
    timeout: 30000,
  });
  return call;
}
async function videoReceived(page, count) {
  await expect
    .poll(
      async () =>
        page
          .locator("tb-call-window video")
          .evaluateAll(
            (videos) =>
              videos.filter(
                (video) => video.readyState >= 2 && video.videoWidth > 0,
              ).length,
          ),
      { timeout: 30000 },
    )
    .toBeGreaterThanOrEqual(count);
}
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: join(output, `${name}.png`),
    animations: "disabled",
  });
  console.log(`Captured ${name}`);
}
try {
  await mkdir(output, { recursive: true });
  const teacher = await participant("teacher", 0);
  const alice = await participant("demo-student-1", 1);
  const sophia = await participant("demo-student-3", 2);
  let preview = await openCall(
    teacher,
    state.students[0].id,
    state.students[0].displayName,
  );
  await expect(
    teacher.getByText("Занятия сегодня", { exact: true }),
  ).toBeVisible();
  await capture(teacher, "call-prejoin");
  const individual = await enter(
    teacher,
    preview,
    state.students[0].displayName,
  );
  await enter(
    alice,
    await openCall(alice, state.students[0].id, "Урок"),
    "Урок",
  );
  await expect(individual).toContainText("2 участника", { timeout: 30000 });
  await videoReceived(teacher, 2);
  await expect
    .poll(
      () =>
        individual
          .locator(".tb-call-stage__main video")
          .evaluate((video) => video.videoWidth),
      { timeout: 30000 },
    )
    .toBeGreaterThanOrEqual(640);
  await capture(teacher, "call-individual");
  await individual.getByRole("button", { name: "Выйти из звонка" }).click();
  await alice.getByRole("button", { name: "Выйти из звонка" }).click();
  const groupName = state.groups[0].name;
  const groupId = state.groups[0].id;
  const group = await enter(
    teacher,
    await openCall(teacher, groupId, groupName),
    groupName,
  );
  await enter(alice, await openCall(alice, groupId, groupName), groupName);
  await enter(sophia, await openCall(sophia, groupId, groupName), groupName);
  await expect(group).toContainText("3 участника", { timeout: 30000 });
  await videoReceived(teacher, 3);
  await expect
    .poll(
      () =>
        group
          .locator("video")
          .evaluateAll((videos) =>
            Math.min(...videos.map((video) => video.videoWidth)),
          ),
      { timeout: 30000 },
    )
    .toBeGreaterThanOrEqual(640);
  await capture(teacher, "call-group");
  await group.getByRole("button", { name: "Свернуть", exact: true }).click();
  await expect(
    teacher.getByRole("region", { name: "Звонок", exact: true }),
  ).toBeVisible();
  // Navigate inside the SPA: a full page load would close the active call.
  await teacher
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Материалы", exact: true })
    .click();
  await teacher
    .getByRole("link", { name: state.boards[0].title, exact: true })
    .click();
  await expect(teacher.locator(".excalidraw canvas").first()).toBeVisible();
  await expect(
    teacher.getByRole("region", { name: "Звонок", exact: true }),
  ).toBeVisible();
  await teacher.waitForTimeout(1000);
  await capture(teacher, "call-mini");
  for (const page of [teacher, alice, sophia])
    await page.getByRole("button", { name: "Выйти из звонка" }).click();
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await Promise.all(browsers.map((browser) => browser.close()));
  await rm(mediaDirectory, { recursive: true, force: true });
}
