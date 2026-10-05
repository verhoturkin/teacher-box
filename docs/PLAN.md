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

## v1.7.0

Goals: our own Excalidraw boards inside the portal: the teacher creates, deletes and backs up boards, binds a board
to any number of students and groups, both sides open it from «Доски» / «Мои доски» and return to the menu.
Any other board (Холст included) is an external board: a title and a link, nothing more. The single-owner model
(one board → one student or group) and every mention of a Холст API go away. The initial bundle does not grow:
React and Excalidraw load only when a board opens (dynamic `import()`).

ADRs: new ADR-0028 «Доски Excalidraw» (board kinds, members, scene storage, React island); ADR-0012 — boards part
superseded by 0028.

### Stage 84. Documentation for agents

Goal: less context per task and one current source per topic. No product changes.

- [x] 84.1 Nested `backend/AGENTS.md` and `frontend/AGENTS.md` (+ `CLAUDE.md` → `@AGENTS.md`); root `AGENTS.md`
      keeps the core and a "what to read" map.
- [x] 84.2 `docs/adr/README.md` — ADR index with status; design ADRs point to the spec.
- [x] 84.3 `docs/design-system.md` — current UI rules consolidated from ADR-0015, 0017–0027 and checked
      against the code.
- [x] 84.4 `docs/modules/*.md` — one page per module (rules, contract, data, REST, frontend).
- [x] 84.5 Skills `release`, `new-module`, `new-setting` in `.claude/skills/`.
- [x] 84.6 `docs/archive/` — completed plans and the 2026-09-29 design audit.

### Stage 85. Less output and fewer wasted turns for agents

Goal: shorter tool output in agent sessions. No product changes.

- [x] 85.1 **D** `scripts/verify.sh`: full output to `.verify-logs/<step>.log`, one line per step, the log tail
      on failure (`VERIFY_VERBOSE`, `VERIFY_TAIL`).
- [x] 85.2 Targeted tests while iterating: `npm run test:only -- <path>` (frontend), `./mvnw -q test -Dtest=…`
      (backend); the rule in `AGENTS.md` §5.
- [x] 85.3 `.claude/settings.json`: lockfiles not readable; `.ignore` keeps `docs/archive/` and lockfiles out of
      searches.
- [x] 85.4 PostToolUse hook `.claude/hooks/format.mjs`: Prettier on edited frontend and e2e files.
- [x] 85.5 Plan substeps name their entry points; "Context economy" in `CLAUDE.md`.

### Stage 86. Green E2E after 1.6.12–1.6.13

Goal: the CI E2E job passes again; the scenarios follow the UI of 1.6.12–1.6.13.

- [x] 86.1 **F** `e2e/tests/*`: the invite link is the textbox (row buttons «Новая ссылка-приглашение: …» match
      the label too); the bell is a link in `tb-notification-bell`; the teacher sees «Адрес задан
      администратором портала»; the weekly schedule ends with `pi-stop-circle` (DA-066); button heights are
      measured after the dialog grows in.
- [x] 86.2 **F** `styles.scss` `.tb-lesson-actions--stacked .tb-button-group`: equal halves on a 360 px phone
      (`flex: 1 1 0`, `min-width: 0`, 16 px sides) — «Перенести» with its icon was 8 px wider.
- [x] 86.3 **F** `billing/billing-labels.ts`: the status tag of a missed lesson is «Пропуск», the full «Пропуск
      (оплачивается)» is its `title` (`LESSON_STATUS_HINTS`) — the lesson journal of the monthly report fits a
      tablet (`version-1-6-5` «without scrolling sideways»).

### Stage 87. Excalidraw as a lazy React island

Goal: a tested Angular wrapper around Excalidraw that costs the initial bundle nothing. Decision recorded first.

