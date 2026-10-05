# boards

Interactive boards (Холст) of students and groups, as links. Depends on: `shared`, `identity::api`. Schema
`boards`. ADR: [0012](../adr/0012-meetings-and-boards.md), [0028](../adr/0028-excalidraw-boards.md) (Excalidraw boards, 1.7.0).

## Rules

- A board belongs to a student or a group; the link is a Холст link (recognised) or any https board link.
- Materials go to a board via the clipboard: the UI copies formatted text and an image (task, AI result) and
  opens the board; automation waits for a Холст server API (Backlog).
- A student sees own boards and the boards of own groups.

## Contract, data, REST

No `api` package. Table `boards`. `/api/teacher/boards/**`, `/api/me/boards`. Bot action: my boards
(`MyBoardsChatAction`).

## Frontend

`features/boards/`: `manage/` (boards dialog), `student/`, `to-board/` (copy to board); via `parts.ts`.
`editor/` — the Excalidraw island (ADR-0028): `excalidraw-island.ts` (the only file importing React and
Excalidraw), `excalidraw-loader.ts` (its only dynamic `import()`, `excalidraw.css`, fonts at `excalidraw-assets/`,
`self-hosted-fonts.ts` drops Excalidraw's CDN font source), `excalidraw-host.ts` (React root, unmounted with
its owner), `board-canvas.ts` (`tb-board-canvas`: inputs `scene`, `theme`; output `sceneChange`; loading and
error states). Tests use `@testing/excalidraw-fake`, never React.
