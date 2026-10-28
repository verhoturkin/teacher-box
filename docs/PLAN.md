# Teacher Box plan

Active plan only, in English. Completed releases — [`archive/plans/`](archive/plans/README.md);
don't read them unless the task needs history.

## How to use

- A release is a `## vX.Y.Z` section (or `## Next release` until the number is known): goals (2–5
  lines), new/changed ADRs, then stages.
- Stages are numbered globally, continuing from the archive. Substeps: `85.1`, `85.2`, … Tags: **B**
  backend, **F** frontend, **D** docker/infra.
- A substep names its entry points — files, classes, endpoints, routes
  (`schedule/teacher/lesson-details-dialog.ts`, `ScheduleService.cancel`) — so the work starts there
  instead of a repository search.
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next
  release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to
  Backlog. This file keeps only unreleased work and the Backlog.

## v0.38.0 — installable app and web push (stages 312–317)

Goal (roadmap 07): the portal installs on a phone or a computer as an app (icon, own window), and
notifications arrive as system push notifications in the browser without Telegram / VK / MAX. ADR
0051 «Установка портала и web-push» (service worker caching rules, VAPID keys, push as a delivery
channel). Branched from `feat/lesson-notes` (PR #110, 0.37.1, not merged yet), so stage numbers
continue from 311; merge `origin/main` into the branch once #110 lands.

Decisions of the teacher (2026-10-28, proposed defaults taken): push for the teacher too; push goes
in addition to messengers, switchable per device in «Мой аккаунт»; offline — only an «Нет связи»
page and the cached app shell, data stays online.

Design:

- Service worker: Angular `@angular/service-worker` (`ngsw`, standalone `provideServiceWorker` in
  the zoneless app — check the Angular 21 docs via context7 first). `ngsw-config.json`: prefetch
  the app shell, lazy assets; **no data groups for `/api/**`** (personal data is never cached);
  `navigationUrls` exclude `/api/**`, `/livekit/**` (and `/pay/**` if roadmap 04 lands). Update
  flow: `SwUpdate.versionUpdates` → snackbar «Доступна новая версия — Обновить». nginx
  (`docker/nginx/default.conf.template`): `ngsw.json` and `ngsw-worker.js` with
  `Cache-Control: no-cache`; CSP `worker-src 'self'` in `security-headers.conf`.
- The web manifest already exists (`/api/public/portal/manifest.webmanifest`, `platform/portal`).
- Push protocol: Web Push (RFC 8030) + VAPID (RFC 8292) + payload encryption (RFC 8291), implemented
  with JDK crypto (P-256 ECDH, HKDF-SHA256, AES-128-GCM, ES256 JWT) in `notifications/webpush/`, no
  BouncyCastle (or a maintained, permissively licensed library if one exists for Java 25). RFC 8291
  appendix vectors as unit tests.
- VAPID keys generated on first start, private key write-only, in the backup (a restored portal
  keeps its subscriptions working). `notifications.channel_settings` has a `channel` check
  constraint for TELEGRAM / VK / MAX — extend it by migration or use a dedicated table. Optional
  env `TEACHERBOX_NOTIFICATIONS_WEBPUSH_SUBJECT` (`mailto:` or the portal URL), skill `new-setting`.
- Data: `push_subscriptions (id, user_id, endpoint varchar(1000) unique, p256dh, auth, user_agent
  varchar(200), language, created_at, last_success_at, failures)`.
- Delivery: `ChannelType.WEB_PUSH`; a `PushChannel` that fits the outbox `DeliveryDispatcher` (one
  delivery per subscription); 404/410 from the push service → delete the subscription; 429/5xx →
  backoff. Payload: title, body, URL (`Portal.link`), tag (collapses repeats), nothing beyond what
  the inbox record shows. Push services are third parties (Google FCM, Mozilla, Apple) — the ADR
  and the wiki say so; the payload is end-to-end encrypted. `ngsw` handles push itself (`SwPush`),
  so the payload uses its format `{notification: {...}}` and `onActionClick`.
- Frontend `core/push/`: the permission is requested only from a user gesture («Включить
  уведомления на этом устройстве» in «Мой аккаунт» and an onboarding card on the home); the list of
  the user's devices with «Отключить». iOS: push only for an installed app (16.4+) — show «Добавьте
  на экран Домой» when `navigator.standalone` is false on iOS.
- REST: `GET /api/me/push/key` (public VAPID key), `GET|POST /api/me/push/subscriptions`,
  `DELETE /api/me/push/subscriptions/{id}` (another user's id → 404). Admin: only the count of
  subscriptions and failures (IDs, no endpoints).
- Risks: push needs HTTPS and a public address (a LAN-IP portal gets the install banner only); a
  stale app after an update — the update snackbar and `no-cache` on `ngsw.json` are mandatory, with
  an E2E that a new build is picked up. Native apps (Capacitor) — out of scope.

### Stage 312 — Service worker and installable app (F, D, `m3-expressive`)

- [ ] 312.1 F, D: `@angular/service-worker` + `ngsw-config.json` + `provideServiceWorker`
  (`frontend/src/app/app.config.ts`, enabled in production only), update snackbar service (e.g.
  `core/pwa/`, `SwUpdate`), offline page «Нет связи» (`core/pages/`), nginx `no-cache` for
  `ngsw.json` / `ngsw-worker.js` and CSP `worker-src 'self'` (`docker/nginx`). Unit tests of the
  update service; `docker compose config` check. Manual: Chrome install, Android install.

### Stage 313 — Web Push core (B)

- [ ] 313.1 B: ADR 0051 (+ row in `docs/adr/README.md`); `notifications/webpush/` — VAPID key
  generation and storage, RFC 8291 encryption, RFC 8292 JWT, a sender over the JDK `HttpClient`;
  RFC test vectors as unit tests; setting `TEACHERBOX_NOTIFICATIONS_WEBPUSH_SUBJECT`
  (`.env.example`, `SettingsCatalog`, wiki; skill `new-setting`); keys included in the backup
  (`BackupExclusions` / restore test).

### Stage 314 — Subscriptions and delivery (B)

- [ ] 314.1 B: migration `push_subscriptions`; REST `/api/me/push/**` (controller tests with role
  checks, another user gets 404); `ChannelType.WEB_PUSH` + `PushChannel` in `DeliveryDispatcher`
  (404/410 → delete the subscription, 429/5xx → backoff); push as a channel next to messengers in
  `notifications/preferences/` (`PreferencesService`, per-device switch); housekeeping of stale
  subscriptions in `NotificationsHousekeeping`; admin counters; `NotificationsDataReset` and
  `ModularityTests`.

### Stage 315 — Push in the frontend (F, `m3-expressive`)

- [ ] 315.1 F: `core/push/` service on `SwPush` (key, subscribe from a user gesture, unsubscribe),
  devices card in «Мой аккаунт» («Включить уведомления на этом устройстве», list with «Отключить»),
  onboarding card on the home for teacher and student, iOS «Добавьте на экран Домой» hint when
  `navigator.standalone` is false; push preferences next to messengers
  (`features/notifications/preferences/preferences-panel.ts`). Unit tests.

### Stage 316 — Docs and E2E

- [ ] 316.1 Docs: `docs/modules/notifications.md`, `docs/operations.md` (HTTPS is required), wiki
  «Мессенджеры» → section «Уведомления на телефоне без мессенджера», FAQ, help articles ru/en; E2E
  in the notifications suite: grant `notifications`, subscribe / unsubscribe REST flow, a new build
  is picked up by the service worker; real push delivery stays a manual check.

### Stage 317 — Release 0.38.0

- [ ] 317.1 Release per skill `release`: help articles, E2E, CHANGELOG, version bump, archive this
  section to `archive/plans/v0.38.0.md`.

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Colours of students and groups after 0.20.0: rows without an avatar (the student table of the
monthly report, homework and board lists by name) and the options of student / group selects.

`shared/ui/fold-card.ts` (`tb-fold-card`) is used by no page since 247.2: remove it or find it a use.

Carried over from 0.6.13 (design audit 2026-09-29, `archive/audit/`):

- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation
or "Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times
in the portal time zone; picking a reschedule time from free slots; file check before upload;
journal filters in the URL; prompt on leaving unsaved settings; invitation and first-run fixes;
list-detail for the review queue; filter chips instead of toggles. _List-detail for the review
queue, «Следующая работа», filter chips and search in long lists are planned in the redesign (stages
237, 242, 248)._

Calls after 0.8.0: call history; teacher moderation (mute / remove a participant); chat in the call;
«ученик ждёт» notification (LiveKit webhooks); opening the student's board from the call; Document
Picture-in-Picture; noise suppression; recording.
