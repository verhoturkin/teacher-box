# 05. Parent access

Status: proposal. Size: XL (two releases). ADR: yes — «Родители (опекуны)», amends ADR-0003 (roles)
and AGENTS.md §4.3 (roles and access).

## Goal

A parent gets their own login, sees the schedule, homework status, payments and progress of their
children, gets reminders in a messenger, and can ask to cancel or move a lesson. Read-mostly: the
parent never submits homework or edits the student's profile. Today one messenger account may
receive notifications of several students (`notifications` «parent of two students»), but there is
no parent in the portal.

## Decisions for the teacher

1. What a parent can do besides reading: request a move / cancel (proposed yes), «Я оплатил» on
   invoices (04, yes), write to the teacher (no — out of scope).
2. Which notifications go to the parent by default: payments and debts, lesson reminders, homework
   overdue, reviewed works? Each one a preference of the parent.
3. Does the student see that a parent is connected, and can a student 16+ hide homework texts from
   the parent? Proposed: the student sees «Родитель: Анна» in «Мой аккаунт»; no hiding in v1.
4. One parent → several students (siblings), one student → up to two parents. Confirm.
5. Does a parent see texts of homework and the teacher's comments, or only statuses and scores?

## Design

- Role `GUARDIAN` (code name; UI «Родитель»). `identity`:
  - `users.role` gains `GUARDIAN`; `guardianships (guardian_id, student_id, created_at)`;
  - invites: `invites.kind STUDENT|GUARDIAN` + `invites.student_id` for a guardian invite;
    the teacher creates a guardian from the student card («Пригласить родителя»);
  - a guardian of a deactivated student loses access to that student only; with no active
    students left the guardian cannot log in (`identity.guardian-no-students`).
  - Facade `identity::api.Guardians`: `isGuardianOf(guardianId, studentId)`,
    `studentsOf(guardianId)`, `guardiansOf(studentId)`; events `GuardianRegistered`,
    `GuardianshipRemoved`.
- Access model — the core decision of the ADR. Option A (proposed): separate read-only endpoints
  `/api/guardian/students/{studentId}/<module>/**` in every module; each controller calls a shared
  guard `shared.security.GuardianAccess.require(studentId)` implemented by `identity`
  (SPI in `shared`, like `PasswordConfirmation`), so business modules don't depend on identity's
  web layer. Option B — reuse `/api/me/**` with an «acting as» header: rejected, every existing
  `studentId == current user` check would become a hole.
- `platform/security`: rule `/api/guardian/**` → `GUARDIAN`; the guardian also reaches `/api/me`,
  `/api/me/password`, `/api/me/language`, `/api/me/avatar`, `/api/me/notifications/**`,
  `/api/me/channels/**`; nothing else under `/api/me/**`. Test: a matrix test that walks every
  mapped handler and asserts which roles reach it (fails when a new endpoint forgets the rule).
- Per module (read-only views, a subset of the student's):
  - schedule — lessons, requests (create move / cancel on behalf, stored with `requested_by`),
    ICS feed of the guardian (lessons of all children);
  - homework — tasks with status, due date, score (texts by decision 5);
  - billing — summary, history, receipts, invoices;
  - textbooks / boards — none in v1;
  - meetings — none (the parent does not join calls).
- `notifications`: recipients of an event = the student + guardians by the guardian's preferences;
  texts name the child («Занятие Пети завтра в 16:00»). `UserDirectory` gives the guardian's
  language. Bot: a guardian's role menu with «Расписание детей», «Баланс», «Перенести занятие».
- Frontend: area `/family/**` with its own shell config — child switcher in the top bar (chips
  with the child's colour/avatar), sections «Главная», «Расписание», «Задания», «Оплаты». Pages
  reuse the student's widgets through `parts.ts` with an `ApiScope` input (student vs guardian
  base URL) instead of copying components.

## Stages

### Release 1 — accounts and read access

- [ ] **A.1** (B) ADR; identity migration, guardian invites, `Guardians` facade, deactivation
  rules, `GuardianAccess` SPI in `shared`, implementation; tests.
- [ ] **A.2** (B) Security rules + the endpoint/role matrix test in `platform`.
- [ ] **A.3** (B) schedule guardian endpoints + tests «guardian of another student → 404»; ICS.
- [ ] **A.4** (B) homework and billing guardian endpoints + the same tests.
- [ ] **A.5** (F) Student card «Родители» block (invite link, remove), invite page variant for a
  guardian (`identity/invite/`), `/family` shell, child switcher, home, schedule, homework, payments
  pages from the student's parts.
- [ ] **A.6** Docs: AGENTS.md §4.3 (new role row), `docs/modules/identity.md`, wiki page
  «Родители», help ru/en, E2E `e2e/tests/family/` (invite → login → sees child, not another).

### Release 2 — notifications and actions

- [ ] **B.1** (B) Recipient expansion in `notifications` with guardian preferences, texts with the
  child's name, messenger linking for guardians (same link codes).
- [ ] **B.2** (B) Move / cancel requests on behalf (`change_requests.requested_by`), the teacher
  sees «запрос от родителя»; bot menu for guardians.
- [ ] **B.3** (F) Guardian preferences, request dialog, progress report (02 phase 2).
- [ ] **B.4** Docs, E2E: reminder reaches the guardian's inbox; guardian request approved.

## Risks and out of scope

- The biggest risk is an access hole: every new student-data endpoint from now on needs a guardian
  decision. Add a line to `backend/AGENTS.md` and to the PR checklist; the matrix test enforces it.
- Admin still sees no guardian names (IDs only).
- Messages parent ↔ teacher, payments by the parent online — out of scope.
