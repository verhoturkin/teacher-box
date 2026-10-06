# notifications

Cabinet inbox, messenger delivery (Telegram, VK, MAX), messenger bot dialogs, broadcasts. Depends on:
`shared`, `identity::api` (events and facades), `billing::api`, `homework::api`, `schedule::api`,
`meetings::api` (events only). Schema `notifications`. ADRs: [0005](../adr/0005-notifications.md),
[0009](../adr/0009-external-integrations.md), [0013](../adr/0013-bot-dialogs.md).

## Rules

- Listens to domain events of other modules (producers don't know it) and turns each into an **inbox** record
  plus an outbox **delivery** per connected and enabled channel of the recipient. Texts — Russian templates in
  the module; preferences per topic (`Preferences`, `NotificationTopic`).
- `DeliveryDispatcher` sends deliveries with backoff (30 s … 1 h, `TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS`);
  permanent errors (4xx except 429, VK "no access") fail at once. Deactivated students get inbox only.
- Channels — SPI `MessengerChannel`: Telegram (Bot API, long polling, `TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY`),
  VK (community messages), MAX (Bot API). Env tokens win over UI settings. HTTP/1.1 with `Content-Length`;
  tokens scrubbed from errors.
- **Linking:** one-time code (8 chars, 15 min, SHA-256 stored), deep link `t.me/<bot>?start=<code>` /
  `max.ru/<bot>?start=<code>`, typed to the VK community; `/stop` unlinks. One messenger account may serve
  several recipients (parent of two students).
- **Bot dialogs:** `ChatEngine` collects `shared.chat.ChatAction` beans from all modules (it does not know
  them): role menu, `/menu`, `/cancel`, `/help`; dialog state in `chat_dialogs` (30 min); buttons carry only
  a token, values in `chat_buttons`, one press consumes the set; notifications may carry action buttons;
  teacher changes audited (`AuditLog.bot`); the teacher can turn bot control off (`chat_settings`).
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

`features/notifications/`: `notifications-page` (foldable sections: inbox, messages to students, messengers,
students, what to send), `inbox/` (unread notifications on top; «Прочитанные» folded by default, loaded when
opened, each part with its own «Показать ещё»; a notification marked read moves there; `notification-list.ts`), `channels/`, `preferences/`, `teacher/` (broadcast, bot wizard), `student/`,
`home/` widget, `notification-labels.ts`; bell in the top bar.
