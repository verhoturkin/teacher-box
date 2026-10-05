# boards

Boards of the portal: our own Excalidraw boards and external boards by link, bound to any number of students and
groups. Depends on: `shared`, `identity::api`. Schema `boards`. ADR: [0028](../adr/0028-excalidraw-boards.md)
(supersedes the boards part of [0012](../adr/0012-meetings-and-boards.md)).

## Rules

- Kinds: `EXCALIDRAW` — scene, images and copies live in the portal; `LINK` — an external board (Холст or any
  other http(s) board): a title and a link. The kind never changes. Boards of 1.4–1.6 (single owner) were deleted
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

No `api` package. Tables `boards`, `board_members`, `board_scenes`, `board_files`, `board_backups`.

| Endpoint | Who |
|---|---|
| `GET /api/teacher/boards?studentId=|groupId=`, `POST`, `PUT /{id}` (with `version`), `DELETE /{id}` | teacher |
| `GET|POST /api/teacher/boards/{id}/backups`, `POST …/{backupId}/restore`, `DELETE …/{backupId}` | teacher |
| `GET /api/boards/{id}`, `PUT|GET /api/boards/{id}/scene`, `PUT|GET /api/boards/{id}/files/{fileId}` | teacher, member student |
| `GET /api/me/boards` (kind, `groupNames`, `updatedAt`, newest first) | student |

Bot action «Мои доски» (`MyBoardsChatAction`): an Excalidraw board → `Portal.link("/cabinet/boards/<id>")`
(skipped without a portal address), an external board → its URL.

## Frontend

`features/boards/`: `manage/` (boards dialog), `student/`, `to-board/` (copy to board); via `parts.ts`.
`editor/` — the Excalidraw island (ADR-0028): `excalidraw-island.ts` (the only file importing React and
Excalidraw), `excalidraw-loader.ts` (its only dynamic `import()`, `excalidraw.css`, fonts at `excalidraw-assets/`,
`self-hosted-fonts.ts` drops Excalidraw's CDN font source), `excalidraw-host.ts` (React root, unmounted with
its owner), `board-canvas.ts` (`tb-board-canvas`: inputs `scene`, `theme`; output `sceneChange`; loading and
error states). Tests use `@testing/excalidraw-fake`, never React.
