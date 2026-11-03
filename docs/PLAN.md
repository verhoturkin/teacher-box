# Teacher Box plan

Active plan only, in English. Completed releases — [`archive/plans/`](archive/plans/README.md);
don't read them unless the task needs history.

## How to use

- A release is a `## vX.Y.Z` section (or `## Next release` until the number is known): goals (2–5
  lines), new/changed ADRs, then stages.
- Stages are numbered globally, continuing from the archive. Substeps: `85.1`, `85.2`, … Tags: **B**
  backend, **F** frontend, **D** docker/infra.
- A substep names its entry points — files, classes, endpoints, routes
  (`schedule/teacher/lesson-details-dialog.ts`, `ScheduleService.cancel`) — so the work starts there
  instead of a repository search.
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next
  release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to
  Backlog. This file keeps only unreleased work and the Backlog.

## Next release — settings and «Мой аккаунт»

Goals: one «Мой аккаунт» for the teacher and the student (Профиль, Вход, Оформление, Уведомления);
teacher settings from 8 categories to 6 (calendar, calls and payments merge into «Занятия»);
everything but the portal appearance saves on change, without «Отменить изменения?»; each
category shows its state in the list; rare things folded. No backend change: preferences, quiet
hours, push and bots already exist.

Sketches (the source for every step): canvas https://claude.ai/artifact/L3wuTYeXnspJ9AGwHRD6kx
(read it with the Artifact tool, `action: "read"`, `path: "project/<Board>.dc.html"`). Boards:
`Main` (teacher account), `Portal`, `Lessons`, `Messengers`, `Ai`, `Data`, `StudentAccount`,
`StudentTablet`, `StudentPhone`, `PhoneSettings`, `PhoneMessengers`, `PhoneConnect`,
`TabletSettings`, `Changes` (where each setting moved, the six rules). Sketch elements map to the
existing components (`tb-list` rows, tonal sections, filled fields, M3 buttons); M3 decides where a
sketch disagrees with it.

### Stage 356 — One «Мой аккаунт»

- [x] **356.1 F** Shared account sections in `identity/account/account-panel.ts` for
  `/teacher/settings/account` and `/cabinet/account` (`account-page.ts`): «Профиль» (photo, name),
  «Вход» (login, «Сменить…» password → `change-password-form.ts`, «Выйти»), «Оформление» (theme
  and language as selects). Fields save on change; the student and teacher stacks differ only by
  the teacher's extra row (356.2).
- [x] **356.2 F** «Уведомления» section of the same panel: «Куда присылать» — one list of the
  user's messengers and this device (`notifications/channels/channels-panel.ts`,
  `push/push-devices-card.ts`), «Подключить» per row; «Что присылать» — topic switches and «Тихие
  часы» (`preferences/preferences-panel.ts`); teacher only «Действия учителя в боте». Replaces the
  separate cards on both pages; the student «connect» card leads as an alert (`StudentAccount`).
- [x] **356.3 F** Compact and medium account: the student phone list (`StudentPhone`) and tablet
  (`StudentTablet`); «Подключить» opens a bottom sheet (`PhoneConnect`: «Открыть Telegram», the
  code with copy, «Ждём подключения…»; `channels/link-code-view.ts`) on compact, a dialog above.

### Stage 357 — Settings in six categories

- [x] **357.1 F** `settings/settings-categories.ts`: `account`, `portal`, `lessons`, `messengers`,
  `ai`, `data`; `calendar`, `calls`, `payments` redirect to `lessons`. Each row shows its state as
  the summary («Telegram работает», «Копия сегодня в 03:00», failed count badge). Compact: the
  account as a lead row above the «Портал» group (`PhoneSettings`); medium per `TabletSettings`.
  Drop the «Отменить изменения?» guard of `settings-page.ts` / `settings.routes.ts` for every
  category but `portal`; saving shows a short «Сохранено».
- [x] **357.2 F** «Занятия» (`Lessons`): «Время и цена» (`time-zone-card.ts`,
  `billing/settings/default-price-card.ts`, price saved on change), «Звонки»
  (`meetings/settings/meetings-settings-panel.ts`), «Google Календарь», «Подписка на календарь».
- [x] **357.3 F** «Мессенджеры» (`Messengers`, `PhoneMessengers`;
  `notifications/teacher/messengers-settings-panel.ts`): failed-deliveries alert
  (`settings/failed-deliveries-card.ts`), bots, «Что умеет бот» folded, students as «5 из 7» with
  the not connected and «Отправить ссылку», «Кто где» → the students list. The per-student
  messengers move to the student card (`/teacher/students/:studentId`, `student-channels.ts`);
  «Сообщение ученикам» (`broadcast-dialog.ts`) becomes «Написать всем» on «Ученики».
- [x] **357.4 F** «Портал» (`Portal`, `settings/portal-settings-card.ts`): «Название и логотип»,
  «Цвет портала», schemes and contrast folded as «Тонкая настройка», preview; the only category
  with an explicit save — a floating bar «Отменить» / «Сохранить» while the draft differs.
