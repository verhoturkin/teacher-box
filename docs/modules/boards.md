# boards

Boards of the portal: our own Excalidraw boards and external boards by link, bound to any number of students and
groups. Depends on: `shared`, `identity::api`. Schema `boards`. ADR: [0028](../adr/0028-excalidraw-boards.md)
(supersedes the boards part of [0012](../adr/0012-meetings-and-boards.md)), [0029](../adr/0029-live-boards.md) (real time).

## Rules

- Kinds: `EXCALIDRAW` — scene, images and copies live in the portal; `LINK` — an external board (Холст or any
  other http(s) board): a title and a link. The kind never changes. Boards of 0.4–0.6 (single owner) were deleted
  by `V2`.
- Members: any number of students and groups (`board_members`). New members must be current students and active
  groups; members the board already has stay when they leave.
- Access (`BoardService.requireAccess`): the teacher — every board; a student — a board they are a member of
  directly or through a current group (always edit); anyone else — 404. `ADMIN` has no access (`/api/**`).
- Scene save: `PUT /api/boards/{id}/scene` merges per element id (`SceneElements.merge`: a higher `version` wins,
  same version — the lower `versionNonce`, like Excalidraw's `reconcileElements`); deleted elements stay as
  tombstones; only `viewBackgroundColor`, `gridSize`, `gridStep`, `gridModeEnabled` of `appState` are kept. The
  scene row is locked (`for update`), `scene_version` grows only when something changed. Elements ≤ 5 M chars
  (`boards.scene-too-large`).
- Polling: `GET /api/boards/{id}/scene?since=<version>` → 204 while unchanged. An external board has no scene →
  409 `boards.no-scene`.
- Live channel (ADR-0029): `POST /api/boards/{id}/live` → `{ticket}` (after `requireAccess`, Excalidraw boards
  only; one-time, 1 min, kept in memory as a hash — `LiveTickets`), then a WebSocket to
  `/api/public/boards/live?ticket=` (no ticket, a used or expired one → 403). `live/LiveRooms` keeps the editors of
  each board in memory (one instance): a peer has an id, the user's name and the smallest free colour index;
  `welcome` / `joined` / `left`; relays `pointer` (x, y, tool, button — checked) and `elements` (checked by
  `SceneElements.valid`) to the others; answers `ping` with `pong`; sends `saved` with the version after a scene
  save or a restored copy (`SceneSaved`, after commit). Nothing is stored. Access is checked again
  (`BoardService.mayAccess`) when the board changes or is deleted (`BoardAccessChanged`), a group changes or is
  archived; a deactivated student's channels close — closed with 1008. Messages ≤ 1 M characters; a slow
  receiver loses old messages (the scene still comes by save and poll).
- Images: `PUT|GET /api/boards/{id}/files/{fileId}` — raw body, png/jpeg/webp/gif checked by magic bytes (no SVG),
  ≤ 20 MB; stored once per `fileId` in the `boards` namespace of `FileStorage` (keys in `board_files`; a namespace
  cannot have sub-folders, so not `boards/<boardId>/`); served `private, max-age=1y, immutable`, `nosniff`.
- Copies: `DAILY` by `BoardBackupJob` (`TEACHERBOX_BOARDS_BACKUP_CRON`, default `0 0 3 * * *`, instance time zone)
  for every scene whose version is above its last daily copy; the newest `TEACHERBOX_BOARDS_BACKUP_KEEP` (7) daily
  copies stay. `MANUAL` — the teacher's, ≤ 20 per board. Restore saves the current scene as a `MANUAL` copy first,
  then puts the copy back with versions above the current ones and tombstones for the rest
  (`SceneElements.restored`), so open editors take it on their next poll.
- An image stays while the scene or any copy refers to it (tombstones included); unreferenced images older than a
  day are deleted after a copy is made or deleted. Deleting a board deletes its scene, copies and images.
- Scenes, copies and images are part of the portal backup (`platform`); the full reset clears every table and the
  platform deletes the files.

## Contract, data, REST

No `api` package. Tables `boards`, `board_members`, `board_scenes`, `board_files`, `board_backups`, `board_libraries` (the
Excalidraw library of each user, `user_id` → items JSON, up to 2 000 000 characters; `boards.library-invalid`,
`boards.library-too-large`).

| Endpoint | Who |
|---|---|
| `GET /api/teacher/boards?studentId=|groupId=`, `POST`, `PUT /{id}` (with `version`), `DELETE /{id}` | teacher |
| `GET|POST /api/teacher/boards/{id}/backups`, `POST …/{backupId}/restore`, `DELETE …/{backupId}` | teacher |
| `GET /api/boards/{id}`, `PUT|GET /api/boards/{id}/scene`, `PUT|GET /api/boards/{id}/files/{fileId}`, `POST /api/boards/{id}/live` | teacher, member student |
| WebSocket `/api/public/boards/live?ticket=` | holder of a ticket |
| `GET|PUT /api/boards/library` — the current user's own library (an array of items with `id` and `elements`) | teacher, student |
| `GET /api/me/boards` (kind, `groupNames`, `updatedAt`, newest first) | student |

Bot action «Мои доски» (`MyBoardsChatAction`): an Excalidraw board → `Portal.link("/cabinet/boards/<id>")`
(skipped without a portal address), an external board → its URL.

## Frontend

`features/boards/` (pages in `index.ts`, widgets in `parts.ts`):

- `teacher/boards-page.ts` — «Доски» (`/teacher/boards`, menu item after «Оплаты», under «Ещё» on a phone): all boards;
  a URL filter (`?student=`, `?group=`; a student's filter includes their groups' boards; since 0.7.3 the
  students page links no boards) — no filter control, a line «Доски ученика: …» / «Доски группы: …» with «Все доски»; a new board starts
  with the filter's member. Since 0.9.3 a `tb-list` like «Ученики» (kind icon; title link + «вид · кому · изменена»;
  trail — «⋮» only): «Резервные копии» (Excalidraw only), «Изменить», «Удалить…»
  (`dangerConfirmation`). `board-dialog.ts` — kind (only when created), title, link (external), students, groups;
  members that left stay. `board-backups-dialog.ts` — copies: «Сделать копию», «Восстановить» / delete with a
  confirmation step inside the dialog (no dialog on top).
