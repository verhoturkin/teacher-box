# 03. Lesson packages («абонементы»)

Status: proposal. Size: L. ADR: yes — «Пакеты занятий» (how a package changes charging).

## Goal

The teacher sells «8 занятий за 12 000 ₽». The student and the teacher see «осталось 3 из 8», the
lesson inside a package is charged at the package price, and both get a warning when the package
is about to end or expire. Today `billing` knows only money: balance = payments − charges, price
per student / group / default.

## Decisions for the teacher

1. Does a package lock the price per lesson (12 000 / 8 = 1 500), or is it «N lessons regardless of
   price» (a group lesson and an individual one both take one unit)? Proposed: units, one lesson =
   one unit; the money value of a unit = package price / count.
2. Expiry date: optional; what happens to unused units — they burn (stay as money income, no
   refund) or turn back into money on the balance?
3. Does «Пропуск» (missed, paid) take a unit? Proposed: yes, same as a charge today.
4. Can a student have two active packages (e.g. individual and group)? Proposed: yes, with a scope
   — «индивидуальные», «группа X», «любые»; the oldest matching active package is used first.
5. Warning thresholds: «осталось 1 занятие» and «истекает через 7 дней»?

## Design

- Data (`billing`, migration `V?__packages.sql`):
  - `packages (id, student_id, title, units_total, price_minor, scope_kind ANY|INDIVIDUAL|GROUP,
    scope_group_id null, valid_until date null, payment_id null, status ACTIVE|USED|EXPIRED|VOIDED,
    created_at, version)`;
  - `package_uses (package_id, lesson_id, completion_id unique, used_at, revoked_at null)`.
  - `lessons` (billing's own charge records) get `package_id null`.
- Charging (`application/ScheduleListener` → `BillingService`): on `LessonCompleted` for a
  participant, find the oldest ACTIVE matching package with free units; if found, record a use
  and a charge with `amount = price_minor / units_total` (remainder on the last unit so the total
  is exact) and `package_id`; else charge as today. `completionId` idempotency stays the key.
  `LessonCompletionRevoked` → revoke the use (unit returns) and cancel the charge.
- Selling a package = recording a payment with a package in one transaction (`PaymentRecorded`
  as today, plus `PackageSold`), or attaching a package to an existing payment; voiding the payment
  voids an unused package and is refused for a used one (`billing.package-in-use`).
- Expiry: nightly job `PackageExpiry` (instance time zone) sets EXPIRED; by decision 2 either
  nothing else happens or a «возврат остатка» credit record is written.
- Events in `billing::api`: `PackageSold`, `PackageRunningLow(studentId, packageId, unitsLeft)`,
  `PackageExpiring(studentId, packageId, validUntil)`, `PackageEnded` → `notifications`
  (`BillingNotifications`, topic `PAYMENTS`), with messenger texts in ru/en.
- Balance stays money-based — a package payment raises the balance, each use lowers it at the unit
  price, so existing reports, the operations journal and debts keep working. The journal gets
  `kind=PACKAGE` rows and lesson rows show «по абонементу».
- Bot: `RecordPaymentChatAction` gains «Это абонемент?» with the teacher's package presets.
- Presets: `package_presets (id, title, units, price_minor, valid_days null)` for one-tap selling.

## Stages

### A — Model and charging (B)

- [ ] **A.1** ADR, migration, domain `LessonPackage` with unit arithmetic (property tests for the
  remainder: the sum of unit charges equals the price for any count 1–100), repositories.
- [ ] **A.2** Charging through packages in `BillingService`, revocation, idempotency tests
  (redelivered `LessonCompleted` takes one unit), scope matching tests, group lesson tests.
- [ ] **A.3** REST: `GET/POST /api/teacher/billing/students/{id}/packages`,
  `POST …/packages/{id}/void`,
  presets CRUD under `/api/teacher/billing/package-presets`, `GET /api/me/billing/packages`;
  role tests, another student 404.
- [ ] **A.4** Expiry job, events, notifications listener and texts; reset coverage.

### B — Frontend (F, `m3-expressive`)

- [ ] **B.1** `billing/teacher/payment-dialog.ts`: «Оплата | Абонемент» toggle (connected
  single-select group per 0.34.0 rules) with a preset select; the student's Payments tab
  (`student-payments-tab.ts`) — a package tile «Осталось 3 из 8 · до 30.11» and history.
- [ ] **B.2** Settings «Оплаты» (`settings/default-price-card.ts` neighbour): presets card.
- [ ] **B.3** Student side `billing/student/my-billing-page.ts` and the home «Оплачено N занятий»
  widget switch to package units when a package is active.
- [ ] **B.4** Operations journal: `PACKAGE` filter chip, «по абонементу» marker; billing overview
  «кому заканчивается абонемент» next to «кому заканчивается аванс».

### C — Bot, docs, E2E

- [ ] **C.1** Bot payment flow with presets; `docs/modules/billing.md`, wiki «Оплаты» part of
  `Features.md` / a page, help in ru and en; E2E `e2e/tests/billing/packages.spec.ts`: sell 2-unit
  package, mark two lessons, third lesson charged at the normal price, revoke one mark → unit back.

## Risks and out of scope

- Monthly report figures must not double count: a package payment is income, unit uses are
  charges — the same as payment + lessons today. Write a report test before changing queries.
- Online sale of packages by the student — out of scope (see 04 for invoices).
