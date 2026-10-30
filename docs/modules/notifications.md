# notifications

Cabinet inbox, messenger delivery (Telegram, VK, MAX), messenger bot dialogs, broadcasts. Depends on:
`shared`, `identity::api` (events and facades), `billing::api`, `homework::api`, `schedule::api`,
`meetings::api` (events only). Schema `notifications`. ADRs: [0005](../adr/0005-notifications.md),
[0009](../adr/0009-external-integrations.md), [0013](../adr/0013-bot-dialogs.md).

## Rules

- **Lesson repetition (0.29.0):** `LessonRepeatScheduled` and `LessonRepeatStopped` aggregate notices;
  nightly occurrence generation sends none. Legacy `SeriesScheduled`/`SeriesStopped` listeners remain only
  to replay durable publications from an older release. Billing still consumes individual lesson outcomes.

- Listens to domain events of other modules (producers don't know it) and turns each into an **inbox** record
  plus an outbox **delivery** per connected and enabled channel of the recipient. Texts — templates in
  the module, in the recipient's language (0.11.1, ADR-0036: `UserDirectory.language`; dictionaries
  `ScheduleMessages`, `NotificationMessages`, formats `NotificationTexts`); a stored notification keeps the language
  it was written in. Preferences per topic (`Preferences`, `NotificationTopic`).
- **Reminder from the teacher** (341.1): `HomeworkReminderRequested` → inbox record «Учитель напоминает
  о задании «…»» with the due date (kind `HOMEWORK_REMINDER`, topic `REMINDERS`), link to the task.
- **Lesson summary** (0.37.0): `LessonSummaryShared` → inbox record «Итоги урока dd.MM» (kind and topic
  `LESSON_SUMMARY`, on by default, mutable in messengers) for every participant, link
  `/cabinet/schedule?lesson=<id>` (messenger button «Открыть»). The text carries no summary — it stays in
  the lesson card.
- **Links in messengers are buttons** (0.14.2): the text is the title and the body; the portal page of a notification
  goes as «Открыть» (`Portal.link`), a video room as «Подключиться» (`JoinLink`: the room link, lesson reminders —
  their messenger text has no address, the inbox keeps it), then the buttons of the bot's actions; `/help` has a
  «Справка» button. A messenger that refuses link buttons (Telegram and a portal on a local address) gets the message
  again with «Открыть: https://…» in the text (`OutgoingMessage.linksInText`, in `DeliveryDispatcher` and
  `MessengerPolling`).
- `DeliveryDispatcher` sends deliveries with backoff (30 s … 1 h, `TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS`);
  permanent errors (4xx except 429, VK "no access") fail at once. Deactivated students get inbox only.
- Channels — SPI `MessengerChannel`: Telegram (Bot API, long polling, `TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY`),
  VK (community messages), MAX (Bot API). Env tokens win over UI settings. HTTP/1.1 with `Content-Length`;
  tokens scrubbed from errors.
- Polling (`MessengerPolling`): one virtual thread per messenger; a restart (settings saved) or a stop interrupts
  the thread only while it waits — for the messenger or between retries (`Poller.waiting`); the interrupt flag is
  cleared before the answers, which read and write the database (an interrupt during H2's file I/O closes the whole
  database, ADR-0002). A thread stopped while answering finishes the batch, then exits.
- **Linking:** one-time code (8 chars, 15 min, SHA-256 stored), deep link `t.me/<bot>?start=<code>` /
  `max.ru/<bot>?start=<code>`, typed to the VK community; `/stop` unlinks. One messenger account may serve
  several recipients (parent of two students).
- **Bot dialogs:** `ChatEngine` collects `shared.chat.ChatAction` beans from all modules (it does not know
  them): role menu, `/menu`, `/cancel`, `/help`; dialog state in `chat_dialogs` (30 min); buttons carry only
  a token, values in `chat_buttons`, one press consumes the set; notifications may carry action buttons;
  teacher changes audited (`AuditLog.bot`); the teacher can turn bot control off (`chat_settings`). A reply
  the messenger refuses for its link buttons (Telegram takes no portal on a local address) goes again with
  the links in the text (`MessengerPolling`, 0.11.0).
