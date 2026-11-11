# billing

Lessons charged to students, payments, balance, reports, prices. Depends on: `shared`, `identity::api`,
`schedule::api` (events only). Schema `billing`. ADRs: [0008](../adr/0008-schedule.md) (charging from
schedule), [0011](../adr/0011-groups-and-group-lessons.md) (group prices), [0014](../adr/0014-portal-settings-reset-and-restore.md) (default price).

## Rules

- Money — `long` minor units + instance currency (`BillingCurrencySetting`, RUB by default,
  ADR-0056); balance = payments − charges. `GET/PUT /api/teacher/billing/currency`
  (`{currency, locked}`): an ISO 4217 code with minor units (else 422 `billing.currency-invalid`);
  refused with 409 `billing.currency-locked` once a charge or a payment exists.
- A lesson recorded by hand without a duration takes the length of the student's last lesson (the
  schedule's lessons bring theirs in `LessonCompleted`), else 60 minutes; billing has no duration
  setting of its own.
- **Charges come from `schedule`:** `LessonCompleted` (conducted / missed-and-paid, per participant with its
  `completionId`) → a charge at the student's price, or the group's price for a group lesson; the
  `completionId` is remembered so redelivery does not double-charge. `LessonCompletionRevoked` cancels the charge
  (the record stays in history as cancelled).
- The teacher can also record a lesson manually and cancel a charge («Снять начисление»).
- Payments — recorded by the teacher, voided if entered by mistake (`PaymentVoided`).
- **Receipts (0.13.0, ADR-0038)** — one per payment (`payments.receipt_*`): a JPEG, PNG, WebP, HEIC picture or a
  PDF up to 10 MB, the type recognized by the first bytes (`domain/Receipt`), files in the namespace `billing`.
  The teacher attaches, replaces and removes it (a replaced file is deleted after the commit); the teacher and
  the student of the payment download it (another student gets 404). A receipt sent to the bot is kept in
  `pending_receipts` until the payment is recorded with it (`ReceiptService.recordWithPending`, one
  transaction); pending ones older than a day are removed nightly.
- Prices: default lesson price (set in the first-run wizard, stored in DB), per-student price, per-group price
  (created on `GroupCreated` with the default price). Billing keeps no default lesson
  duration (ADR-0056): a charge takes the length from the lesson events; a hand-recorded lesson
  without one
  takes the student's last lesson length, else 60 minutes.
- Monthly report per student in the instance time zone.

## Contract (`billing::api`)

Events only: `LessonRecorded`, `LessonCancelled`, `PaymentRecorded`, `PaymentVoided`. Listens
to: `StudentRegistered` (account), `GroupCreated` (group price), `LessonCompleted`,
`LessonCompletionRevoked`.

**Notices (`notices/`, ADR-0061, 380.3):** billing writes its own notifications. `BillingNotices`
listens to these events synchronously (`@EventListener`, in the transaction that published them)
and publishes `shared.notice.NoticeRequested` for the student with the texts in every language
(`BillingNoticeTexts`), a kind of `BillingNoticeKind` and the link `/cabinet/billing`: a charged or
missed lesson with its price, a removed charge, a payment and a voided payment — each with the new
balance («Баланс» or, when negative, «Задолженность»).

## Data

`student_accounts`, `lessons`, `payments` (+ receipt), `pending_receipts`, `group_prices`, `settings` (default
lesson price; `currency` — filled once from `.env` by `BillingSettingsImport`, ADR-0056, kept in
memory by `BillingCurrencySetting` between changes, forgotten by the full reset).

## REST and bot

`/api/teacher/billing/**` (overview, summary (`?month=yyyy-MM`, default the current one; `weeks` — Monday–Sunday weeks clipped to the month with `income` and `charged`), students/{id}, lessons, payments, `payments/{id}/receipt` —
`PUT` multipart `file`, `DELETE`, `GET`, prices, groups, reports/monthly, operations), `/api/me/billing` (+ `/summary`,
`/payments/{id}/receipt`). Bot actions (`billing/chat`): record a payment, record a
lesson, the student's payments.

### Operations journal (0.25.0)

`GET /api/teacher/billing/operations?month=yyyy-MM&kind=&studentId=` (teacher only, student 403; month defaults to the
current one) — one flat list of the month, newest first, built from billing's own `lessons` and `payments` (no
cross-module reads). `kind`: `PAYMENT` (amount +), `LESSON` (conducted, amount −charge), `ABSENCE` (missed — charged,
or cancelled — amount 0, `voided`). A voided payment stays in the list with `voided: true` and amount 0.

`GET /api/teacher/billing/operations.csv` (same parameters and access, 0.36.0) — the same filtered journal as a
download `operations-<yyyy-MM>.csv`: UTF-8 with a BOM, `;` separator, CRLF, columns date (instance time zone),
student, kind, amount in currency units with a decimal comma, comment, voided. Fields holding `;`, quotes or line
breaks are quoted; texts starting with `= + - @` get a leading `'` against spreadsheet formulas. Student names are
included (the teacher's own data); no income-for-period or year range.

## Frontend

`features/billing/`: `teacher/` (payments page, `student-payments-tab.ts` — the Payments tab of the student card since 0.23.0:
four tonal summary tiles for balance, all-time charged, all-time paid and lesson price, in one row on wide
screens and wrapping on compact screens, matching the teacher's payments overview; price editing lives in
`student-price-card.ts` on the Profile tab; monthly report; the payment dialog takes an
optional receipt), `student/` (own payments: a surface pane with balance, charged, paid and lesson-price figures; history filter chips for all operations, payments and charges), `ledger/` (the receipt opens from its payment row; the teacher
attaches, replaces and removes it from the «📎» menu), `home/` (finance widgets), `settings/default-price-card.ts`
(«Время и цена» of the settings category «Занятия», `/teacher/settings/lessons`, saved on change), `billing-labels.ts`.

On compact screens the teacher's month controls and «Отчёт за месяц» link wrap within the pane.
The report's month picker fits the available width; figure amounts wrap inside their tiles.
