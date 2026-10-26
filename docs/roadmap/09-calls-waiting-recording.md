# 09. Calls: «ученик ждёт», history and recording

Status: proposal. Size: L. ADR: yes — «Вебхуки LiveKit и запись уроков», amends ADR-0030.
Covers the Backlog line «Calls after 0.8.0» except chat, PiP and noise suppression.

## Goal

1. The teacher learns at once that a student entered the room (inbox, messenger, push from 07),
   instead of polling `GET /api/teacher/meetings/calls` (`waiting` exists, but only on screen).
2. Call history per student: when, how long, who was there — also a check for attendance marks.
3. Teacher moderation: mute a participant, remove from the room.
4. Optional recording of a lesson that the student can re-watch in «Материалы».

## Current state

- `meetings/livekit/LiveKitCallServer` over the official SDK: tokens, `ListRooms`,
  `ListParticipants`, `RemoveParticipant`. Rooms are `tb-<ownerId>`. LiveKit runs in compose
  (profile `calls`, `livekit/livekit-server:v1.13.7`, inline `LIVEKIT_CONFIG`).
- No webhooks, no egress (recording) container.

## Decisions for the teacher

1. «Ученик ждёт» — after how long without the teacher (proposed: 30 s, so a teacher who is about to
   join is not spammed); only within ±30 min of a scheduled lesson, or always?
2. Recording: wanted at all? Consent: the student (and the parent, 05) must see «Идёт запись»; a
   student under 18 — the teacher confirms they have consent. Retention (30 days?) and disk limit.
3. Who starts recording — only the teacher, per lesson. Automatic recording — no.
4. Transcript and AI summary of a recording — needs a speech-to-text provider (none in the `ai`
   SPI today). Phase 3 or never?

## Design

### Webhooks and waiting

- LiveKit config: `webhook: {api_key: <key>, urls: [http://backend:8080/api/public/meetings/
  livekit/webhook]}` in the inline config of `compose.yaml` (internal network only; nginx must not
  expose this path — add a `location` deny rule and a test in `verify.sh docker`).
- Endpoint verifies the `Authorization` JWT with the SDK's `WebhookReceiver` (API key/secret);
  handles `participant_joined`, `participant_left`, `room_finished`, `egress_ended`.
- `meetings` data: `call_sessions (id, owner_id, started_at, ended_at)`, `call_presence
  (session_id, user_id, joined_at, left_at)`; a session starts with the first participant and
  ends with `room_finished`. Webhooks may be lost or reordered: reconcile with `ListParticipants`
  every minute while a session is open (`CallReconciler`).
- Event `StudentWaiting(ownerId, studentIds, since)` in `meetings::api`, published by a timer when
  a student is present, the teacher is not, and decision 1 holds; once per session.
  `notifications` (`MeetingNotifications`): teacher inbox + messenger «Петя ждёт на уроке» with
  «Подключиться» (`JoinLink`).
- History REST: `GET /api/teacher/meetings/rooms/{ownerId}/sessions?before&limit`; the student's
  own `GET /api/me/meetings/sessions`.

### Moderation

- `POST /api/teacher/meetings/calls/{ownerId}/participants/{userId}/mute` (SDK
  `MutePublishedTrack`) and `…/remove` (`RemoveParticipant`, already wrapped). Frontend: tile menu
  in `meetings/call/call-tile.ts` for the teacher only.

### Recording (by decision 2)

- LiveKit Egress as a separate compose service (`livekit/egress`, profile `recording`): needs Redis
  for LiveKit ↔ egress communication, so the `calls` profile gains a `redis` service and LiveKit
  config `redis:`; egress runs headless Chrome — at least 2 CPU / 2 GB RAM, document it.
- Room composite egress to a file in a shared volume `/data/files/meetings/recordings/`
  (the `meetings` namespace of `FileStorage`), `egress_ended` → `recordings (id, session_id,
  file_key, size, duration, created_at, expires_at)`; nightly cleanup by retention.
- Access: the teacher; the students who were in the session; guardians by 05 rules. Streaming
  download with `Range` support from the backend (`FileResponses` as in homework).
- UI: «Записать» toggle in `call-controls` for the teacher, a red «Идёт запись» chip for everyone,
  recordings list in the lesson card and in the student's «Материалы».

## Stages

- [ ] **A.1** (B, D) ADR; webhook endpoint with signature check, nginx deny, compose config;
  tests with a signed sample payload; `docs/operations.md`.
- [ ] **A.2** (B) Sessions and presence, reconciler, `StudentWaiting` timer, notifications texts;
  tests with a fake `CallServer` and a fixed `Clock`.
- [ ] **A.3** (F) Call history block on the student card «Занятия» tab and the lesson card;
  «Ученик ждёт» banner on Today with «Подключиться».
- [ ] **B.1** (B, F) Moderation endpoints + tile menu; role tests (student 403).
- [ ] **C.1** (D) Egress + Redis in compose under a profile, installer prompt («Запись уроков?»),
  resource notes; `docker compose config` check in `verify.sh docker`.
- [ ] **C.2** (B) Start / stop recording, `egress_ended` handling, recordings storage, retention,
  access tests, range download.
- [ ] **C.3** (F) Recording controls, consent text, recordings in lesson card and «Материалы».
- [ ] **D.1** Docs: `docs/modules/meetings.md`, wiki «Звонки», FAQ (privacy of recordings), help
  ru/en; E2E: webhook simulation → inbox notice; history row after a fake session.

## Risks and out of scope

- Egress is heavy for a small VPS — recording must stay optional and off by default.
- Recordings are personal data of minors: retention and access rules belong in the ADR and the
  wiki, and backups must exclude recordings (SPI `shared.backup.BackupExclusions`) or they blow the
  archive size.
- Chat in the call, Document PiP, opening the student's board from the call — stay in Backlog.
