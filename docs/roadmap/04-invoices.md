# 04. Invoices with a payment QR

Status: proposal. Size: M. ADR: yes — «Счета и QR для оплаты» (public link, no payment provider).
Depends on: 03 (soft — an invoice may sell a package).

## Goal

The teacher sends «Счёт на 6 000 ₽» to a student (or a parent): a page with the amount, purpose and
a QR code that any Russian bank app scans (the ГОСТ Р 56042-2014 payment QR, `ST00012|Name=…`), or
an SBP link the teacher pasted. The payer taps «Я оплатил», may attach a receipt, and the teacher
confirms in one tap — the payment is recorded. No acquiring, no money passes through the portal.

## Decisions for the teacher

1. Requisites: the payment QR needs recipient name, account, bank BIC, correspondent account (and
   INN for the self-employed). Many tutors are paid by phone through SBP, which has no universal
   QR for a person-to-person transfer — then the page shows the phone, bank and a «Скопировать»
   button. Which variants to support? Proposed: both — «QR по реквизитам» and «Перевод по номеру».
2. Who can open the invoice: only logged-in student (and guardian, 05), or anyone with the link
   (a parent without an account)? Proposed: secret link `/pay/<token>` like the ICS feed, showing
   the portal name, amount, purpose, requisites — and no student name.
3. Automatic invoices: «счёт за месяц» on the 1st (sum of charges of the previous month minus the
   balance) — wanted?
4. Does «Напомнить» for debtors attach an invoice automatically?

## Design

- `billing` data: `invoices (id, student_id, amount_minor, purpose varchar(200), package_preset_id
  null, status OPEN|CLAIMED|PAID|CANCELLED, token_hash, claimed_at, claim_receipt_* , payment_id
  null, created_at, version)`; `payee_settings` (one row: variant, requisites).
- Token: 256-bit, only the hash stored (as `schedule.feeds`); link via
  `Portal.link("/pay/<token>")`.
- Public endpoints `/api/public/billing/invoices/{token}` (GET view), `POST …/claim` (multipart
  optional receipt, rate-limited like auth endpoints, file checks of `domain/Receipt`).
- `POST /api/teacher/billing/invoices/{id}/confirm` → records the payment
  (`ReceiptService.recordWithPending` pattern, one transaction, receipt moved over) and, with a
  preset, the package (03); `…/cancel`.
- QR: generated on the backend as SVG — add ZXing core (Apache-2.0) to `billing` only; the payload
  builder `PaymentQrPayload` is a pure function with tests against the standard's examples
  (encoding `ST00012` = UTF-8, field order, `|` escaping). Check licence and version first.
- Events `InvoiceIssued`, `InvoiceClaimed` → `notifications`: the student gets «Счёт» with an
  «Оплатить» button (the link), the teacher gets «Ученик отметил оплату» with «Подтвердить» bot
  button (a `ChatAction` in `billing/chat`).
- Payee settings live in the settings category «Оплаты»; requisites are personal data of the
  teacher — never logged, excluded from diagnostics archive, included in backups.

## Stages

- [ ] **A.1** (B) ADR, migration, `PaymentQrPayload` + tests, payee settings REST
  `/api/teacher/billing/payee`.
- [ ] **A.2** (B) Invoices REST (teacher CRUD, public view/claim, confirm), security config for the
  public path in `platform/security`, rate limit, tests: unknown token 404 with constant timing,
  cancelled invoice cannot be claimed, confirm twice → one payment.
- [ ] **A.3** (B) Events, notifications texts, bot «Подтвердить» action, audit.
- [ ] **B.1** (F) Settings card «Реквизиты для оплаты» (variant toggle, fields with validation of
  BIC 9 digits / account 20 digits, preview of the QR).
- [ ] **B.2** (F) «Выставить счёт» on the student card Payments tab and in the debtors list;
  invoice list with statuses; «Подтвердить оплату» row in «Нужно сделать» on Today.
- [ ] **B.3** (F) Public page `/pay/:token` outside the cabinet layout (works without login, both
  languages, light/dark, phone first): amount, purpose, QR, copy buttons, «Я оплатил» + receipt.
- [ ] **C.1** Docs: `docs/modules/billing.md`, wiki page about payments, help ru/en, E2E
  `e2e/tests/billing/invoices.spec.ts` (issue → open public link → claim → confirm → balance).

## Risks and out of scope

- Bank apps differ in QR support; test the payload with 2–3 real apps by hand before release.
- Online acquiring (ЮKassa, CloudPayments) — out of scope; the ADR should say why (self-hosted,
  each teacher's own contract, webhooks reachability).
