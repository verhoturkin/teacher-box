# Teacher Box plan

Active plan only, in English. Completed releases — [`archive/plans/`](archive/plans/README.md); don't read them
unless the task needs history.

## How to use

- A release is a `## vX.Y.Z` section (or `## Next release` until the number is known): goals (2–5 lines),
  new/changed ADRs, then stages.
- Stages are numbered globally, continuing from the archive. Substeps: `85.1`, `85.2`, …
  Tags: **B** backend, **F** frontend, **D** docker/infra.
- A substep names its entry points — files, classes, endpoints, routes (`schedule/teacher/lesson-details-dialog.ts`,
  `ScheduleService.cancel`) — so the work starts there instead of a repository search.
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to Backlog. This file
  keeps only unreleased work and the Backlog.

## v1.7.2

Goals: the board editor looks like the portal (its colour roles, not Excalidraw's violet; the canvas background
stays the board's); the board menu gets the theme («Светлая» / «Тёмная» / «Как в системе» — the portal's own
setting), the grid and the mouse wheel (zoom by default, or scroll for a touchpad); boards work in real time —
the others' strokes appear as they draw, with their cursors and names.

ADRs: **ADR-0029** «Доски в реальном времени» — a WebSocket per open board (`/api/public/boards/live`, a one-time
ticket from `POST /api/boards/{id}/live`), the server only relays cursors and changed elements between the
editors of one board (in memory, one instance); the scene is still saved by `PUT …/scene` and polling stays as
the fallback. Supersedes the «опрос, без реального времени» part of ADR-0028.

### Stage 96. Board look and settings

- [x] 96.1 **F** `styles.scss` (Excalidraw section): Excalidraw's UI variables (`--color-primary*`,
      `--color-surface-*`, `--color-on-surface`, `--island-bg-color`, outlines, links, focus) from the portal's
      `--p-md-*` roles in both themes; `--default-bg-color` and the canvas background stay.
- [x] 96.2 **F** `boards/editor/excalidraw-island.ts`, `excalidraw-loader.ts` (`BoardMenuItem` groups and a
      `selected` mark), `board-page.ts`: menu groups «Тема» (`ThemeMode.choose`), «Сетка» (toggles the board's
      `gridModeEnabled`, shared as before), «Колесо мыши» — «Масштаб» (default) / «Прокрутка (тачпад)», a device
      setting `tb.board.wheel`; `board-canvas.ts` input `wheel`: in zoom mode a plain wheel over the canvas zooms
      (re-dispatched with `ctrlKey`), Shift + wheel still scrolls sideways.

### Stage 97. Real time

- [x] 97.1 **B** `boards`: `spring-boot-starter-websocket`; `application/LiveTickets` (one-time, 60 s, issued
      after `requireAccess`, Excalidraw boards only), `web/BoardsController` `POST /api/boards/{id}/live`;
      `live/` adapter — `LiveConfiguration` (`/api/public/boards/live`, message ≤ 1 MB), `LiveRooms` (peers of a
      board, colour index, `welcome` / `joined` / `left`, relays `pointer` and `elements`, `saved` after a scene
      save or restore — `SceneSaved` after commit), access re-checked on board change / delete, student
      deactivation and group changes (sessions that lost access are closed). nginx: `Upgrade` / `Connection`
      for `/api/`, dev proxy `ws: true`. Tests: tickets, handshake, relay, access loss.
- [x] 97.2 **F** `boards/editor/board-live.ts` (`BoardLive`: ticket, socket, reconnect with back-off, ping,
      peers), `board-sync.ts` (sends changed elements every ~100 ms, applies relayed ones without saving them
      again, polls on `saved`, polls every 30 s while live), `board-canvas.ts` (`onPointerUpdate`,
      `isCollaborating`, collaborators with names and colours), `BoardsApi.liveTicket`.
- [ ] 97.3 ADR-0029, ADR-0028 status, `docs/modules/boards.md`, `docs/operations.md` (own reverse proxy must pass
      WebSocket), README.

### Stage 98. Release 1.7.2

- [ ] 98.1 Help, E2E `version-1-7-2.spec.ts`, CHANGELOG, version 1.7.2.

## Backlog

Carried over from 1.6.13 (design audit 2026-09-29, `archive/audit/`):
- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation or
"Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times in the
portal time zone; picking a reschedule time from free slots; file check before upload; journal filters in
the URL; prompt on leaving unsaved settings; invitation and first-run fixes; list-detail for the review
queue; filter chips instead of toggles.

Future:
- Two-way Google Calendar sync.
- Board templates / duplicating.
- Lesson packages/subscriptions, online payment.
- Telegram login, 2FA for teacher and administrator.
- WhatsApp and e-mail channels.
- AI hints for students with quotas.
