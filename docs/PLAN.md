# Teacher Box plan

Active plan only, in English. Completed releases — [`archive/plans/`](archive/plans/README.md);
don't read them unless the task needs history.

## How to use

- A release is a `## vX.Y.Z` section (or `## Next release` until the number is known): goals (2–5
  lines), new/changed ADRs, then stages.
- Stages are numbered globally, continuing from the archive. Substeps: `85.1`, `85.2`, … Tags: **B**
  backend, **F** frontend, **D** docker/infra.
- A substep names its entry points — files, classes, endpoints, routes
  (`schedule/teacher/lesson-details-dialog.ts`, `ScheduleService.cancel`) — so the work starts there
  instead of a repository search.
- Every new substep carries a complexity mark — *simple* (mechanical edit, docs, config) or
  *complex* (architecture, big refactor, subtle bug) — so the user or an orchestrating agent picks
  the model: smaller for simple, larger for complex. Several complex substeps do not share a
  session.
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next
  release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to
  Backlog. This file keeps only unreleased work and the Backlog.

## v0.58.0

Goals: a parent (role `GUARDIAN`, UI «Родитель») gets their own login from the teacher's invite,
sees everything the child sees — schedule, homework with texts, answers and the teacher's
comments, payments — read-only, for every child in one cabinet `/family`; gets the child's
notices (payments and debts, lesson reminders, overdue homework, reviewed works — each on by
default and switchable) in the inbox and messengers; asks to move or cancel a lesson on the
child's behalf. Roadmap [05](roadmap/05-parent-access.md), both of its releases in one.

Decisions (settled with the user 2026-11-19): one parent → several children, a student → at most
two parents; the student sees «Родитель: Анна» in «Мой аккаунт» and hides nothing in v1; the
parent sees all homework content, read-only; «Я оплатил» (invoices, 04) and the progress report
(02) are not built yet — out of scope; messages parent ↔ teacher — out of scope. Added the same
day: the teacher can hide payments from a student who has a parent (the parent pays) — a switch
on the student card; the student then sees no payments and gets no payment notices; an adult
student without parents is unaffected (451.3).

New ADR: 0069 «Родители (опекуны)» (450.1) — amends ADR-0003 (roles) and AGENTS.md §4.3. Changed
specs: `docs/modules/identity.md`, `schedule.md`, `homework.md`, `billing.md`,
`notifications.md`, `platform.md`; `docs/screens.md` (student card, student account, the new
«Family cabinet»); wiki new page `Parents`.

Rule for every substep: a guardian endpoint calls the same application service as the student's
`/api/me/**` one with the checked `studentId` — no copied logic; every guardian endpoint has a
test «guardian of another student → 404» and «student / teacher → 403».

Order: one substep per session, a commit each, pushed to the release branch; the PR is opened
once, after 455.

### 450. Guardian accounts

