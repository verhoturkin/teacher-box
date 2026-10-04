# meetings

Permanent Yandex Telemost rooms for students and groups. Depends on: `shared`, `identity::api`. Schema
`meetings`. ADR: [0012](../adr/0012-meetings-and-boards.md).

## Rules

- One permanent room per student and per group (owner id); a lesson's own link still wins over the room.
- Two modes: with Yandex connected, rooms are created by API (`POST /conferences`, waiting room `PUBLIC` /
  `ADMINS` — teacher setting); without it the teacher pastes any https video link.
- Yandex connection — OAuth authorization code with the teacher's Yandex ID app (client id/secret in UI or
  `TEACHERBOX_MEETINGS_YANDEX_CLIENT_ID/SECRET`), redirect `Portal.link("/api/public/meetings/yandex/callback")`,
  one-time `state`, token per `device_id` (revocable). `TEACHERBOX_MEETINGS_TELEMOST_TOKEN` overrides (tests,
  E2E). No proxy needed.
- «Начать урок» (teacher) opens `telemost://…` in the app (default on Windows, device setting) with «Открыть
  в браузере» in its split-button menu; students get a plain link.
- `TelemostIntegrationCheck`: requesting a missing meeting → 404 means the token works, 401/403 → reconnect.

## Contract (`meetings::api`)

Facade `MeetingRooms.links(ownerIds)` (read-only, used by `schedule`); event `MeetingLinkShared` →
`notifications`.

## Data, REST, bot

`rooms`, `yandex_connection`, `yandex_oauth_states`. `/api/teacher/meetings/**` (rooms, share, yandex),
`/api/me/meetings/rooms`, public Yandex callback. Bot action: join the lesson (`JoinLessonChatAction`).

## Frontend

`features/meetings/`: `rooms/`, `settings/` (Yandex connection), `ui/` (start-lesson split button),
`telemost.ts` (app/browser opening); embedded via `parts.ts`.
