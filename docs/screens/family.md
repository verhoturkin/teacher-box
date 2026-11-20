# Family cabinet

Routes under `/family/:studentId` (453.2, ADR-0069): a parent reads one child's data at a time, the
child is in the address. Nothing here writes; the parent's notices and change requests come in
454.3.

## Routes and scope

- `/family` (`firstChildGuard`, `core/family/family.guards.ts`) leads to the first child of
  `GET /api/guardian/children` (`core/family/family.ts`, `Family`: once per sign-in). With no
  current child it stays on the frameless `core/pages/no-children.ts` («Нет учеников», «Выйти»).
- `/family/:studentId` (`familyChildGuard`) opens only a current child of the parent and makes it
  `Family.current`; another id leads back to `/family`. The server checks the same (404).
- The route provides `API_SCOPE` (`core/http/api-scope.ts`, `familyScope`): the base of the
  requests `/api/guardian/students/<id>`, the base of the links `/family/<id>`, the parent's feed
  `/api/guardian/schedule/feed` and `readOnly`. Its child route `FAMILY_ROUTES`
  (`features/home/family.routes.ts`) provides its own `ScheduleApi`, `HomeworkApi`, `BillingApi`,
  which read the scope, and opens the student's pages — no page is copied. The student's cabinet
  keeps the default scope (`/api/me`, `/cabinet`).
- Help (`/family/<id>/help`) shows the student's articles until the parent's own come (455.1);
  account (`/family/<id>/account`) is `AccountPage`.

## Frame

`core/layout/family-layout.ts`: the student's shell with Главная · Расписание · Задания · Оплаты
(no Материалы: bound textbooks open from the task), Справка and Мой аккаунт in the bottom group;
*ours*: no bell until 454.3, no counter on Задания. Another child rebuilds the shell and its
pages, so nothing of the previous child stays.

**Child switcher** (`core/layout/child-switcher.ts`, projected into the top strip of `Shell`):
none for one child. **M3**: chips 32 dp, 8 dp corners, `label large`, a leading 24 dp avatar (4 dp
before, 8 dp after); unselected `outline variant` + `on surface variant`, selected
`secondary container`. *Ours*: the avatar takes the place of the check; the children get palette
colours by order three steps apart (the teacher's colours do not reach a parent); on compact one
chip of the current child opens a menu of all children. A chip keeps the section and drops the
task (`/family/<a>/homework/<t>` → `/family/<b>/homework`).

## Pages in read-only mode

- **Home** (`student-home.ts`): the child's name as the title; the hero without the lesson link,
  boards, call presence and requests; due and reviewed tasks; the balance always. No welcome,
  messenger or push cards.
- **Schedule** (`my-schedule-page.ts`): lessons, history and the lesson sheet without the link of
  the call, «Перенести или отменить» and «Отозвать»; no requests or teacher's busy time are read.
  The calendar link is the parent's one of all the children («Занятия всех ваших детей…»).
- **Homework** (`my-homework-page.ts`, `my-task-page.ts`, `quiz-section.ts`): the task, materials,
  answers («Ответ») and the teacher's comments; no answer form, draft, board or «Начать тест».
- **Payments** (`my-billing-page.ts`): the child's ledger and receipts.

## Student with hidden payments

When the teacher hides the payments from the student (452.3), `PaymentsVisibility`
(`core/layout/payments-visibility.ts`, `GET /api/me/billing/visible`, once per sign-in, shown
until known) drops «Оплаты» from the student's menu, the balance and the «Оплаты» line of the
welcome card from the home page; `/cabinet/billing` leads to `/cabinet`.
