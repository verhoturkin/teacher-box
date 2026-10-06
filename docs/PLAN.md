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

## v1.7.3

Goals: the administrator's settings page follows the design system; student and group cards are compact and
easier to scan, on a phone too.

### Stage 99. Admin settings page by the design system

- [x] 99.1 **B F** Sections of `SettingsCatalog` get a `section` key; `admin/settings/settings-page.ts` — sections
  fold (`tb-fold-card`, `?open=`, badge of unsaved changes), full-width stack, M3 outlined fields (label on the
  outline, variable and source under the field), Docker and accounts as a segmented `tb-list`.

### Stage 100. Compact student and group cards

- [x] 100.1 **F** `identity/students/students-page.ts` — the student card drops «Группы» and «Доски» (groups are in
  the panel below, boards in «Доски»); `tb-cards--wide` in `styles.scss` — the name on top, the fields side by side
  under it (label above the value, wrapping), actions top right on a computer and after the fields on a phone;
  `groups-panel.ts` — «Ученики» as `tb-cell-long`. Help «Ученики», design system §9, `boards.md`.
- [x] 100.2 **F** Closed cards show only the main line — a student's name and phone, a group's name and members;
  the rest and the actions open with «Подробнее» (`shared/ui/open-cards.ts`, `td.tb-card-actions` labelled text
  buttons). `students-page.ts`, `groups-panel.ts`, `styles.scss`, help «Ученики» / «Группы», E2E 1.2 and 1.6.8.
- [x] 100.4 **F** Students and groups are a `tb-list` (100.1–100.2 replaced): a student — name + phone, the status
  and «⋮» (Изменить, Сбросить пароль / Новое приглашение, Отключить / Вернуть доступ); login and note in the
  tooltip of the name. A group — name + members, «В архиве» and «⋮» (Изменить, В архив / Вернуть); no boards on
  either. The edit dialogs hold the login (read-only) and the room — `meetings/rooms/room-panel.ts` replaces
  `room-dialog.ts` and `room-cell.ts`; `tb-cards--wide`, `OpenCards`, `BoardsLink`, `MemberBoards` removed.
  ADR-0018/0021 notes, design system §9, help, E2E 1.2, 1.4, 1.5.3, 1.6.8.
- [x] 100.3 **F** `identity/students/invite-link-dialog.ts` by the design system: the link is a full-width outlined
  field, «Закрыть» and «Копировать ссылку» (filled green) in the footer, initial focus on the title.

## v1.8.0

Goals: video calls inside the portal on a self-hosted LiveKit server — one-to-one and group. Every current
student and every active group has a fixed built-in room used by default; the teacher gets a «Звонки» section
(room cards with status and «Войти»); the call window can be expanded or minimized to a floating mini window
while the teacher keeps working (boards included). The Yandex Telemost API integration is removed; an external
call link for a student/group and for a lesson stays as it is. Call history is out of scope.

ADRs: **new 0030** «Встроенные видеозвонки на LiveKit» (replaces the Telemost part of 0012: server, room names,
tokens, link precedence, delivery, Permissions-Policy/CSP); 0012 gets «Заменено частично: ADR-0030».

Decisions taken in this plan (change them here before stage 102 if needed):
- Module stays `meetings` (rooms are its subject); settings `TEACHERBOX_MEETINGS_LIVEKIT_*`.
- LiveKit room name `tb-<ownerId>`; rooms are not stored — LiveKit creates them on the first join
  (`auto_create`) and closes empty ones (`empty_timeout`). The `rooms` table keeps only external links.
- Link precedence: lesson link → external link of the student/group → built-in room. Existing links (incl.
  Telemost meetings created by the API) migrate as external links; the teacher deletes one to switch to the
  built-in room (CHANGELOG, help).
- A built-in room's link is an absolute portal link `Portal.link("/call/<ownerId>")`, so reminders, ICS, the
  bot and `MeetingLinkShared` keep working with plain URLs; the SPA recognises it and opens the call in place.
