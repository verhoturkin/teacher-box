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

## Next release

Goals: what the teacher sets up leaves `.env` completely and lives in the portal: asked once in the
redesigned first-run wizard, changed later in Settings, applied without a restart. The AI assistant
takes several providers with several models each and a switch between them. Technical settings the
administrator owns (upload limits, proxies, sessions, backup schedule) stay in `.env` as optional
overrides but become editable in the administrator's settings without a restart. `.env` keeps only
what Docker Compose or a locked-out recovery needs.

Sketches — take the interface from them (each F substep names its boards; the board number is in its
title on the canvas, the file name in brackets):

| Canvas | Boards | Used by |
|---|---|---|
| [«Настройки и аккаунт — эскизы»](https://claude.ai/artifact/L3wuTYeXnspJ9AGwHRD6kx) | 3 `Lessons`, 10 `PhoneSettings`, 13 `TabletSettings` | 363.7 |
| same | 18 `AdminLive`, 19 `EnvMoves` | 363.8, 363.9 |
| same | 5 `Ai`, 17 `AiProviderDialog` | 364.4 |
| [«Задания — эскизы»](https://claude.ai/artifact/X2SdNjSvCbgsnwwccToard) | 13 `AiEditor`, 19 `TabletEditor`, 22 `PhoneAi` | 364.5 |
| «Настройки и аккаунт — эскизы» | 20 `OnbFlow`, 21 `OnbPortal`, 22 `OnbTime`, 23 `OnbRules`, 24 `OnbDone`, 25 `OnbPhone` | 365.1, 365.2 |
| «Задания — эскизы» | 33 `Elements` (sizes of buttons, fields, chips, lists), 34 `Flow` (diagram style) | every F substep |

Layout rule from the sketches: a dense screen on an expanded width uses three columns, as board 1
`Main` does (settings list + two card columns; the wizard: steps · form · example). Settings
categories already include «Ученики» (`Tags`, board 16) on every board.

New ADR-0056 «Настройки учителя — в портале, не в .env» (amends ADR-0014, ADR-0016): teacher
settings are rows in the owning module's schema, `.env` is read for them once — on the first start
of the new version, to import an existing value — and never again; administrator settings keep
`.env` > interface > default, but the ones marked `live` apply at once. New ADR-0057 «Несколько
ИИ-провайдеров»: providers and models in the `ai` schema, one default model, a per-request choice.

Teacher settings and where they go (all live, no `.env`):

| Was in `.env` | Owner module | Settings category | Wizard step |
|---|---|---|---|
| `TEACHERBOX_TIMEZONE` | `shared.time.InstanceTimeZone` backed by `platform` | Занятия | Время и оплата |
| `BILLING_CURRENCY` (locked after the first charge or payment) | `billing` | Занятия | Время и оплата |
| `BILLING_DEFAULT_LESSON_DURATION` + `SCHEDULE_DEFAULT_DURATION` → one value | `schedule` | Занятия | Время и оплата |
| `SCHEDULE_LATE_CANCELLATION`, `SCHEDULE_REMINDERS`, `SCHEDULE_HORIZON` | `schedule` | Занятия | Правила |
| `HOMEWORK_DUE_SOON_WINDOW` | `homework` | Занятия | Правила |
| `PUBLIC_URL` (default still from `TEACHERBOX_DOMAIN`) | `platform` (portal) | Портал | Вы и портал |
| `IDENTITY_TEACHER_NAME` | `identity` | Мой аккаунт | Вы и портал |
| `NOTIFICATIONS_TELEGRAM_BOT_TOKEN`, `VK_TOKEN`, `VK_GROUP_ID`, `MAX_TOKEN` | `notifications` | Мессенджеры | — (link on «Готово») |
| `SCHEDULE_GOOGLE_CLIENT_ID/SECRET` | `schedule` | Занятия | — |
| `BACKUP_GOOGLE_CLIENT_ID/SECRET` | `platform` (backup) | Данные | — |
| `AI_*` except the proxy | `ai` | ИИ-помощник | — (link on «Готово») |

Administrator settings, live in the interface, `.env` optional: `HOMEWORK_MAX_FILE_SIZE`,
`HOMEWORK_MAX_FILES_PER_UPLOAD`, every `*_PROXY` (YouTube, Google, Telegram, AI default proxy),
`TELEGRAM_API_URL`, `MAX_ATTEMPTS`, `LINK_CODE_TTL`, `WEBPUSH_SUBJECT`, the `IDENTITY_*_TTL`,
`MAX_FAILED_LOGINS`, `LOCK_DURATION`, `AUTH_RATE_LIMIT_*`, `BACKUP_CRON`, `BACKUP_KEEP_DAYS`,
`BOARDS_BACKUP_CRON`, `BOARDS_BACKUP_KEEP`. Stay `.env` only: `DOMAIN`, `COMPOSE_PROFILES`,
`HTTP_PORT`, `VERSION`, container limits, LiveKit, `JWT_SECRET`, teacher login / password / reset,
administrator login / password, `BACKUP_RESTART`, logging, JVM.

Out of scope: per-student reminder overrides, encrypting stored API keys (they stay as the messenger
tokens do — in the module's schema, inside the backups), AI usage limits per model.

### Stage 363 — teacher settings out of `.env`

- [ ] **363.1 B** Live settings mechanism (ADR-0056): `SettingDefinition` gets `owner` (`TEACHER` |
  `ADMIN` | `ENV_ONLY`) and `live`; `AdminSettingsService.save` applies `live` values at once — it
  replaces them in the `teacherboxAdminSettings` property source and publishes
  `shared.settings.SettingsChanged(names)` — and asks for a restart only for the rest. Consumers
  read through `Binder` / an `ObjectProvider` on every call instead of keeping the value in a field.
  Teacher settings vanish from `/api/admin/settings` and `.env.example`; the administrator sees a
  read-only «Перенесено в настройки учителя» list while such a variable is still set. Controller
  tests first (teacher 403, administrator 200, a live value is in force without a restart).
- [ ] **363.2 B** One-time import: `platform.settings.EnvImport` runs before the modules start
  reading; for each teacher setting with no stored row it copies the value from the environment or
  `SettingsFile` through the module's `api` facade (`ScheduleSettingsFacade`,
  `BillingSettingsFacade`, `HomeworkSettingsFacade`, `ChannelSettings`, `PortalService`,
  `AiProviders`), logs the name only, and adds a diagnostics warning «переменная больше не читается
  — удалите её из .env». Test per module: an upgraded instance keeps its values; a second start
  ignores a changed variable.
- [ ] **363.3 B** Time zone in the database: `InstanceTimeZone` backed by `platform.portal`
  (`portal_settings.time_zone`, migration), read per call; the seven classes that keep `ZoneId zone`
  in a field (`HomeworkSummaryService`, `NotificationService`, `LessonEvents`,
  `LessonRepetitionService`, …) read it per call; the `@Scheduled(zone = "${teacherbox.timezone}")`
  jobs (`ReceiptService`, `BoardBackupJob`, `IdentityHousekeeping`, `NotificationsHousekeeping`,
  `EventPublications`, `PlatformBackupAutoConfiguration`) move to one `platform`
  `SchedulingConfigurer` that re-registers triggers on `SettingsChanged` (also needed by 363.6 for
  the backup crons). `PUT /api/teacher/settings/time-zone`; changing it shifts no stored `Instant`.
  Tests: a job fires by the new zone after the change.
- [ ] **363.4 B** Lesson rules in `schedule`: table `schedule_settings` (default duration, late
  cancellation, reminders as a list of durations, horizon) replaces `ScheduleProperties` for these
  fields; `GET/PUT /api/teacher/schedule/settings` (`ScheduleQueries.settings`, validation: duration
  15–480 min, reminders ≤ 3 of 15 min – 7 d, horizon 4–26 weeks); a shorter horizon removes no
  existing lessons, a longer one fills series up on the next run. `billing` stops reading
  `BILLING_DEFAULT_LESSON_DURATION` and takes the duration from the lesson events it already gets.
  Currency: `billing_settings.currency`, `PUT` refused (409) once a charge or payment exists.
  Homework: `homework_settings.due_soon_window` (1–72 h), read by `DueSoonReminder` per run.
- [ ] **363.5 B** The rest of the teacher's settings lose their variables: portal address (the
  `TEACHERBOX_DOMAIN` default stays), teacher name, messenger tokens, Google Calendar and Drive
  clients — `fromEnvironment` and «Эта переменная главнее» go away from `ChannelSettingsService`,
  `PortalService`, the Google client services and their views; `SettingsCatalog` keeps them out.
- [ ] **363.6 B** Live administrator settings: upload limits (`HomeworkProperties` read per upload;
  the multipart ceiling of 25 MB / 30 MB stays fixed and bounds the value), proxies (the HTTP client
  factories build the client per request or rebuild on `SettingsChanged`), Telegram API address and
  proxy (restart the bot as a token change does), session TTLs and lock rules (read per sign-in),
  rate limit (the filter reads its bucket settings per period), backup schedules and retention (via
  the `SchedulingConfigurer` of 363.3). Backup schedule in the interface as «вкл/выкл + время» that
  writes the cron; the variable still takes any cron.
- [ ] **363.7 F** Settings «Занятия» (`settings/settings-categories.ts`, `time-zone-card.ts` →
  editable): «Время и цена» — time zone select (browser zone first), currency select locked with a
  hint after the first payment, default duration, price; new card «Правила» — late cancellation,
  reminders as input chips (24 ч, 1 ч, «+»), the homework due-soon reminder, «Создавать занятия
  серий на N недель вперёд». Saved on change like the other cards. Sketches: «Настройки и аккаунт»
  board 3 `Lessons` (two card columns beside the category list); phone and tablet as boards 10
  `PhoneSettings` and 13 `TabletSettings`.
- [ ] **363.8 F** Administrator settings (`features/admin`): sections «Файлы», «Сеть и прокси»,
  «Вход и сессии», «Резервные копии»; a live value saves without the restart banner; the restart
  banner only for `.env`-only rows that the administrator cannot change here anyway (shown read-only
  with their current value); «Перенесено в настройки учителя» list. Sketch: «Настройки и аккаунт»
  board 18 `AdminLive` (three columns on expanded widths, one on compact).
- [ ] **363.9** `.env.example` (only the deployment, LiveKit, accounts, security, logs blocks),
  `scripts/install.sh` asks nothing the wizard asks, `docs/wiki/` (Install, Update — «переменные,
  которые больше не читаются», Settings, Messengers, Google), help articles in Russian and English,
  `docs/modules/{platform,schedule,billing,homework,notifications}.md`, ADR-0056, E2E
  `e2e/tests/settings/live-settings.spec.ts` (change the reminders and the time zone, no restart; an
  old variable is imported once). The wiki table of moved variables follows board 19 `EnvMoves`.

### Stage 364 — several AI providers and models

- [ ] **364.1 B** Schema (ADR-0057): migration `ai/V5__providers.sql` — `providers` (id, kind
  `anthropic` | `gemini` | `openrouter` | `deepseek` | `openai-compatible`, name 1–60, api key, base
  url, proxy, position, version) and `models` (id, provider id, model id 1–120, label 1–60, effort,
  fallbacks, max tokens, timeout, position), `ai_settings` (default model id, monthly token limit);
  `ai.requests` gets `model_id`. `LlmClient` becomes `LlmClients.forModel(modelId)` — a client per
  provider, cached, dropped on change. In `AiDataReset` and the backup.
- [ ] **364.2 B** REST `/api/teacher/ai/providers` (list, create with a check request, `PUT`,
  `DELETE` — refused while it holds the default model) and `/models` under a provider (add, change,
  remove, reorder, `GET …/available` — the provider's own model list where its API has one, else
  empty and the teacher types the id); `PUT /api/teacher/ai/settings` (default model, limit). The
  key is write-only: views say «задан» and the last 4 characters. Controller tests first: the
  teacher only; the administrator sees providers' kinds and states, never keys.
- [ ] **364.3 B** Per-request model: `modelId` (optional) in the `homework-draft`, `quiz-draft`,
  `review-draft`, lesson summary requests (`AiViews`, `AiAssistant`); none — the default; an unknown
  or removed model → 409 with the default named. Usage (`AiUsage`) totals per model for the month;
  the monthly limit stays one for all. `AdminAiController` diagnostics list each provider's check.
- [ ] **364.4 F** Settings «ИИ-помощник» (`features/ai`, sketches `Ai`, `AiProviderDialog`): card
  «Подключения» — one `tb-list` row per provider (kind icon, name, «N моделей», state tag «Работает»
  / «Ошибка ключа»), its models nested as rows with a radio «По умолчанию»; «Добавить подключение»
  opens `AiProviderDialog`: kind as a selectable card grid, then key, address (shown for
  `openai-compatible` and under «Дополнительно» for others), proxy, «Проверить»; step 2 — the
  provider's models as a checklist with a search, «Добавить вручную». Model row menu: «Сделать
  основной», «Изменить» (label, effort, fallbacks, max tokens, timeout under «Дополнительно»),
  «Удалить». The usage card splits the bar by model. Phone and tablet follow list → detail; the
  dialog is full-screen on the phone. Sketches: «Настройки и аккаунт» board 5 `Ai` (connections
  with nested models, usage, limit) and board 17 `AiProviderDialog` (both dialog steps, the key
  error and the check result).
- [ ] **364.5 F** Model switch where the AI writes (`ai/homework-ai-panel.ts`,
  `homework/teacher/review-form.ts`, the lesson summary): a compact select chip «Claude Opus 5 ▾»
  next to «Сгенерировать», models grouped by provider, the default marked; the choice is remembered
  per device and reset when that model is removed; hidden when there is one model. Sketches: «Задания —
  эскизы» board 13 `AiEditor` (picker beside «Сгенерировать», the menu open: models grouped by
  connection, the default tagged, a broken connection disabled, «Настроить подключения»), board 19
  `TabletEditor` (the side sheet), board 22 `PhoneAi` (a short label «Opus 5» in the bottom
  sheet).
- [ ] **364.6** Wiki `docs/wiki/AI-assistant.md` (several connections, which to pick, proxy per
  connection), help in Russian and English, glossary «подключение», «модель по умолчанию»,
  `docs/modules/ai.md`, ADR-0057, E2E `e2e/tests/ai/providers.spec.ts` against the fake provider.

### Stage 365 — first-run wizard redesign

The wizard (`settings/setup/setup-page.ts`, `core/portal/setup.guard.ts`, ADR-0014) asks every
teacher setting that used to come from `.env` except the AI and messengers. Full-screen, no rail; a
vertical stepper on expanded widths, a linear progress with «Шаг 2 из 4» on compact; each step has
«Назад», «Далее» and «Пропустить — настроить позже»; every field is prefilled with a working
default, so «Далее» on each step is a valid setup. Expanded widths use three columns: steps · form
· «как увидит ученик» / examples.

- [ ] **365.1 F** Steps: «Пароль» (only while `passwordChangeRequired`) → «Вы и портал» (your name,
  photo optional, portal name, portal address with «Проверить» — prefilled from `TEACHERBOX_DOMAIN`
  or the browser's origin) → «Время и оплата» (time zone with the browser's zone suggested,
  currency, default duration, price) → «Правила» (late cancellation, lesson reminders, the homework
  due-soon reminder, the series horizon — with a one-line example under each: «Ученик отменил в
  20:00 перед уроком в 10:00 — это поздняя отмена») → «Готово» (cards with state: «Добавить
  ученика», «Подключить мессенджер», «Подключить ИИ», «Google Календарь»; «Перейти в портал»).
  Reuses the settings cards' form parts so the wizard and Settings stay one component per setting.
  Sketches: «Настройки и аккаунт» board 20 `OnbFlow` (steps, transitions, defaults table), 21
  `OnbPortal`, 22 `OnbTime`, 23 `OnbRules`, 24 `OnbDone`, 25 `OnbPhone` (compact: top bar with
  «Шаг 2 из 4», linear progress, «Далее» pinned at the bottom).
- [ ] **365.2 F** The home queue's «С чего начать» (`home/todo-queue.ts`) drops «Цена занятия»
  (asked in the wizard) and adds «Подключить ИИ» after «Мессенджер»; finished steps of the wizard
  are not repeated there. Sketch: board 24 `OnbDone` (the same four next steps).
- [ ] **365.3** Help `teacher/setup` and `teacher/first-steps` in Russian and English, wiki
  `docs/wiki/Install.md` («первый вход»), `docs/screens.md` (wizard), E2E
  `e2e/tests/setup/first-run.spec.ts` (fresh instance: all steps with defaults, then Settings show
  the chosen values).

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
