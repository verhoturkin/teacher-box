# Architecture Decision Records

ADRs are the **history of decisions** (context → decision → consequences), written in Russian and not
rewritten afterwards. Current rules live in the specs; read an ADR only to learn *why* something is so.

- Architecture and conventions — [`AGENTS.md`](../../AGENTS.md), [`backend/AGENTS.md`](../../backend/AGENTS.md),
  [`frontend/AGENTS.md`](../../frontend/AGENTS.md).
- UI — [`docs/design-system.md`](../design-system.md) (consolidates ADR-0015, 0017–0027, 0044–0046, 0050).
- Modules — [`docs/modules/`](../modules).

A new ADR: next number, `NNNN-short-name.md`, sections «Контекст», «Решение», «Последствия», header with
«Статус», «Дата» and «Уточняет» / «Заменяет». Add a row below and update the spec it changes in the same
commit.

| ADR | Decision | Status | Spec |
|---|---|---|---|
| [0001](0001-modular-monolith.md) | Modular monolith on Spring Modulith | active | AGENTS.md §4 |
| [0002](0002-embedded-database.md) | H2 file mode, schema per module | active | AGENTS.md §4.2, backend |
| [0003](0003-authentication.md) | Invites, JWT, refresh-token rotation | active | [identity](../modules/identity.md) |
| [0004](0004-delivery-variants.md) | Two Docker Compose variants (split, single) | active (single removed — 0031) | README |
| [0005](0005-notifications.md) | Notifications: inbox + outbox + channel adapters | active | [notifications](../modules/notifications.md) |
| [0006](0006-ai-integration.md) | AI module with provider-agnostic SPI; Gemini, OpenRouter, DeepSeek | active | [ai](../modules/ai.md) |
| [0007](0007-frontend-stack-licensing.md) | Angular 21 LTS + PrimeNG 21 (MIT), version caps | active | frontend |
| [0008](0008-schedule.md) | Schedule, series, requests, reminders, ICS, Google Calendar, off-time | active | [schedule](../modules/schedule.md) |
| [0009](0009-external-integrations.md) | Outbound proxy, integration settings | active | backend |
| [0010](0010-administrator-and-diagnostics.md) | ADMIN role, logs, request id, diagnostics | active | [platform](../modules/platform.md) |
| [0011](0011-groups-and-group-lessons.md) | Student groups and group lessons | active | identity, schedule, billing |
| [0012](0012-meetings-and-boards.md) | Telemost rooms; Холст boards | boards part superseded by 0028, Telemost part by 0030 | [meetings](../modules/meetings.md), [boards](../modules/boards.md) |
| [0013](0013-bot-dialogs.md) | Messenger bot dialogs (`ChatAction` SPI) | active | [notifications](../modules/notifications.md) |
| [0014](0014-portal-settings-reset-and-restore.md) | Portal name/URL, first-run setup, restore, full reset | active | [platform](../modules/platform.md) |
| [0015](0015-design-system-and-mobile.md) | Tokens, themes, portal colour, mobile, logo | partly superseded; phone full-screen dialogs amended by 0050 | design-system |
| [0016](0016-admin-settings.md) | Admin settings UI (`SettingsCatalog`) | active | [platform](../modules/platform.md) |
| [0017](0017-material-design-3.md) | Material Design 3 on PrimeNG | partly superseded by 0019, 0023, 0027 | design-system |
| [0018](0018-component-rules.md) | One look per component type | refined by 0019–0026 | design-system |
| [0019](0019-material-3-expressive.md) | M3 Expressive; button colour = meaning | refined by 0022, 0023, 0025, 0026, 0044, 0046; button colours superseded by 0045 | design-system |
| [0020](0020-lists-in-cards.md) | Segmented lists in cards | active (corners refined by 0044) | design-system |
| [0021](0021-single-column.md) | One column; steady buttons; word wrapping | active, refined by 0048 (one column inside a pane from expanded) | design-system |
| [0022](0022-expressive-fields-menus-sheets.md) | Fields, menus, split button, bottom sheet | active | design-system |
| [0023](0023-status-colors-and-contrast.md) | Status colours, warning role, contrast | colour computation superseded by 0034 | design-system |
| [0024](0024-accessibility.md) | Accessibility | active; initial focus of dialogs amended by 0050 | design-system |
| [0025](0025-page-states.md) | Page states: loading, error, empty, feedback | active | design-system |
| [0026](0026-decision-buttons-and-dialogs.md) | Decision buttons and dialogs | partly superseded by 0045 (green decision and safe confirmation); widths, phone, lesson dialog and focus amended by 0050 | design-system |
| [0027](0027-bottom-navigation.md) | Bottom bar: four sections and «Ещё» | active, refined by 0048 («Ещё» → ☰) | design-system |
| [0028](0028-excalidraw-boards.md) | Excalidraw boards: kinds, members, scenes, backups, React island | active (real time — 0029) | [boards](../modules/boards.md) |
| [0029](0029-live-boards.md) | Live boards: WebSocket with a one-time ticket, relayed cursors and elements | active | [boards](../modules/boards.md) |
| [0030](0030-livekit-calls.md) | Built-in video calls on LiveKit: own server, rooms `tb-<ownerId>`, tokens, link precedence | active | [meetings](../modules/meetings.md) |
| [0031](0031-split-variant-only.md) | Only the split variant: single container, `bundle-frontend` and backend SPA serving removed | active | README, [operations](../operations.md) |
| [0032](0032-ready-images-and-installer.md) | Ready GHCR images (amd64/arm64), `compose.yaml` without the repository, Caddy profile, `install.sh` and `teacherbox` | active | README, [operations](../operations.md) |
| [0033](0033-textbooks.md) | Textbooks: module `textbooks`, PDF pages rendered by PDFBox, `homework` → `textbooks::api`, pages on a board in a frame | active | [textbooks](../modules/textbooks.md) |
| [0034](0034-md3-colors-from-material-color-utilities.md) | MD3 colours from `@material/material-color-utilities`: Fidelity scheme (spec 2025) from the portal colour, custom success/warning | active | design-system |
| [0035](0035-interface-languages.md) | Interface languages: TypeScript dictionaries per module checked by the compiler, language per device, switching reloads the page | active | design-system |
| [0036](0036-server-texts-in-the-users-language.md) | Server texts in the user's language: the language kept in the account, `Accept-Language` for answers, Java dictionaries as enums checked by the compiler | active | [identity](../modules/identity.md), [notifications](../modules/notifications.md), design-system |
| [0037](0037-backups-in-google-drive.md) | Backups in Google Drive (`drive.file`, connection in the data directory, upload of scheduled and manual backups); `shared.backup.BackupExclusions` — the portal backup keeps only the current board | active | [platform](../modules/platform.md), [boards](../modules/boards.md) |
| [0038](0038-files-sent-to-the-bot.md) | Files sent to the bot: `ChatAction.takesFiles` / `received`, adapters download on demand, type by the first bytes; payment receipts in `billing` (`pending_receipts` for the bot) | active | [billing](../modules/billing.md), [notifications](../modules/notifications.md) |
| [0039](0039-ai-reads-homework-sources.md) | AI reads the sources of homework: `ai` may depend on `textbooks::api` and `homework::api` (`AssignmentFiles`); the frontend sends IDs, PDF pages go as `document` blocks (Anthropic) or rendered PNG (OpenAI-compatible); limits 5 sources, 20 pages, 20 MB | active | [ai](../modules/ai.md), [homework](../modules/homework.md) |
| [0040](0040-interactive-homework.md) | Interactive homework: HTML stored as is, served by a 5-minute HMAC link with its own CSP (`sandbox allow-scripts`, nothing external, `frame-ancestors 'self'`), shown in a sandboxed frame; a bridge script reports height and `teacherbox.result(...)` | superseded by 0041 | [homework](../modules/homework.md) |
| [0041](0041-homework-without-kinds-board-link.md) | Homework without kinds (written only; the interactive page, «Готово» and kinds of prompts removed); an assignment remembers its board (`board_id`, `PUT …/board`), the student sees «Перейти на доску» only for a board of theirs | active | [homework](../modules/homework.md), [ai](../modules/ai.md), [boards](../modules/boards.md) |
| [0042](0042-ai-reads-picked-files.md) | AI reads files picked for a new assignment: `POST homework-draft` also as multipart (`brief` + `files`), `DraftSources.Upload` with the same types and limits; nothing is stored | active | [ai](../modules/ai.md) |
| [0043](0043-editable-system-prompts.md) | Editable system prompts of the AI assistant: `ai.system_prompts` keeps the teacher's texts (homework and review drafts), the resources are the defaults; `GET/PUT/DELETE /api/teacher/ai/system-prompts` | active | [ai](../modules/ai.md) |
| [0044](0044-m3-expressive-alignment-2026-10.md) | M3 Expressive alignment, October 2026: emphasized type up to 700, nested corners (`inner = outer − padding`), dialogs on surface-container-high, active navigation label secondary + Bold; flexible navigation bar in 0.16.3 | active | design-system |
| [0045](0045-button-accent-and-medium-size.md) | Buttons: one accent — filled primary, tonal secondary, red only for destruction, green/amber only for statuses; size M (56 px) only for the hero «Начать урок» (0.17.1) | active | design-system |
| [0046](0046-material-symbols-rounded.md) | Material Symbols Rounded instead of primeicons: a subset font of the used glyphs (`npm run icons`, 29 KB instead of 5.4 MB), code points not ligatures, 24/20/18 px, filled active section, grade −25 in the dark theme | active | design-system |
| [0047](0047-video-links-and-transcripts.md) | Video in homework by link only (YouTube, Rutube, VK Video players; other links open in a tab), up to 5 per assignment with a `[m:ss]` transcript; YouTube captions fetched by the server (InnerTube), .srt / .vtt by the browser; the AI reads transcripts as `text/plain` sources | active | [homework](../modules/homework.md), [ai](../modules/ai.md) |
| [0048](0048-panes-and-task-navigation.md) | Panes and task navigation: M3 breakpoints 600 / 840 / 1200 / 1600, panes from expanded (fixed 360 / 412 + flexible + side sheet), one column inside a pane; sections are tasks (Сегодня · Расписание · Ученики · Задания · Материалы · Оплаты), one home per function, one «Создать» at the top of the rail; phone — five destinations and ☰ instead of «Ещё» | active | design-system, [redesign](../archive/redesign-2026-10/README.md) |
| [0049](0049-lesson-owned-repetition.md) | Lesson-owned repetition, immutable occurrence boundaries, protected exceptions and phase-preserving migration | active | [schedule](../modules/schedule.md) |
| [0050](0050-one-dialog-model.md) | One dialog model: kinds `alert` / `form` / `sheet` chosen by content (basic dialog, full-screen on compact, bottom sheet), `<tb-dialog>`, `dialogSubmit()`, `Confirm`, filled fields everywhere, connected button groups only for toggles | active | design-system |
| [0051](0051-install-and-web-push.md) | Installable portal and web push: Angular service worker caching only the app shell (never `/api`), `no-cache` on `ngsw.json`; Web Push + VAPID + RFC 8291 encryption on JDK crypto, VAPID keys in `notifications.webpush_keys` (private key never leaves the store, included in backups), push as a delivery channel next to messengers | active | [notifications](../modules/notifications.md), design-system |
| [0052](0052-auto-checked-quizzes.md) | Auto-checked questions are part of an assignment (not a new kind): six types checked by the backend from structured data with stable option ids, reveal rule and attempts per assignment, best attempt counts, score suggested into the grade; the key never reaches the student before the reveal rule allows | active | [homework](../modules/homework.md), [ai](../modules/ai.md) |