- Calls are enabled when the API key and secret are set; otherwise built-in rooms are off and the UI explains
  how to enable them. Students may enter their room any time; the teacher sees who is waiting.
- Opening Telemost links in the desktop app (device setting) stays — it is not the API.

### Stage 101. LiveKit spike and ADR-0030

- [x] 101.1 **B F D** Throw-away spike (not committed except docs): `livekit/livekit-server` (pinned tag) next to
  `compose.split.yaml`; check (a) `io.livekit:livekit-server` on Java 25 / Spring Boot 4.1 — dependency tree
  (Kotlin stdlib, OkHttp, Retrofit, protobuf) without conflicts, Modulith/JaCoCo unaffected, `AccessToken` +
  `RoomServiceClient.listRooms/listParticipants/removeParticipant` work; (b) `livekit-client` connects through
  the portal origin with a sub-path (`wss://<portal>/livekit` → `/livekit/rtc`) via nginx; (c) size of the
  lazily loaded `livekit-client` chunk (initial budget 700 kB must not change); (d) media with UDP mux 7882 and
  TCP 7881 fallback, embedded TURN/UDP 3478 behind NAT. Write ADR-0030 (Russian) with the results and the
  rejected options (Jitsi, mediasoup, LiveKit Cloud only, keeping Telemost API), row in `docs/adr/README.md`,
  status line in ADR-0012.
  *Done: SDK 0.16.0 works against `livekit-server` 1.13 (create/list rooms, participants, tokens, 401 on a wrong
  secret); it needs OkHttp 5 — aligned by `okhttp-bom` (Anthropic client tests green), the dependency goes in
  with 104.1. Sub-path confirmed in `livekit-client` 2.22 sources (`appendUrlPath`); the chunk size and media
  through nginx are checked in 105.1 and the E2E of 107.1.*

### Stage 102. Remove the Telemost API

- [ ] 102.1 **B** Delete `meetings/application/{YandexService,TelemostApi,TelemostAuthException,TelemostException,
  TelemostIntegrationCheck}`, `web/PublicYandexController`, `persistence/YandexRepository`,
  `domain/{YandexConnection,YandexStatus,RoomSource}`, `/api/teacher/meetings/yandex/**` and
  `POST /api/teacher/meetings/rooms`; `MeetingsProperties` loses `yandex`/`telemost`; `Room` loses
  `conferenceId`/`source`. Migration `db/migration/meetings/V2__drop_telemost_api.sql`: drop
  `yandex_connection`, `yandex_oauth_states`, columns `conference_id`, `source` (rows stay as external links).
  `MeetingsDataReset`, public path of the callback in security config, `SettingsCatalog` group «Видеовстречи»
  (Telemost variables), `.env.example`, README «Видеовстречи» (Yandex part), `e2e/compose.e2e.yaml` and the
  Telemost stub of the fake server; tests (`TelemostApiTest`, `MeetingsIntegrationTest(s)`) adjusted.
- [ ] 102.2 **F** `features/meetings/settings/meetings-settings-panel.ts` — only the device setting (Telemost app);
  `rooms/room-panel.ts` — external link + «Отправить» only (no «Создать встречу в Телемосте»);
  `data-access/meetings.models.ts`/`meetings-api.ts` without Yandex; `core/http/error-messages.ts` drops
  `meetings.reconnect`/`telemost-failed`; `testing/meetings-fixtures.ts`, specs.

### Stage 103. LiveKit server in delivery

