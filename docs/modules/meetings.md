# meetings

Video calls of students and groups: external call links (built-in LiveKit rooms come with release 1.8.0). Depends
on: `shared`, `identity::api`. Schema `meetings`. ADRs: [0012](../adr/0012-meetings-and-boards.md),
[0030](../adr/0030-livekit-calls.md).

## Rules

- One external link per student and per group (owner id), any http(s) address the teacher pastes; a lesson's own
  link still wins over it. The Telemost API is gone (ADR-0030): links created through it earlier stay as such links.
- Built-in calls (ADR-0030): port `CallServer` (`application`), adapter `livekit/LiveKitCallServer` over the
  official SDK — tokens signed locally (TTL 10 min, LiveKit refreshes them), `ListRooms`/`ListParticipants` for
  rooms `tb-<ownerId>`, `RemoveParticipant`. On only with `TEACHERBOX_MEETINGS_LIVEKIT_API_KEY/SECRET` (secret ≥ 32
  chars, else startup fails); the backend calls `TEACHERBOX_MEETINGS_LIVEKIT_API_URL`, browsers always
  `<portal>/livekit`. `LiveKitIntegrationCheck` on the admin integrations page.
- Joining (`CallService.join`): the teacher — the room of any current student or active group (as `roomAdmin`); a
  student — their own room and the rooms of their active groups; anything else is 404 `meetings.room-not-found`
  (no hint that a room exists), calls off — 422 `meetings.calls-disabled`. Identity = user id, name = display
  name; the title is the student/group for the teacher, the group or «Урок» for a student.
- Links: `MeetingRooms.links` and `/api/me/meetings/rooms` give the external link or, with calls on and the portal
  address set, `Portal.link("/call/<ownerId>")` for a current student / active group — so lessons, reminders, ICS,
  the bot and «Отправить» (`MeetingLinkShared`) need no change. `CallAccess` removes from occupied rooms a
  deactivated student (`StudentDeactivated`), students removed from a group (`GroupChanged.removedIds`) and everyone
  of an archived group (`GroupArchived`); a failure is logged, not retried.
- «Начать урок» (teacher) opens a Telemost link as `telemost://…` in the app (default on Windows, device setting)
  with «Открыть в браузере» in its split-button menu; students get a plain link.

## Contract (`meetings::api`)

Facade `MeetingRooms.links(ownerIds)` (read-only, used by `schedule`); event `MeetingLinkShared` →
`notifications`. Consumes `identity::api` events `StudentDeactivated`, `GroupChanged`, `GroupArchived`.

## Data, REST, bot

`rooms`. `/api/teacher/meetings/rooms/**` (list, `PUT` a link, delete, share), `/api/me/meetings/rooms`,
`POST /api/meetings/calls/{ownerId}/token` → `{token, room, title}` (teacher and students; the administrator gets 403),
`GET /api/teacher/meetings/calls` → `{status: OK | UNREACHABLE | OFF, rooms: [{ownerId, ownerType, name, members,
waiting, teacherPresent, externalLink}]}` (every current student by name, then active groups; one `ListRooms` +
`ListParticipants` of occupied rooms, outside transactions), `GET /api/me/meetings/calls` → the student's own room
and active groups with `teacherPresent`. Bot action:
join the lesson (`JoinLessonChatAction`).

## Frontend

`features/meetings/`: `call/` — built-in calls: `call-engine.ts` (contract, `CALL_ENGINE` lazily imports
`livekit-engine.ts`, the only file importing `livekit-client`, ESLint), `call-session.ts` (root service: phase,
mode, participants, devices; leaves on sign-out, asks before the page closes), `call-devices.ts` (preview, device
list, choice in `localStorage`), components `call-host` (in `app.ts`), `call-prejoin`, `call-window`, `call-mini`,
`call-tile`, `call-controls`, layout in `call-layout.ts`; `index.ts` exports `CallHost` (root `@defer`) and
`CALL_ROUTES` (`/call/:ownerId`, `openCallGuard`) — never import them from `parts.ts` in the root, it pulls the
help articles into the first load; `home/my-calls-card.ts` (student home). `rooms/` (`room-panel.ts` — the link inside the edit dialog of a student or a group, saved at
once), `settings/` (device setting), `ui/` (start-lesson split button), `telemost.ts` (app/browser opening); embedded
via `parts.ts`.
