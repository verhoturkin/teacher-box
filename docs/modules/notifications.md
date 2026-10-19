# notifications

Cabinet inbox, messenger delivery (Telegram, VK, MAX), messenger bot dialogs, broadcasts. Depends on:
`shared`, `identity::api` (events and facades), `billing::api`, `homework::api`, `schedule::api`,
`meetings::api` (events only). Schema `notifications`. ADRs: [0005](../adr/0005-notifications.md),
[0009](../adr/0009-external-integrations.md), [0013](../adr/0013-bot-dialogs.md).

## Rules

- Listens to domain events of other modules (producers don't know it) and turns each into an **inbox** record
  plus an outbox **delivery** per connected and enabled channel of the recipient. Texts — templates in
  the module, in the recipient's language (0.11.1, ADR-0036: `UserDirectory.language`; dictionaries
  `ScheduleMessages`, `NotificationMessages`, formats `NotificationTexts`); a stored notification keeps the language
  it was written in. Preferences per topic (`Preferences`, `NotificationTopic`).
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

## Contract

No `api` package: nothing depends on `notifications`.

## Data

`inbox`, `deliveries`, `preferences`, `channel_settings`, `channel_links`, `link_codes`, `broadcasts`,
`chat_dialogs`, `chat_buttons`, `chat_settings`. `NotificationsHousekeeping` cleans old records.

## REST

`/api/me/notifications/**` (inbox — newest first, `?read=true|false` filters it and `total` counts the filtered
ones; unread count, read, preferences), `/api/me/channels/**` (link code, unlink),
`/api/teacher/notifications/**` (status, summary, students, broadcast, remind-connect, `channels`, `bot`),
`/api/admin/notifications/deliveries` (failed deliveries without texts, retry).

## Frontend

`features/notifications/`: `notifications-page` (the student: inbox, messengers, what to send — until 235.2),
`sheet/notifications-sheet-content.ts` (the bell's side sheet, 235.1: the teacher's tabs «Входящие» / «Отправленные»,
the student's inbox; `/teacher/notifications` leads to `/teacher?notifications=inbox|sent`, the old `?open=` /
`?tab=` messenger addresses to `/teacher/settings/messengers`), `teacher/messengers-settings-panel.ts`
= the settings category «Мессенджеры» (bots, own messengers, bot abilities, students' messengers, what to send), `inbox/` (unread notifications on top; «Прочитанные» folded by default, loaded when
opened, each part with its own «Показать ещё»; a notification marked read moves there; `notification-list.ts`), `channels/`, `preferences/`, `teacher/` (broadcast, bot wizard), `student/`,
`home/` widget (only unread notifications: ✓ each, «Прочитать все» in the title), `notification-labels.ts`; the bell in the top bar (`core/notifications`) opens the sheet.