- [ ] 103.1 **D** `docker/livekit/livekit.yaml` (port 7880, `rtc.tcp_port` 7881, `rtc.udp_port` 7882 mux,
  `use_external_ip` / `node_ip` from `TEACHERBOX_LIVEKIT_NODE_IP`, `turn` UDP 3478, `room.empty_timeout`,
  `max_participants`, no webhooks); service `livekit` (pinned image, profile `calls`, memory/cpu limits,
  `LIVEKIT_KEYS` built from `TEACHERBOX_MEETINGS_LIVEKIT_API_KEY/SECRET`) in `compose.split.yaml` and
  `compose.single.yaml`. `docker/nginx/default.conf.template`: `location /livekit/` → `livekit:7880` with
  `Upgrade`/`Connection`, long timeouts, upstream resolved lazily (`resolver 127.0.0.11` + variable) so nginx
  starts without the profile. Permissions-Policy `camera=(self), microphone=(self), display-capture=(self)` in
  `docker/nginx/security-headers.conf` and `PlatformSecurityAutoConfiguration.PERMISSIONS_POLICY` (+ test);
  CSP `connect-src` gets the LiveKit origin only when `TEACHERBOX_MEETINGS_LIVEKIT_URL` is another host.
  `scripts/verify.sh docker` checks `config` with and without the profile.
- [ ] 103.2 **D** `docs/operations.md` (Russian): enabling calls (`COMPOSE_PROFILES=calls`, key/secret
  generation, secret ≥ 32 chars), ports to open (7881/tcp, 7882/udp, 3478/udp), public IP, own reverse proxy
  rules for `/livekit/` (nginx and Caddy snippets; required for the single variant, which has no nginx),
  external LiveKit (Cloud or another host), troubleshooting (no video behind a firewall → TURN).

### Stage 104. Built-in rooms — backend

- [ ] 104.1 **B** Skill `new-setting`: `TEACHERBOX_MEETINGS_LIVEKIT_URL` (address for browsers, default
  `<portal>/livekit`), `_API_URL` (backend → LiveKit, default `http://livekit:7880`), `_API_KEY`, `_API_SECRET`
  (secret); `SettingsCatalog` group «Видеозвонки». Adapter `meetings/livekit/LiveKitGateway` (tokens,
  `listRooms`, `listParticipants`, `removeParticipant`; timeouts, network calls outside transactions, no
  personal data in logs) and `LiveKitIntegrationCheck` for the admin integrations page; gateway tests against
  a local HTTP stub (Twirp + protobuf JSON).
- [ ] 104.2 **B** Join — controller test with roles first: `POST /api/meetings/calls/{ownerId}/token` →
  `{serverUrl, token, roomTitle}`; `CallService.join(user, ownerId)`: teacher — any current student / active
  group, student — self or own groups (otherwise 404, «another student gets 404» test), admin — 403, calls off —
  409 `meetings.calls-disabled`. Token: identity = user id, name = display name, room `tb-<ownerId>`, teacher
  `roomAdmin`, student publish camera/microphone/screen share, short TTL.
- [ ] 104.3 **B** Status: `GET /api/teacher/meetings/calls` — a card for every current student and active group:
  owner, name, members count, participants in the room (names, teacher present), external link flag; one
  `listRooms` + `listParticipants` for non-empty rooms; LiveKit unreachable → `status: UNKNOWN`, list still
  returned. `GET /api/me/meetings/rooms` (`MyRoomView`) gets the call owner id and «teacher is in the room».
- [ ] 104.4 **B** Links and access: `RoomService.links` (`MeetingRooms`) → external link, else
  `Portal.link("/call/<ownerId>")` when calls are on; `share` works without an external link (sends the portal
  link); `JoinLessonChatAction` texts. Listeners of `StudentDeactivated`, `GroupChanged` (removed members),
  `GroupArchived` remove the affected participants from LiveKit (`removeParticipant`). Update
  `docs/modules/meetings.md` (rules, contract, REST) and the `joinUrl` line in `docs/modules/schedule.md`.

### Stage 105. Call window — frontend

- [ ] 105.1 **F** `npx -y npm@11 install livekit-client` (Apache-2.0, ADR-0007). `features/meetings/call/`:
  `CallEngine` (thin wrapper over `livekit-client`, loaded with dynamic `import()`, faked in specs) and
  `CallSession` (root service, signals: `idle | prejoin | connecting | connected | reconnecting | ended |
  error`, participants, tracks, active speaker, devices, mode `expanded | minimized`); one call at a time
  (switching asks), leave on logout, `beforeunload` prompt while connected; error codes in
  `core/http/error-messages.ts`.
