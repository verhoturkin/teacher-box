# meetings

Video calls of students and groups: external call links (built-in LiveKit rooms come with release 1.8.0). Depends
on: `shared`, `identity::api`. Schema `meetings`. ADRs: [0012](../adr/0012-meetings-and-boards.md),
[0030](../adr/0030-livekit-calls.md).

## Rules

- One external link per student and per group (owner id), any http(s) address the teacher pastes; a lesson's own
  link still wins over it. The Telemost API is gone (ADR-0030): links created through it earlier stay as such links.
- «Начать урок» (teacher) opens a Telemost link as `telemost://…` in the app (default on Windows, device setting)
  with «Открыть в браузере» in its split-button menu; students get a plain link.

## Contract (`meetings::api`)

Facade `MeetingRooms.links(ownerIds)` (read-only, used by `schedule`); event `MeetingLinkShared` →
`notifications`.

## Data, REST, bot

`rooms`. `/api/teacher/meetings/rooms/**` (list, `PUT` a link, delete, share), `/api/me/meetings/rooms`. Bot action:
join the lesson (`JoinLessonChatAction`).

## Frontend

`features/meetings/`: `rooms/` (`room-panel.ts` — the link inside the edit dialog of a student or a group, saved at
once), `settings/` (device setting), `ui/` (start-lesson split button), `telemost.ts` (app/browser opening); embedded
via `parts.ts`.