- [x] 87.1 ADR-0028 (Russian) `docs/adr/0028-excalidraw-boards.md`: board kinds `EXCALIDRAW` / `LINK`, members
      (students and groups, many-to-many), scene in the `boards` schema + images in `FileStorage`, board backups
      (daily and manual), co-editing by polling with per-element merge (no real time), React island via dynamic
      `import()` (alternatives: Vite-built web component, iframe mini-app, Angular↔React wrapper libs — why
      rejected). Row in `docs/adr/README.md`; ADR-0012 status →
      «boards part superseded by 0028».
- [x] 87.2 **F** Dependencies `react`, `react-dom`, `@excalidraw/excalidraw` (`npx -y npm@11 install`; check
      the current Excalidraw API in docs first). `features/boards/editor/excalidraw-loader.ts` — the only place
      with `await import('react-dom/client')` / `import('@excalidraw/excalidraw')`; `excalidraw-host.ts` —
      `createRoot`, `root.render(createElement(Excalidraw, props))` without JSX (no tsconfig change), unmount on
      `DestroyRef`. ESLint `no-restricted-imports`: `react*` and `@excalidraw/*` only under
      `features/boards/editor/**`.
- [x] 87.3 **F** `angular.json`: Excalidraw CSS as a non-injected style bundle (`inject: false`,
      `bundleName: 'excalidraw'`) loaded by the loader via `<link>`; fonts copied to `excalidraw-assets/`
      (assets glob) + `window.EXCALIDRAW_ASSET_PATH` — no CDN. Measure: initial bundle before/after (must be
      unchanged), lazy chunks raw/gzip → ADR-0028. `initial` budget stays as is.
- [x] 87.4 **F** `features/boards/editor/board-canvas.ts` (standalone, signals): inputs `scene`, `theme`;
      output `sceneChange`; loading/error states (ADR-0025). Tests mock the loader (no React in jsdom); coverage
      gates hold.
- [x] 87.5 **D** `docker/nginx/security-headers.conf`: check the board in the single container — fonts, export
      to PNG/SVG (workers / wasm); widen CSP only as far as needed (`worker-src`, `'wasm-unsafe-eval'`), note why.
      *Done: CSP unchanged (SVG glyph subsetting needs `'unsafe-eval'` — skipped by Excalidraw, whole fonts
      embedded); `self-hosted-fonts.ts` drops Excalidraw's CDN font source; `excalidraw-island.ts` imports React
      statically (dynamic `import()` of CommonJS gave only `default`). Initial +3 kB (`tslib`) — re-measure in 90.1.*

### Stage 88. Boards model v2 (backend)

Goal: a board has a kind and members; Excalidraw scene and images live on the server. Entry: `boards/`.

- [x] 88.1 **B** `db/migration/boards/V2__boards_members_and_scenes.sql`: existing boards deleted (old
      single-owner links are not migrated); `boards.kind`, `url` nullable, `board_members (board_id, member_type
      STUDENT|GROUP, member_id)`, `board_scenes (board_id, elements, app_state, scene_version, updated_at,
      updated_by)`; drop `owner_type`/`owner_id`. Domain `Board`, `BoardKind`, `BoardMember`; remove `holst()`,
      `isHolst`, «Доска Холст», `MAX_PER_OWNER`.
- [x] 88.2 **B** `TeacherBoardsController` (controller tests with roles first): `GET /api/teacher/boards
      ?studentId|groupId`, `POST` (kind, title, url for `LINK`, `studentIds`, `groupIds`), `PUT /{id}` (title,
      url, members, version), `DELETE /{id}` (scene, backups and files too). Members must be current students /
      active groups (`UserDirectory`, `StudentGroups`).
- [x] 88.3 **B** Access: `BoardService.requireAccess(user, boardId)` — teacher, or a student who is a member
      directly or through a current group (always edit, no read-only mode); otherwise 404. `/api/me/boards` →
      kind, groups, `updatedAt`. Tests «another student gets 404», «left the group — no access».