- [ ] 105.2 **F** Pre-join sheet: camera preview, mic level, toggles and device pickers (choice remembered on the
  device), states for denied permission / no devices / unsupported browser (ADR-0025); «Войти» enters.
- [ ] 105.3 **F** Expanded view: stage + tiles (1 remote — full stage with self-view inset, 2–4 — grid, more —
  grid with paging), screen share on the stage, active speaker outline, name/muted/connection-quality badges;
  M3 Expressive floating toolbar (mic, camera, screen share, devices menu, «Свернуть», «Выйти» in error colour,
  ADR-0026); phone — bottom toolbar, safe areas, portrait/landscape. Theme tokens only (light/dark follow the
  portal/system theme), a11y (ADR-0024): `aria-pressed`, live region for joins/leaves, keyboard-reachable
  tiles. New section «Call window» in `docs/design-system.md`; terms in `docs/glossary.md` (звонок, комната,
  войти в звонок, свернуть/развернуть, демонстрация экрана).
- [ ] 105.4 **F** Minimized: `CallHost` mounted in the root `app.ts` (via `@features/meetings/parts`) so the call
  survives navigation between layouts and the full-screen board routes (`teacher/boards/:id`,
  `cabinet/boards/:id`); desktop — floating mini window (active speaker video, mic, «Развернуть», «Выйти»),
  draggable and keyboard-movable, snaps to corners, position remembered on the device, avoids FABs; phone — a
  compact bar above the bottom navigation. Video tracks of hidden tiles are unsubscribed (adaptive stream).
- [ ] 105.5 **F** Entry points: route `/call/:ownerId` (links from notifications, ICS, bot) — guard opens the
  call for the role and redirects home; `ui/join-lesson-button.ts` opens a portal call link in place (external
  and Telemost links as before); student home — «Видеозвонок» card with their own and group rooms
  (`/api/me/meetings/rooms`), «Учитель уже в звонке» hint.

### Stage 106. Teacher «Звонки» section

- [ ] 106.1 **F** Route `/teacher/calls` (`features/meetings/calls/calls-page.ts`), menu item «Звонки»
  (`pi pi-video`) in `core/layout/teacher-layout.ts` and the mobile navigation (ADR-0027). Simple cards in a
  `tb-list` (ADR-0020): left — avatar and name of the student or group (members count), status «Пусто» /
  «В звонке: …» / «Ждут: N» (status colours ADR-0023); right — «Войти» (filled when someone waits) or
  «Вы в звонке» for the current one; an external link is noted. Refresh every 10 s while the page is visible;
  states: calls off (how to enable, link to help), LiveKit unreachable, no students.
- [ ] 106.2 **F** `meetings/rooms/room-panel.ts` (in the student and group edit dialogs) shows «Встроенная
  комната» or the external link, sets/removes the external link and sends the link;
  `MeetingsSettingsPanel` → «Видеозвонки»: LiveKit status (configured, reachable) + the Telemost-app device
  setting.

### Stage 107. Release 1.8.0

- [ ] 107.1 Skill `release`: help articles (teacher «Звонки», student «Как войти в урок», removed Telemost
  connection), README «Видеозвонки» rewritten, E2E `version-1-8-0.spec.ts` — `livekit-server --dev` in the E2E
  compose, Chromium with fake media; teacher and student join one room and see each other, minimize/expand,
  navigation keeps the call, room status on «Звонки»; CHANGELOG (migration of old links, how to enable),
  version bump, archive.

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

Calls after 1.8.0: call history; teacher moderation (mute / remove a participant); chat in the call;
«ученик ждёт» notification (LiveKit webhooks); opening the student's board from the call; Document
Picture-in-Picture; noise suppression; recording.

Future:
- Two-way Google Calendar sync.
- Board templates / duplicating.
- Lesson packages/subscriptions, online payment.
- Telegram login, 2FA for teacher and administrator.
- WhatsApp and e-mail channels.
- AI hints for students with quotas.
