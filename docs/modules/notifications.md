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
  VAPID `sub` (the portal address when empty). Subscriptions, the channel and REST come in the next
  substeps of the release.

## Contract

No `api` package: nothing depends on `notifications`.

## Data

`inbox`, `deliveries`, `preferences`, `channel_settings`, `channel_links`, `link_codes`, `broadcasts`,
`chat_dialogs`, `chat_buttons`, `chat_settings`, `webpush_keys` (the VAPID pair, one row, 0.38.0).
`NotificationsHousekeeping` cleans old records.

## REST

`/api/me/notifications/**` (inbox — newest first, `?read=true|false` filters it and `total` counts the filtered
ones; unread count, read, preferences), `/api/me/channels/**` (link code, unlink),
`/api/teacher/notifications/**` (status, summary, students, `students/{studentId}` — one student's messengers and
failed deliveries for the student card, deactivated included, unknown → 404 (237.1), broadcast, remind-connect,
`channels`, `bot`),
`/api/admin/notifications/deliveries` (failed deliveries without texts, retry).

## Frontend

`features/notifications/` has no page (235.2): `sheet/notifications-sheet-content.ts` (the bell's sheet,
shadowless with a transparent scrim on compact, 235.1:
the teacher's tabs «Входящие» / «Отправленные», the student's inbox; the header and tab bar stay fixed while
the active tab's content scrolls inside the sheet on desktop and compact screens; `/teacher/notifications` leads to
`/teacher?notifications=inbox`, the old `?open=` / `?tab=` messenger addresses to `/teacher/settings/messengers`;
`/cabinet/notifications` to `/cabinet?notifications=inbox`), `teacher/messengers-settings-panel.ts`
= the settings category «Мессенджеры» (bots, own messengers, bot abilities, students' messengers, what to send), `inbox/` (unread notifications on top; «Прочитанные» folded by default, loaded when
opened, each part with its own «Показать ещё»; a notification marked read moves there; `notification-list.ts`), `channels/`, `preferences/` (the student's are on «Мой аккаунт», `/cabinet/account`, 235.2), `teacher/` (broadcast —
`new-message-dialog.ts` is the frame's dialog of a new message through `NEW_MESSAGE_DIALOG`, opened by «Создать ›
Сообщение» on any page and by «Написать ученикам», 235.3; bot wizard), `student/` (`connect-messenger-card.ts` on the student's home → «Мой аккаунт»; the «connect» reminder
`remindToConnect` links there too), `notification-labels.ts`; the bell in the top bar (`core/notifications`) opens the sheet.

Broadcast recipients use the shared typed member picker. Explicit students and active groups resolve to a
deduplicated snapshot, preserving explicit students when groups are removed. Empty selection means all;
a nonempty selection resolving to no available students is rejected rather than broadcast to everyone.