- [x] 88.4 **B** Scene: `GET /api/boards/{id}` (meta + scene + `sceneVersion`), `PUT /api/boards/{id}/scene`
      (`elements`, `appState` whitelist, `baseVersion`) — server merge per element id by `version` /
      `versionNonce` (Jackson 3 `JsonNode`, deleted elements kept as tombstones), returns the merged scene and the
      new `sceneVersion`; `GET /api/boards/{id}/scene?since=<version>` → 204 when nothing changed (polling);
      scene size limit; a `LINK` board has no scene → 409. Tests: two users save concurrently — both changes kept.
- [x] 88.5 **B** Images: `PUT|GET /api/boards/{id}/files/{fileId}` in `FileStorage` namespace
      `boards/<boardId>/`; png/jpeg/webp/gif only (no SVG), size limit like homework attachments, immutable cache
      headers; a file stays while the scene or any backup refers to it. `BoardsDataReset` also wipes the files
      namespace. *Done with namespace `boards` + table `board_files` (a `FileStorage` namespace has no sub-folders);
      the platform deletes the files on a reset.*
- [x] 88.6 **B** Board backups: table `board_backups (id, board_id, kind DAILY|MANUAL, elements, app_state,
      scene_version, created_at)`. `BoardBackupJob` `@Scheduled(cron = TEACHERBOX_BOARDS_BACKUP_CRON, zone = time
      zone)` — a daily copy of each board changed since its last copy; keeps `TEACHERBOX_BOARDS_BACKUP_KEEP` daily
      copies (skill `new-setting`). Teacher REST: `GET /api/teacher/boards/{id}/backups`, `POST …/backups` (manual
      copy, limit per board), `POST …/backups/{backupId}/restore` (the current scene is saved as a copy first),
      `DELETE …/backups/{backupId}`. Integration test: instance backup → restore keeps scene, copies and images.
- [x] 88.7 **B** `MyBoardsChatAction`: Excalidraw boards → `Portal.link("/cabinet/boards/<id>")`, external —
      the URL. Update `BoardsIntegrationTests`, `MyBoardsChatIntegrationTests`, `ResetIntegrationTest`,
      `docs/modules/boards.md`.

### Stage 89. «Доски» for the teacher (frontend)

Goal: one page to manage all boards; the old per-student widgets go away. Entry: `features/boards/`.

- [x] 89.1 **F** `data-access/boards-api.ts`, `boards.models.ts` (`BoardKind`, `BoardSummary`, `BoardScene`,
      `BoardBackup`, members) rewritten; `src/testing/boards-fixtures.ts`.
- [x] 89.2 **F** Route `/teacher/boards` (`features/boards/teacher/boards-page.ts`, lazy) + item «Доски» in
      `core/layout/teacher-layout.ts` (on a phone — under «Ещё», ADR-0027). List: title, kind, members, last
      change; filter by student / group in the URL (`?student=`, `?group=`); page states (ADR-0025).
- [x] 89.3 **F** `teacher/board-dialog.ts`: create / edit — kind («Доска Excalidraw» / «Внешняя доска по
      ссылке»), title, link, members (students and groups, multi-select). Delete with confirmation (ADR-0026).
- [x] 89.4 **F** `teacher/board-backups-dialog.ts`: list of copies (daily / manual, date), «Сделать копию»,
      «Восстановить» and «Удалить» with confirmation (ADR-0026); opened from the list and from the editor menu.
- [x] 89.5 **F** Replace the old UI: `BoardCell`, `BoardsDialog`, `OwnerBoards` in
      `identity/students/students-page.ts` and `identity/groups/groups-panel.ts` → link «Доски (n)» to the
      filtered page; `OwnerBoardLinks` in `schedule/teacher/lesson-details-dialog.ts` and
      `schedule/home/upcoming-lesson-widget.ts` → boards of the lesson's student/group. Delete dead components,
      update `parts.ts`, `e2e/tests/version-1-2.spec.ts`.
      *Done: the student's «Мои доски» made five sections — the bottom bar now shows five without «Ещё»
      (`shell.ts`, design system §4).*

