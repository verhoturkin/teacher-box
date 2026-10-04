# boards

Interactive boards (Холст) of students and groups, as links. Depends on: `shared`, `identity::api`. Schema
`boards`. ADR: [0012](../adr/0012-meetings-and-boards.md).

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
