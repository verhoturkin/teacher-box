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

## v0.61.0

Goals: the AI drafts a lesson plan from the request, the student's tags and the materials, and
summarizes a student's period. Starts only after the v0.60.0 PR is merged. Spec — roadmap/11 «AI
(v0.61.0)». New ADR: 0072 «ИИ читает журнал периода» (465.1).

### 464. AI lesson plan

- [x] 464.1 **B** *complex* — `ai`: feature `LESSON_PLAN` (enum migration, `SystemPrompts`,
  resources `lesson-plan.system.v1`, `lesson-plan.user.v1`), `POST /api/teacher/ai/lesson-plan`
  (JSON / multipart as `homework-draft`, `DraftSources` with videos, student context), the answer's
  textbook pages checked against the given sources; tests on `FakeProvider`; `docs/modules/ai.md`.
- [x] 464.2 **F** *simple* — direction `textbooks` → `ai`; the AI pane in the plan editor (as
  `features/ai/homework-ai-panel.ts`: sources — the plan's textbook pages and videos, context — the
  lesson students' AI tags, the lesson's topic and the previous summary); «С ИИ» in the lesson
  card's «План»; help.

### 465. Period summary

- [x] 465.1 **B** *complex* — ADR-0072; `schedule::api.LessonJournal`, `homework::api.HomeworkJournal`
  and the report endpoints of roadmap 02 stage B (`GET /api/teacher/schedule/students/{id}/report`,
  `…/homework/students/{id}/report`); `ai` → `schedule::api`; feature `PERIOD_SUMMARY`, `POST
  /api/teacher/ai/period-summary`, budgets; tests incl. the time-zone boundary of the period and
  group lessons; `docs/modules/*.md`.
- [x] 465.2 **F** *complex* — `/teacher/students/:id/summary?from&to` («Итоги за период» in the
  student card): period picker, facts (sections as feature parts), «Составить с ИИ», editable
  draft, «Копировать», print stylesheet; help, `docs/screens/students.md`.

### 466. UI review of 0.60.0

Decisions 9–15 of roadmap/11 «UI review of 0.60.0»; every interface change with `m3-expressive`.

- [x] 466.1 **F** *complex* — «Материалы» as list-detail (decisions 9–12): the course pane with
  inline create / rename / delete / reorder (drop `CoursesDialog`), the tabs «Учебники · Планы ·
  Задания» with one toolbar row (the textbook kind in a filter menu), one «Создать ▾» / FAB with
  the course prefilled, the icon `collections_bookmark`; «банк» → «шаблоны» in every UI text,
  help article (ru/en), wiki, `docs/glossary.md`, `docs/screens/materials.md`; the lesson card's
  «Из банка» → «Из шаблонов».
- [ ] 466.2 **F** *complex* — the lesson card by time with one-line rows for the plan and the
  homework (decision 13); «⋮» last in the homework editor header (decision 15); help, wiki,
  `docs/screens/schedule.md`, `docs/screens/homework.md`.
- [ ] 466.3 **B** **F** *complex* — «Прошли по плану» (decision 14): with a plan the summary's
  «Что прошли» holds only the deviations (hidden behind «Не всё по плану»); `LessonJournal` and
  the period-summary facts give the plan's title and the deviations; tests, `docs/modules/*.md`,
  help, wiki.

### 467. Release 0.61.0

- [ ] 467.1 *simple* — skill `release`: help, wiki, E2E (the AI mock drafts a plan and a summary),
  CHANGELOG 0.61.0, versions, archive; move the facts of roadmap/11 into the module docs and ADRs,
  delete it and mark row 11 of `roadmap/README.md` released.

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