- `student/my-boards-page.ts` — «Мои доски» (`/cabinet/boards`, the student's sixth section since 0.10.0 — under «Ещё» on a
  phone); `my-boards-card.ts` — the latest three on the student's home; `my-board-list.ts`.
- `manage/` — `BoardLinks` — the boards of a lesson (lesson dialog, «Следующее занятие»).
- `editor/` — the Excalidraw island (ADR-0028): `excalidraw-island.ts` (the only file importing React and
  Excalidraw: `Excalidraw`, `MainMenu`, `reconcileElements`, `convertToExcalidrawElements`), `excalidraw-loader.ts`
  (its only dynamic `import()`, `excalidraw.css`, fonts at `excalidraw-assets/`, `self-hosted-fonts.ts` drops
  Excalidraw's CDN font source), `excalidraw-host.ts` (React root, unmounted with its owner), `board-canvas.ts`
  (`tb-board-canvas`: inputs `scene`, `theme`, `menu`, `settings`, `wheel`, `library`; outputs `sceneChange`, `ready` with
  the API; loading and error states; no file load/save, no Excalidraw theme switch, no embeds). In the `zoom` wheel mode
  a plain wheel over the canvas is handed to Excalidraw again as Ctrl + wheel (lines and pages turned into pixels);
  Ctrl, ⌘ and Shift keep Excalidraw's meaning.
  - `board-page.ts` — routes `/teacher/boards/:id`, `/cabinet/boards/:id` outside the shell (full screen, same
    guards, `canLeaveGuard`): bar «← Доски» / «← Мои доски», title, save status «Сохранено» / «Сохранение…» /
    «Нет связи — повторим»; menu «Вернуться к доскам» (+ the teacher's «Резервные копии» — only there), then
    Excalidraw's items, then the settings: «Тема» («Светлая» / «Тёмная» / «Как в системе» — the portal's own
    `ThemeMode`), «Сетка» (the board's `gridModeEnabled`, shared and saved), «Колесо мыши» («Масштаб» by default /
    «Прокрутка (тачпад)», device setting `tb.board.wheel`); `ru-RU`. An external board shows only its link. Leaving with unsaved changes asks first.
  - `board-sync.ts` — saves the changed elements 1 s after the last change (and on leaving, on a hidden tab),
    applies the merged answer with `reconcileElements` (`captureUpdate: NEVER`), polls `?since=` every 5 s while the
    tab is visible and nothing is being saved (every 30 s while the live channel is open), retries a failed save
    every 5 s, uploads new images once and fetches missing ones. Shapes still too small to see (no size, a line
    with one point) never leave the editor — Excalidraw drops them without a tombstone. With the live channel it
    sends the elements changed here 100 ms after a change (each version once; a closed channel leaves them to the
    save), merges the others' elements without saving them again, and polls when `saved` brings a newer version.
    `excalidraw-data.ts` — guards for server JSON, shared appState, data URLs, `isSyncable`.
  - `board-live.ts` — `BoardLive` (ADR-0029): ticket (`BoardsApi.liveTicket`), socket (`LIVE_SOCKET`, a fake in
    tests), the others (`peers`, with cursors), the cursor out at most every 50 ms, `ping` every 30 s, reconnects
    after 1, 2, 5, 10, 30 s (not after 1008 — the board was taken away). `board-presence.ts` — the others as
    Excalidraw collaborators (name, colour by the server's number, cursor); `board-page.ts` puts them into the scene,
    `tb-board-canvas` gets `collaborating` (`isCollaborating`) and reports `pointerMove` (`onPointerUpdate`).
  - Library: the island's `Excalidraw` wraps Excalidraw with `useHandleLibrary` and a `BoardLibrary` adapter
    (`board-page.ts` → `GET|PUT /api/boards/library`); library URLs (`#addLibrary`) are refused and
    «Просмотреть библиотеки» is hidden — libraries.excalidraw.com is outside the CSP (ADR-0028); a
    `.excalidrawlib` file opens via «Открыть».
  - Global `styles.scss`: the Cyrillic range of Excalidraw's `Assistant` font comes from system sans-serif fonts;
    Excalidraw's UI variables (primary, surfaces, text, outlines, danger) come from the portal's `--p-md-*` roles
    in both themes; the canvas background stays the board's.
- `to-board/` — «На доску» (assignment dialog and page, task review): an Excalidraw board opens in a new tab with
  the material inserted at the view centre (`BoardInsert` hands it over in `localStorage` for 2 min,
  `editor/material-insert.ts` adds a text or a picture element); an external board gets it via the clipboard
  (`board-clipboard.ts`) and opens by its link. Pages of a textbook (ADR-0033, `PagesMaterial`: a frame name and
  API addresses of page pictures, only `/api/…` accepted from the storage; `ToBoardDialog [pages]` lists only
  Excalidraw boards and projects the page field of `textbooks`) — the editor fetches the pictures
  (`BoardsApi.picture`), puts them in a row (150 dpi pictures at half size, 24 px apart, tops aligned, centred on the
  view) inside a frame with 40 px padding named after the textbook and its pages.

Tests use `@testing/excalidraw-fake` (`fakeExcalidraw`, `fakeScene`, `anElement`), never React.
