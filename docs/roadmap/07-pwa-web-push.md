# 07. Installable app and web push

Status: proposal. Size: M. ADR: yes — «Установка портала и web-push» (service worker caching rules,
VAPID keys, push as a delivery channel).

## Goal

The portal installs on a phone or a computer as an app (icon, own window), and notifications
arrive as system push notifications without Telegram / VK / MAX. For students who don't want a bot
this is the only way to learn about a new homework or a moved lesson without opening the portal.

## Current state

- The web app manifest already exists: `/api/public/portal/manifest.webmanifest` (`platform/portal`,
  name, logo, icons, colours). There is no service worker, so browsers offer limited install and
  no push.
- Deliveries go through the SPI `notifications/application/MessengerChannel` with outbox
  `deliveries` and backoff in `DeliveryDispatcher`.

## Decisions for the teacher

1. Push for the teacher too (new request, work submitted, student waiting — 09)? Proposed: yes.
2. Should push replace messenger delivery when both are on, or go in addition? Proposed: in
   addition, each switchable per device in «Мой аккаунт».
3. Offline: only an «Нет связи» page, or a read-only cached schedule? Proposed: v1 — offline page
   and cached app shell only; data stays online.

## Design

- Service worker: Angular `@angular/service-worker` (`ngsw`) — check Angular 21 docs via context7
  first (zoneless app, standalone `provideServiceWorker`). `ngsw-config.json`: prefetch app shell,
  lazy assets; **no data groups for `/api/**`** (never cache personal data); `navigationUrls`
  exclude `/api/**`, `/livekit/**`, `/pay/**` if 04 lands. Update flow: `SwUpdate.versionUpdates` →
  snackbar «Доступна новая версия — Обновить». nginx: `ngsw.json` and `ngsw-worker.js` with
  `Cache-Control: no-cache` (`docker/nginx`), CSP `worker-src 'self'`.
- Push protocol: Web Push (RFC 8030) with VAPID (RFC 8292) and payload encryption (RFC 8291).
  Implement with JDK crypto (P-256 ECDH, HKDF-SHA256, AES-128-GCM, ES256 JWT) in
  `notifications/webpush/` — about 200 lines, no BouncyCastle; or a maintained library if one
  exists for Java 25 (check licence). Test vectors from RFC 8291 appendix as unit tests.
- VAPID keys: generated on first start, stored in `notifications.channel_settings` (private key
  write-only), included in backups (a restored portal keeps subscriptions working); optional env
  `TEACHERBOX_NOTIFICATIONS_WEBPUSH_SUBJECT` (`mailto:` or the portal URL) → skill `new-setting`.
- Data: `push_subscriptions (id, user_id, endpoint varchar(1000) unique, p256dh, auth, user_agent
  varchar(200), language, created_at, last_success_at, failures)`.
- Delivery: `ChannelType.WEB_PUSH`; a `PushChannel` that fits `DeliveryDispatcher` (one delivery
  per subscription); 404/410 from the push service → delete the subscription; 429/5xx → backoff.
  Payload: title, body, URL (from `Portal.link`), tag (to collapse repeats), no personal data
  beyond what the inbox record shows. Push services are third parties (Google FCM, Mozilla, Apple)
  — the ADR and the wiki must say so; payload is end-to-end encrypted.
- Service worker handlers: `push` → `showNotification`, `notificationclick` → focus or open the URL.
  Since `ngsw` handles push itself (`SwPush`), use its payload format `{notification: {...}}`
  and `onActionClick`.
- Frontend: `core/push/` service — permission request only from a user gesture («Включить
  уведомления на этом устройстве» in «Мой аккаунт» and an onboarding card on the home), list of the
  user's devices with «Отключить». iOS: push only for an installed app (16.4+) — show «Добавьте
  на экран Домой» instructions when `navigator.standalone` is false on iOS.
- REST: `GET /api/me/push/key` (public VAPID key), `POST /api/me/push/subscriptions`,
  `DELETE /api/me/push/subscriptions/{id}`, `GET /api/me/push/subscriptions`. Admin: count of
  subscriptions and failures only (IDs, no endpoints).

## Stages

- [ ] **A.1** (F, D) Service worker, update snackbar, offline page, nginx headers and CSP; tests of
  the update service; manual check: Chrome install, Android install, iOS «На экран Домой».
- [ ] **B.1** (B) ADR; Web Push crypto with RFC test vectors; VAPID key storage; setting.
- [ ] **B.2** (B) Subscriptions REST + tests (another user cannot delete a subscription — 404),
  `PushChannel` in delivery, cleanup on 410, housekeeping of stale subscriptions.
- [ ] **C.1** (F) `core/push/` service, «Мой аккаунт» devices card, onboarding card, iOS hint;
  preferences — push as a channel next to messengers in `notifications/preferences/`.
- [ ] **D.1** Docs: `docs/modules/notifications.md`, `docs/operations.md` (HTTPS is required),
  wiki «Мессенджеры» → section «Уведомления на телефоне без мессенджера», FAQ, help ru/en; E2E:
  Playwright can grant `notifications` permission and read the subscription — test the
  subscribe / unsubscribe REST flow; real push delivery stays a manual check.

## Risks and out of scope

- Push requires HTTPS and a public address; a portal on a LAN IP gets the install banner only.
- A service worker can serve a stale app after an update — the update snackbar and `no-cache` on
  `ngsw.json` are mandatory; add an E2E that a new build is picked up.
- Native apps (Capacitor) — out of scope.
