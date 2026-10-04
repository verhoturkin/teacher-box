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
- Prices: default lesson price (set in the first-run wizard, stored in DB), per-student price, per-group price
  (created on `GroupCreated` with the default price). Default lesson duration —
  `TEACHERBOX_BILLING_DEFAULT_LESSON_DURATION`.
- Monthly report per student in the instance time zone.

## Contract (`billing::api`)

Events only: `LessonRecorded`, `LessonCancelled`, `PaymentRecorded`, `PaymentVoided` → consumed by
`notifications`. Listens to: `StudentRegistered` (account), `GroupCreated` (group price), `LessonCompleted`,
`LessonCompletionRevoked`.

## Data

`student_accounts`, `lessons`, `payments`, `group_prices`, `settings` (default lesson price).

## REST and bot

`/api/teacher/billing/**` (overview, summary, students/{id}, lessons, payments, prices, groups,
reports/monthly), `/api/me/billing` (+ `/summary`). Bot actions (`billing/chat`): record a payment, record a
lesson, the student's payments.

## Frontend

`features/billing/`: `teacher/` (payments page, student ledger, monthly report), `student/` (own payments),
`ledger/`, `home/` (finance widgets), `billing-labels.ts`.