- **Files sent to the bot (0.13.0, ADR-0038):** adapters turn a photo or a document into `IncomingFile` (the
  caption is the text; Telegram `getFile`, VK `photo`/`doc`, MAX `image`/`file`), `ChatEngine` downloads it (up to
  20 MB) only for the first available action with `takesFiles` and hands it over as `ChatFile`, ending any
  dialog; otherwise the bot says it does nothing with files. Today only `billing` takes files (receipts).
- **Bot language (0.11.1, ADR-0036):** the bot answers in the language of the account the chat acts for
  (`ChatUser.language`, `BotMessages`; actions take it for their titles — `ChatAction.title(Language)` — and
  texts, `shared.chat.ChatKit`/`ChatText`/`ChatPicker` for buttons and dates); a chat without an account gets
  the teacher's language; typed words of both languages work («меню»/«menu», «да»/«yes», «сегодня»/«today»).
  The commands in Telegram's menu are published per language (`language_code`): Russian by default.
- Broadcasts and «напомнить подключить» for the teacher. `MessengerIntegrationCheck` for diagnostics.
- **Web push (0.38.0, ADR-0051), `webpush/`:** `WebPushCrypto` (RFC 8291 `aes128gcm` on JDK crypto; a
  device key off the curve is refused), `Vapid` (RFC 8292 ES256 token), `VapidKeyStore` (the key pair
  is made on the first start in `webpush_keys` and kept in backups; the private key is write-only —
  the store signs for callers, nothing returns it), `WebPushSender` (JDK `HttpClient`, `https`
  endpoints only; `Outcome`: 2xx `SENT`, 404 / 410 `GONE` — delete the subscription, 429 / 5xx / no
  connection `RETRY`, other `REJECTED`). Optional `TEACHERBOX_NOTIFICATIONS_WEBPUSH_SUBJECT` is the
  VAPID `sub` (the portal address when empty).
- **Web push channel (0.38.0, 314.1):** `push_subscriptions` is one row per browser of a user (the
  endpoint is unique and a secret: never in logs, views or admin answers). `ChannelType.WEB_PUSH`
  (`isMessenger()` is false: no bot, link code or health). `NotificationService.notify` schedules
  one `WEB_PUSH` delivery per subscription next to the messenger ones, under the same muted topics
  and quiet hours of `Preferences`; `externalId` is the subscription id, `text` the title.
  `PushChannel` (called by `DeliveryDispatcher`) reads the inbox record and sends
  `{notification:{title, body, icon, badge, tag, data:{url, onActionClick}}}` (the format `ngsw` shows
  by itself; `icon` is the transparent `/push-icon.png`, so Chrome on Android draws no letter avatar,
  `badge` the monochrome `/push-badge.png`; urls via `Portal.link`, TTL one day,
  nothing beyond the inbox record). A gone device (unsubscribed,
  404 / 410) is deleted and the delivery ends `SENT` without a failure; 429 / 5xx / no connection
  retry with the queue backoff; other 4xx fail the delivery. Each failure adds to `failures`, a
  success resets it; `NotificationsHousekeeping` deletes subscriptions that failed and have taken
  nothing for 30 days (a quiet working device stays). The per-device switch is the subscription
  itself: «Отключить» deletes it. `PushSubscriptionService` validates an `https` endpoint and the
  keys (65 and 16 bytes, base64url) and checks ownership; another user's id is 404.

## Contract

No `api` package: nothing depends on `notifications`.

## Data

`inbox`, `deliveries`, `preferences`, `channel_settings`, `channel_links`, `link_codes`, `broadcasts`,
`chat_dialogs`, `chat_buttons`, `chat_settings`, `webpush_keys` (the VAPID pair, one row, 0.38.0),
`push_subscriptions` (the devices that get web push, 0.38.0).
`NotificationsHousekeeping` cleans old records.

