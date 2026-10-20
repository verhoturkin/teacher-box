# billing

Lessons charged to students, payments, balance, reports, prices. Depends on: `shared`, `identity::api`,
`schedule::api` (events only). Schema `billing`. ADRs: [0008](../adr/0008-schedule.md) (charging from
schedule), [0011](../adr/0011-groups-and-group-lessons.md) (group prices), [0014](../adr/0014-portal-settings-reset-and-restore.md) (default price).

## Rules

- Money — `long` minor units + instance currency `TEACHERBOX_BILLING_CURRENCY`; balance = payments − charges.
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
  (created on `GroupCreated` with the default price). Default lesson duration —
  `TEACHERBOX_BILLING_DEFAULT_LESSON_DURATION`.
- Monthly report per student in the instance time zone.

## Contract (`billing::api`)

Events only: `LessonRecorded`, `LessonCancelled`, `PaymentRecorded`, `PaymentVoided` → consumed by
`notifications`. Listens to: `StudentRegistered` (account), `GroupCreated` (group price), `LessonCompleted`,
`LessonCompletionRevoked`.

## Data

`student_accounts`, `lessons`, `payments` (+ receipt), `pending_receipts`, `group_prices`, `settings` (default
lesson price).

## REST and bot

`/api/teacher/billing/**` (overview, summary, students/{id}, lessons, payments, `payments/{id}/receipt` —
`PUT` multipart `file`, `DELETE`, `GET`, prices, groups, reports/monthly), `/api/me/billing` (+ `/summary`,
`/payments/{id}/receipt`). Bot actions (`billing/chat`): record a payment, record a
lesson, the student's payments.

## Frontend

`features/billing/`: `teacher/` (payments page, `student-payments-tab.ts` — the Payments tab of the student card since 0.23.0, its price lives in `student-price-card.ts` on the Profile tab; monthly report; the payment dialog takes an
optional receipt), `student/` (own payments), `ledger/` (the receipt opens from its payment row; the teacher
attaches, replaces and removes it from the «📎» menu), `home/` (finance widgets), `settings/default-price-card.ts`
(the settings category «Оплаты», `/teacher/settings/payments`), `billing-labels.ts`.
