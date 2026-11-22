# Family cabinet

Routes under `/family/:studentId` (453.2, 454.3, ADR-0069): a parent reads one child's data at a
time, the child is in the address. The only things a parent writes are change requests on the
child's behalf and their own notification settings.

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
- Help (`/family/<id>/help`) shows the parent's own articles (area `guardian`: «Вход и дети», «Что видно родителю», «Перенос и отмена», «Уведомления», «Бот в мессенджере»); the «?» of a reused student's page opens the matching one (`guardianTopicOf`);
  account (`/family/<id>/account`) is `AccountPage` with «Уведомления» (below).
- `readOnly` of the scope means «the family cabinet»: no hand-in, attempts, call link, boards or
  call presence, and the texts speak of the child («Не придёт»). *Ours*: change requests are not
  a second flag — both cabinets ask, so the request code has no condition; the requests,
  `busy` and `free-times` go to the scope's base.

## Frame

`core/layout/family-layout.ts`: the student's shell with Главная · Расписание · Задания · Оплаты
(no Материалы: bound textbooks open from the task), Справка and Мой аккаунт in the bottom group;
the bell in the top strip; *ours*: no counter on Задания. Another child rebuilds the shell and its
pages, so nothing of the previous child stays.

**Bell and inbox** (454.3): the common bell and sheet of the frame (`/api/me/notifications/**`):
the parent's own inbox of all the children, each title «Петя · …»; a link opens the child's page
(`/family/<id>/schedule?lesson=<id>` opens the lesson, `homework/<taskId>`, `billing`).

**Child switcher** (`core/layout/child-switcher.ts`, projected into the top strip of `Shell`):
none for one child. **M3**: chips 32 dp, 8 dp corners, `label large`, a leading 24 dp avatar (4 dp
before, 8 dp after); unselected `outline variant` + `on surface variant`, selected
`secondary container`. *Ours*: the avatar takes the place of the check; the children get palette
colours by order three steps apart (the teacher's colours do not reach a parent); on compact one
chip of the current child opens a menu of all children. A chip keeps the section and drops the
task (`/family/<a>/homework/<t>` → `/family/<b>/homework`).

## Pages in read-only mode

- **Home** (`student-home.ts`): the child's name as the title; the hero without the lesson link,
  boards and call presence, with «Перенести» / «Отменить» («Не придёт» in a group); due and
  reviewed tasks; the balance always. No welcome card; the messenger card (its «Подключить» leads
  to `/family/<id>/account`) and the push card name the child's notices.
- **Schedule** (`my-schedule-page.ts`): lessons, history and the lesson sheet without the link of
  the call; «Перенести или отменить», «Отозвать» and the teacher's busy time as for the student.
  The section «Запросы» (not «Мои запросы») lists the child's requests; one a parent sent has a
  line «Запрос родителя (Анна)» — the student sees it too. The request dialog
  (`change-request-dialog.ts`) speaks of the child: «Не придёт на занятие», «пройдёт без ребёнка».
  The calendar link is the parent's one of all the children («Занятия всех ваших детей…»). The
  lesson sheet shows the child's «План урока» read-only
  (`/api/guardian/students/<id>/schedule/lessons/<id>/plan`, [schedule](schedule.md#lesson-plan)).
- **Homework** (`my-homework-page.ts`, `my-task-page.ts`, `quiz-section.ts`): the task, materials,
  answers («Ответ») and the teacher's comments; no answer form, draft, board or «Начать тест».
- **Payments** (`my-billing-page.ts`): the child's ledger and receipts.
- **Account → Уведомления** (`notifications-section.ts`, the role from `AuthService`): «Куда
  присылать» as for the student (messengers, push); «Что присылать» — the four categories of
  `GET|PUT /api/guardian/notifications/preferences` (Оплаты и долги, Занятия, Сроки заданий,
  Проверенные работы; switches, chips on medium) instead of the topics, then «Тихие часы». No
  «Сообщения учителя» row: the teacher's messages go to students. *Ours*: the parent's muted
  topics stay as they are and are not shown — a category already turns a kind off everywhere.

## Teacher's side

A request a parent sent (`RequestView.guardianId`) says so: «от родителя (Анна)» under the row of
«Запросы учеников» (`schedule-page.ts`) and after the name in the home queue (`todo-queue.ts`),
«Запрос родителя (Анна): Перенос…» in the lesson card (`lesson-card.ts`; in a group «Мария, от
родителя: …»), «Запрос родителя (Анна)» in the answer dialog; an unlinked parent has no name
(`fromParent` / `parentRequest`, `schedule-labels.ts`). «Настройки → Мессенджеры → Что умеет бот»
lists «Родителям» (`BotView.guardianMenu`).

## Student with hidden payments

When the teacher hides the payments from the student (452.3), `PaymentsVisibility`
(`core/layout/payments-visibility.ts`, `GET /api/me/billing/visible`, once per sign-in, shown
until known) drops «Оплаты» from the student's menu, the balance and the «Оплаты» line of the
welcome card from the home page; `/cabinet/billing` leads to `/cabinet`.