## REST

`/api/me/notifications/**` (inbox — newest first, `?read=true|false` filters it and `total` counts the filtered
ones; unread count, read, preferences), `/api/me/channels/**` (link code, unlink),
`/api/teacher/notifications/**` (status, summary, students, `students/{studentId}` — one student's messengers and
failed deliveries for the student card, deactivated included, unknown → 404 (237.1), broadcast, remind-connect,
`channels`, `bot`),
`/api/admin/notifications/deliveries` (failed deliveries without texts, retry),
`/api/admin/notifications/push` (counts of devices and failing ones, no users or addresses),
`GET /api/me/push/key` (public VAPID key), `GET|POST /api/me/push/subscriptions` (own devices;
POST takes `PushSubscription.toJSON()`, the same endpoint again updates it),
`DELETE /api/me/push/subscriptions/{id}` (teacher and students; the administrator gets 403).

## Frontend

`features/notifications/` has no page (235.2): `sheet/notifications-sheet-content.ts` (the bell's sheet,
shadowless with a transparent scrim on compact, 235.1:
the teacher's tabs «Входящие» / «Отправленные», the student's inbox; the header and tab bar stay fixed while
the active tab's content scrolls inside the sheet on desktop and compact screens; `/teacher/notifications` leads to
`/teacher?notifications=inbox`, the old `?open=` / `?tab=` messenger addresses to `/teacher/settings/messengers`;
`/cabinet/notifications` to `/cabinet?notifications=inbox`), `teacher/messengers-settings-panel.ts`
= the settings category «Уведомления и мессенджеры» (device notifications after the failed
deliveries, bots, own messengers, bot abilities, students' messengers, what to send), `inbox/` (unread notifications on top; «Прочитанные» folded by default, loaded when
opened, each part with its own «Показать ещё»; a notification marked read moves there; `notification-list.ts`), `channels/`, `preferences/` (the student's are on «Мой аккаунт», `/cabinet/account`, 235.2), `teacher/` (broadcast —
`new-message-dialog.ts` is the frame's dialog of a new message through `NEW_MESSAGE_DIALOG`, opened by «Создать ›
Сообщение» on any page and by «Написать ученикам», 235.3; bot wizard), `student/` (`connect-messenger-card.ts` on the student's home → «Мой аккаунт»; the «connect» reminder
`remindToConnect` links there too), `notification-labels.ts`; the bell in the top bar (`core/notifications`) opens the sheet.

Web push in the interface (0.38.0, ADR-0051): `core/push/web-push.ts` (`WebPush` on `SwPush`: the
public key, subscribe, unsubscribe, the user's devices; the permission is asked only from a click,
and an iPhone tab that is not on the Home Screen gets the hint instead), `push/push-devices-card.ts`
(«Уведомления на устройствах» in the teacher's «Уведомления и мессенджеры» and on the student's
«Мой аккаунт»: «Включить уведомления
на этом устройстве», the list with «Отключить») and `push/push-onboarding-card.ts` (a card on the
home that a click turns into the permission prompt; «Не сейчас» hides it on this device). Without
HTTPS or a service worker (a dev build) `supported` is false and the card only explains it. The
service worker itself, the update snackbar and the offline page «Нет связи» are in ADR-0051; nginx
serves `ngsw*.js` / `ngsw.json` with `no-cache` (`docker/nginx`). E2E:
`e2e/tests/notifications/web-push.spec.ts` (headers, REST, the card); real delivery through Google /
Mozilla / Apple is a manual check.

Broadcast recipients use the shared typed member picker. Explicit students and active groups resolve to a
deduplicated snapshot, preserving explicit students when groups are removed. Empty selection means all;
a nonempty selection resolving to no available students is rejected rather than broadcast to everyone.