- [x] 450.1 *complex* B — ADR-0069 (row in `docs/adr/README.md`): role, guardianship, invite,
  access model «option A» of the roadmap (separate `/api/guardian/students/{studentId}/<module>/**`
  read endpoints, guard SPI; `/api/me/**` with an «acting as» header rejected). Code:
  `shared/security/Role.java` gains `GUARDIAN`; `CurrentUser.isGuardian()`; SPI
  `shared/security/GuardianAccess` (`void require(CurrentUser, UUID studentId)` — 404 when not
  the guardian of an active child; `List<UUID> children(UUID guardianId)`) implemented in
  `identity/application` like `PasswordConfirmationService`. Migration
  `db/migration/identity/V5__guardians.sql`: `ck_users_role` with `GUARDIAN`, table
  `guardianships (guardian_id, student_id, created_at)` (PK of both, at most two per student
  checked in the service). Invites: the teacher creates a parent from the student card — name
  → an inactive `GUARDIAN` user + `ACTIVATION` invite
  (`StudentAdminService`-like `GuardianAdminService`), or links an existing parent (sibling)
  without an invite; reissue invite; unlink (the last link removed → the parent is deactivated,
  refresh tokens revoked). Endpoints in a new `identity/web/GuardianAdminController`
  `/api/teacher/students/{id}/guardians` (GET, POST, POST `/{gid}/invite`, POST `/link`,
  DELETE `/{gid}`), `GET /api/teacher/guardians` (for «link existing»); the student's
  `GET /api/me/guardians` (names only); the parent's `GET /api/guardian/children`
  (`StudentSummary` of active children). `InviteService.describe/accept` handles a guardian
  invite (`InviteInfo` gains the role and children's first names). Login: a guardian with no
  active child is refused (`identity.guardian-no-students`); `StudentDeactivated` keeps the link
  but `GuardianAccess` hides the child. Facade `identity/api/Guardians` (`isGuardianOf`,
  `childrenOf`, `guardiansOf`); events `GuardianRegistered`, `GuardianLinked`,
  `GuardianUnlinked` in `identity/api`. `UserDirectory` resolves a guardian's name and language.
  Tests: service, controllers with role checks, invite accept, limit of two, deactivation,
  `ModularityTests`. Docs: `docs/modules/identity.md`, AGENTS.md §4.3 (the role row).
  *Done with these choices: an «active child» is a current one (invited or active, as
  `StudentSummary.isCurrent`); the `/api/guardian/**` → `GUARDIAN` URL rule is added now so that
  `/api/guardian/children` works — the `/api/me/**` subset and the matrix test stay in 450.2; a
  parent's invite reuses `invites` without a `kind` column (the role comes from the user);
  `GuardianUnlinked` carries `deactivated`; a parent of only deactivated children is also refused at
  refresh and on the invite page; accepting a parent's invite sends the teacher no notice yet
  (notices — 453.1); `StudentAdminService` and the new service share `InviteIssuer`.*
- [ ] 450.2 *complex* B — `platform/security/PlatformSecurityAutoConfiguration`: `/api/guardian/**`
  → `GUARDIAN`; the guardian also reaches `/api/me`, `/api/me/password`, `/api/me/language`,
  `/api/me/avatar`, `/api/me/notifications/**`, `/api/me/channels/**`, `/api/me/push/**` (if it
  exists) and nothing else under `/api/me/**`; `/api/**` stays `TEACHER`/`STUDENT`. A matrix test
  in `platform/security` walks every `RequestMappingHandlerMapping` handler and asserts the set of
  roles that pass the URL rules against a checked-in expectation, so a new endpoint without a
  guardian decision fails. Line in `backend/AGENTS.md`: every new student-data endpoint needs a
  guardian decision. Docs: `docs/modules/platform.md`.

### 451. Guardian read endpoints

- [ ] 451.1 *complex* B — schedule: `schedule/web/GuardianScheduleController`
  `/api/guardian/students/{studentId}/schedule` — the reads of `MyScheduleController` (settings,
  summary, lessons, lesson, history; no busy / free times) through `GuardianAccess.require`;
  the guardian's own ICS feed of all children's lessons (`/api/guardian/schedule/feed` GET / POST
  / DELETE, `FeedService` with a feed owned by the guardian, served by `PublicFeedController`,
  each event titled with the child's name). Tests: controller (another student → 404, roles),
  `FeedService`. Docs: `docs/modules/schedule.md`.
- [ ] 451.2 *complex* B — homework and billing: `homework/web/GuardianHomeworkController`
  `/api/guardian/students/{studentId}/homework` — summary, task, quiz (read-only review),
  attachments, bound textbook pages of `MyHomeworkController`; no submissions, no attempts.
  `billing/web/GuardianBillingController` `/api/guardian/students/{studentId}/billing` — summary,
  history, receipt of `MyBillingController` / `ReceiptController`. Tests as in 451.1. Docs:
  `docs/modules/homework.md`, `billing.md`.
- [ ] 451.3 *complex* B — payments hidden from the student: `billing` keeps a per-student flag
  «оплаты видит только родитель» (migration in `db/migration/billing/`, e.g. a column of
  `student_accounts`), effective only while the student has a guardian
  (`identity::api.Guardians`; the last guardian unlinked → the student sees payments again).
  Teacher: `PUT /api/teacher/students/{id}/billing/visibility` (or a field of the existing
  teacher billing student endpoint) and the flag in its read. Student: `/api/me/billing/**`
  (`MyBillingController`, `ReceiptController`) → 404 while hidden; a cheap
  `GET /api/me/billing/visible` (or a field of an existing `/api/me` read) so the frontend hides
  the section; the student's bot `PaymentsChatAction.availableTo` is false; payment and debt
  notices of `billing/notices` for a hidden student are marked guardians-only (a
  `NoticeRequested` field read by 453.1, so the student is skipped and guardians still get
  them). The guardian's endpoints of 451.2 are unaffected. Tests: the flag, 404 for the student,
  teacher role checks, no effect without a guardian. Docs: `docs/modules/billing.md`,
  ADR-0069.

### 452. Family cabinet (frontend)

- [ ] 452.1 *complex* F — `m3-expressive`. Teacher: the student card
  (`features/students/student-card.ts`, profile tab) gets a «Родители» block — up to two parents
  with their status (invited / active), «Пригласить родителя» (new or an existing parent),
  the invite link dialog (`invite-link-dialog.ts` reused), «Отвязать» with a confirm. Invite page
  `features/identity/invite/invite-page.ts`: the guardian variant («Вас пригласили как родителя
  Пети»). Student «Мой аккаунт»: «Родители: Анна». Role `GUARDIAN` in `core/auth`. Tests (Vitest)
  and the gallery sample if a new shared part appears. In the «Родители» block, while a parent
  is linked, the switch «Оплаты видит только родитель» (451.3). Docs: `docs/screens.md`, wiki
  `First-steps` / new `Parents`, help `teacher/*` (ru, en) about inviting a parent and hiding
  payments.
- [ ] 452.2 *complex* F — `m3-expressive`. Area `/family` in `app.routes.ts`
  (`roleGuard('GUARDIAN')`, a `FamilyLayout` beside `core/layout/student-layout.ts`): child
  switcher in the top bar (chips with the child's colour / avatar, the choice in the URL
  `/family/:studentId/...`, one child → no switcher), sections «Главная», «Расписание»,
  «Задания», «Оплаты», «Уведомления», «Справка», «Мой аккаунт». Pages reuse the student's
  widgets (`schedule/student/my-schedule-page.ts`, `homework/student/my-homework-page.ts`,
  `my-task-page.ts`, `billing/student/my-billing-page.ts`, `home/student-home.ts`) through their
  `parts.ts` with an `ApiScope` (student `/api/me/...` vs guardian
  `/api/guardian/students/{id}/...` base URL) and a read-only mode (no submit, no attempts, no
  change requests until 453.3). Login redirects a guardian to `/family`. Student cabinet with
  payments hidden (451.3): no «Оплаты» in the navigation, no balance on the student's home,
  `/cabinet/billing` redirects home. Tests (Vitest). Docs:
  `docs/screens.md` «Family cabinet», ADR-0058 note if the direction rules change.

### 453. Notices and requests for parents

- [ ] 453.1 *complex* B — `notifications`: a `NoticeRequested` for a student is also delivered to
  that student's guardians (`identity::api.Guardians`) by the guardian's preferences — four
  categories, on by default: payments and debts, lessons (reminders, cancels, moves), overdue
  homework, reviewed works (the kind → category map in `notifications`); the text names the child
  (a «Петя · » prefix from `UserDirectory`, or a guardian variant of the texts — decide and
  record in ADR-0069); the link points into `/family/<studentId>/...`. `mayUseMessengers` and
  link codes for a guardian; `ChatEngine.user` and `shared/chat/ChatUser` know a guardian. A
  guardians-only notice (451.3) skips the student. Tests: `NotificationServiceTest`,
  preferences, link codes. Docs: `docs/modules/notifications.md`, ADR-0061 note.
- [ ] 453.2 *complex* B — schedule: move / cancel requests on behalf — migration
  `db/migration/schedule/V8__change_requests_requested_by.sql` (`requested_by` UUID, the student
  for old rows), `GuardianScheduleController` POST / GET / DELETE requests via
  `ChangeRequestService`; the teacher's request list and notice say «запрос от родителя
  (Анна)»; the answer goes to the student and the guardian. Bot: guardian menu
  (`ChatSettingsService`) with «Расписание детей», «Баланс», «Перенести занятие» — chat actions in
  `schedule/chat`, `billing/chat`, child chosen when there are several. Tests: service,
  controller, chat actions. Docs: `docs/modules/schedule.md`, wiki `Messengers`.
- [ ] 453.3 *complex* F — `m3-expressive`. `/family` notifications: inbox, the four preferences,
  messenger linking (`features/notifications` parts reused); the change request dialog
  (`schedule/student/change-request-dialog.ts`) in the family schedule; the teacher's request row
  shows «от родителя». Tests (Vitest). Docs: `docs/screens.md`, wiki `Parents`,
  `Notifications` if it exists.

### 454. Docs and E2E

- [ ] 454.1 *simple* — wiki `docs/wiki/Parents.md` complete (+ `_Sidebar`, `Features`), help
  articles for the parent (`features/help/articles/guardian/`, ru and en, `help-topics.ts`) and
  `student/*` mention of parents; `docs/glossary.md` «Родитель»; check every spec listed in the
  goals is current.
- [ ] 454.2 *complex* — E2E `e2e/tests/family/`: the teacher invites a parent → the parent accepts
  and logs in → sees the child's lessons, homework and payments, cannot open another student's
  data (API 404) → asks to move a lesson → the teacher approves; a reminder reaches the parent's
  inbox; the teacher hides payments → the student no longer sees them, the parent still does.

### 455. Release 0.58.0

- [ ] 455.1 *simple* — skill `release`: help articles checked, E2E spec, CHANGELOG, version bump,
  plan archived; roadmap 05 row marked released. Push; the orchestrating session opens the draft
  PR.

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Left from 0.57.0 (449.1): the student card actions (3 buttons, 371 px) overflow a 375 px phone;
the schedule toolbar → calendar gap and the `.tb-ops` section margins are child margins, not the
parent's gap; lesson rows, student-side cards with data and the teacher homework / Materials lists
were measured only empty; «Позвать» and the tab ripple on touch were not checked live.

Decided against on 2026-11-15 (don't propose again without a new reason): `no-store` of homework
attachments stays (a shared computer must not keep files); one language of the dictionaries per
load; Caddy alone instead of Caddy in front of nginx; colours on the board list; times in the
portal time zone; search in the remaining long lists and list-detail for the review queue.