### Stage 90. Board editor: open and return

Goal: a board opens full screen and returns to the menu without losing changes. Entry: `features/boards/editor/`.

- [x] 90.1 **F** Routes `/teacher/boards/:id`, `/cabinet/boards/:id` in `app.routes.ts` outside the shell layout
      (full screen, same guards) → `editor/board-page.ts`: top bar «← Доски» / «← Мои доски», title, save
      status; Excalidraw `MainMenu` item «Вернуться к доскам» (teacher: also «Резервные копии»); portal theme,
      `langCode="ru-RU"`, embeds off (`validateEmbeddable`). External boards are not routed — they open in a new
      tab. Excalidraw's own menu items (GitHub, Discord, «Follow us») removed; headings of its dialogs use only
      `Assistant` (no Cyrillic → serif) — give `.excalidraw` headings the portal font fallback (global styles, the
      dialogs are portalled to `body`). Re-measure the initial bundle (ADR-0028).
      *Done: the Cyrillic range of `Assistant` is mapped to local sans-serif fonts (`@font-face` with
      `unicode-range`); initial bundle 730.45 kB (ADR-0028).*
- [x] 90.2 **F** Autosave: debounce on `sceneChange` (only when the elements changed), flush on «назад»,
      `visibilitychange` and `canDeactivate`; status «Сохранено» / «Сохранение…» / «Нет связи — повторим»;
      the merged scene from the response applied to the canvas; new images uploaded once by `fileId`, loaded back
      through `addFiles`.
- [x] 90.3 **F** Co-editing by polling (no real time): while the tab is visible poll
      `GET /api/boards/{id}/scene?since=<version>` every ~5 s (paused while hidden), apply others' changes with
      Excalidraw `reconcileElements` without disturbing the local selection / drawing; missing images fetched.
      No WebSocket, cursors or presence — Backlog.
- [x] 90.4 **F** Student «Мои доски»: `/cabinet/boards` (`features/boards/student/my-boards-page.ts`) + item
      in `core/layout/student-layout.ts`; `MyBoardsCard` (`home/student-home.ts`,
      `schedule/student/my-schedule-page.ts`) links to the editor.

### Stage 91. «На доску» without Холст

- [x] 91.1 **F** `to-board/to-board-dialog.ts`, `board-clipboard.ts`: pick a board of the student / group;
      an Excalidraw board opens with the task / AI result inserted (text + image at the viewport centre);
      an external board — copy to the clipboard and open the link (generic wording, no Холст). Callers:
      `homework/teacher/assignment-dialog.ts`, `assignment-page.ts`, `task-review-page.ts`.

### Stage 92. Docs: no Холст API

- [ ] 92.1 README («Доски» instead of «Доски (Холст)»: Excalidraw boards, external boards by link — Холст as an
      example; new `TEACHERBOX_BOARDS_*` settings), `docs/operations.md` (board copies, restore),
      `docs/glossary.md`, help articles `features/help/articles/{teacher,student}.ts`, `boards/package-info.java`,
      `docs/modules/boards.md`. `rg -i "holst|холст"` leaves only external-link examples and ADR history.

### Stage 93. Release 1.7.0

- [ ] 93.1 Skill `release`: E2E `e2e/tests/version-1-7.spec.ts` (teacher creates a board for a student and a
      group, draws, returns; the student opens «Мои доски» and sees the drawing; teacher
      and student edit at once and see each other's shapes within a poll; the teacher makes a copy, changes the
      board and restores it; an external board opens in a new tab), help, CHANGELOG, version 1.7.0, plan
      archived.

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
- Live board collaboration (WebSocket, cursors), Excalidraw libraries, board templates / duplicating.
- Lesson packages/subscriptions, online payment.
- Telegram login, 2FA for teacher and administrator.
- WhatsApp and e-mail channels.
- AI hints for students with quotas.