- [x] **357.5 F** «ИИ-помощник» (`Ai`, `ai/ai-settings-panel.ts`: model, «Мои промты», system
  prompts folded) and «Данные» (`Data`, `settings/backups/*`, `reset-card.ts`: copies with the last
  one first and «Все N копий», Google Drive, «Опасные действия» card with restore and reset).

Review of 356–357.5 (2026-11-03): no section used the sketches' outlined cards, and «Портал» was far
from its board. The sketches were then detailed (version 36 of the canvas): quiet-hours fields «С» /
«До», «Тонкая настройка» open (nine schemes with samples, four contrast levels, own colour), real
calls in «Занятия» (built-in calls, own link per student, Telemost in the app; no Telemost rooms),
AI usage by feature, «Последние запросы» with tokens and «Системные промты» open, the student
account at full width, and a new board `Details` (dialogs and opened states). The sketch takes
priority; depart from it only for a gross M3 violation and name it.

- [x] **357.6 F** Rebuild to the boards, with `.p-card.tb-section-card` (`styles.scss`, the homework
  editor's outlined card) for every group and missing styles taken from homework first: «Мой
  аккаунт» teacher and student at every width (`Main`, `StudentAccount`, `StudentTablet`,
  `StudentPhone`; quiet-hours fields; student at full width), the settings list (`PhoneSettings`,
  `TabletSettings`), «Портал» (`Portal` with «Тонкая настройка» open), «Занятия» (`Lessons`, real
  calls via `meetings/settings/meetings-settings-panel.ts`), «Мессенджеры» (`Messengers`,
  `PhoneMessengers`), the connect sheet (`PhoneConnect`).
- [x] **357.7 F** «ИИ-помощник» (`Ai`: usage by feature, «Последние запросы» with tokens and «Показать
  ещё» — `UsageReport.recent`, `AiApi.requests`, dropped in 357.5 — and «Системные промты» open,
  `ai/system-prompts-card.ts`), «Данные» (`Data`) and board `Details`: «Сменить пароль»
  (`change-password-form.ts`), restore and reset dialogs with the password, the failed deliveries
  opened, «Что умеет бот» opened, «Мессенджеры» of the student card, «Написать всем».

### Stage 358 — Docs and check

- [x] **358.1** `docs/screens.md` «Settings (teacher)» and student «Мой аккаунт»,
  `docs/design-system.md` (autosave rule), `docs/glossary.md`, help articles (ru, en), wiki pages
  that name settings categories, E2E suites under `e2e/tests/` that open the old categories.
- [x] **358.2** Check every board of the sketches against the running app (teacher and student,
  expanded / medium / compact); fix the gaps or list them here as decisions. Fixed: the topics as
  filter chips and «Ещё мессенджер» on medium (`StudentTablet`); «Тихие часы» as its own screen,
  topic rows without hints, «Подключить» beside the text on compact (`StudentPhone`,
  `PhoneMessengers`, `tb-list__trail--inline`); «Что умеет бот» as its own screen, «Кто где
  подключён» as a row and «Ученики · 5 из 7 подключены» as the label on compact. Decisions left:
  the compact app bar says «Аккаунт» (the nav label) and the bottom bar has no «Ещё» tab, as the
  shell is shared; «Пароль · Изменён …» has no date in the backend, so no subtitle; the
  «Подключите мессенджер» alert and the Telegram rows need a configured bot, covered by tests
  only; «ИИ-помощник» was not checked live (the dev backend has no assistant); the push
  «unsupported» message is clipped over plain HTTP (production uses HTTPS). Not re-opened in
  the browser: «Портал», «Занятия», «Данные» and the `Details` dialogs (built and checked in
  357.4–357.7). No sketch departs from M3 grossly.

### Stage 359 — Release

- [ ] **359.1** Release 0.45.0 (skill `release`).

## Repository maintenance

### Stage 336 — GitHub releases and README screenshots

- [x] **336.1** Publish missing GitHub releases for existing version tags using their
  `CHANGELOG.md` entries; refresh the nine `docs/assets/readme/*.png` screenshots from a
  disposable instance of v0.41.0 with fictional students and verify the README image links.

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Voice answers («Записать голос»): `MediaRecorder` in the answer panel of `my-task-page.ts` would upload
a record as an attachment. Missing: the browser records `audio/webm` and `FilePolicy` accepts no `webm` (a one-line
addition, plus `ACCEPTED_FILES`); decided against for now.

Colours of students and groups after 0.20.0: rows without an avatar (the student table of the
monthly report, homework and board lists by name) and the options of student / group selects.

`shared/ui/fold-card.ts` (`tb-fold-card`) is used by no page since 247.2: remove it or find it a use.

Carried over from 0.6.13 (design audit 2026-09-29, `archive/audit/`):

- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation
or "Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times
in the portal time zone; picking a reschedule time from free slots; file check before upload;
journal filters in the URL; prompt on leaving unsaved settings; invitation and first-run fixes;
list-detail for the review queue; filter chips instead of toggles. _List-detail for the review
queue, «Следующая работа», filter chips and search in long lists are planned in the redesign (stages
237, 242, 248)._

Calls after 0.8.0: call history; teacher moderation (mute / remove a participant); chat in the call;
«ученик ждёт» notification (LiveKit webhooks); opening the student's board from the call; Document
Picture-in-Picture; noise suppression; recording.
