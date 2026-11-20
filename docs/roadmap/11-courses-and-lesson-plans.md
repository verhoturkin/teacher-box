# 11. Courses, lesson plans, homework bank, period summary

Status: proposal (2026-11-20), «Decisions for the teacher» open. Size: XL (two releases). ADRs:
yes — 0071 «Курсы и планы уроков» (where courses and plans live, the lesson as the hub of its
plan and homework), 0072 «ИИ читает журнал периода» (`ai` → `schedule::api`). Depends on: 02
(soft — the facts block of the period summary is its stage B).

## Goal

The teacher prepares and reviews work around **lessons**, grouped by **course**:

1. Materials (textbooks, plans, homework) are grouped by course.
2. A student has the course they are studying now.
3. A lesson has a plan: a Markdown text with textbook pages (from the course's textbooks when
   there is a course). The AI drafts a plan from a request, the student's tags and materials.
   Every saved plan stays in the bank for reuse.
4. Homework belongs to a course and to the lesson where it was given; it is created from a held
   lesson in one tap or linked to a lesson; every new assignment is in the bank for reuse.
5. The AI summarizes a student's period: what was covered, what was done, successes, difficulties.

## Principles

- **One owner per fact.** Each table below is the only place the fact is written; other modules
  hold its UUID at most and read it through the owner's `api`.
- **The lesson is the hub.** What belongs to a lesson (its plan, its homework) is a link the
  `schedule` module keeps, next to the lesson. Content stays where it is today: plans with the
  materials, assignments in `homework`. So series edits, moves and deletion handle links in one
  place (see «Why the links live in schedule»).
- **No new business module.** Courses and plans join the `textbooks` module (UI «Материалы»):
  every module that needs them already depends on `textbooks::api`, and the existing free-text
  `textbooks.course` becomes the course entity with a plain SQL migration inside one schema. The
  Java package and schema keep the name `textbooks` (a rename is churn with no user value).
- **Reuse, don't invent.** Plans reuse the homework Markdown field and «Привязать учебник» dialog,
  the AI reuses `DraftSources`, student context (ADR-0055) and system prompts (ADR-0043); the bank
  is a view of existing rows, not a second copy.

## Glossary (new terms, ru / en)

| ru | en | Meaning |
|---|---|---|
| Курс | Course | A named programme, e.g. «Английский A2», «ОГЭ математика». |
| Текущий курс | Current course | The course a student studies now; at most one. |
| План урока | Lesson plan | Teacher's Markdown plan with textbook pages; teacher-only. |
| Банк | Bank | Plans and original assignments for reuse, in «Материалы». |
| Итоги периода | Period summary | AI draft about a student's period. |

## Entities and owners

| Fact | Owner | Storage | Notes |
|---|---|---|---|
| Course | `textbooks` | `courses (id, name 1–100 unique ci, position, version)` | Delete → links cleared. |
| Textbook's course | `textbooks` | `textbooks.course_id` (null = none) | Replaces free-text `course`. |
| Student's current course | `textbooks` | `student_courses (student_id PK, course_id)` | One per student (Q1). |
| Lesson plan | `textbooks` | `lesson_plans (id, title 1–200, body ≤ 20 000 Markdown, course_id, created_at, updated_at, version)` | Teacher-only. |
| Plan's textbook pages | `textbooks` | `lesson_plan_textbooks (plan_id, textbook_id, pages)` | Same rules as `assignment_textbooks` (`PageRanges`). |
| Assignment's course | `homework` | `assignments.course_id` | Checked by `textbooks::api.Courses`. |
| Assignment's origin | `homework` | `assignments.source_id` (null = original) | Set by copy; always the root original. |
| Lesson's plan | `schedule` | `lessons.plan_id` (null = none) | One plan per lesson; one plan may serve many lessons (Q3). |
| Lesson's homework | `schedule` | `lesson_assignments (lesson_id, assignment_id, position)` | Many per lesson; an assignment is linked to ≤ 1 lesson. |
| Period summary | — | not stored (Q5) | An AI draft like every other. |

The bank is not a table: **plans** — all `lesson_plans`; **homework** — assignments with
`source_id is null` (originals), each showing how many copies were made from it. A copy made with
«Использовать» is an ordinary assignment with its own students, deadline and answers; editing it
never changes the original.

### Why the links live in schedule

`ScheduleService.stop` → `LessonRepository.deleteUntouchedOfSeries` deletes future untouched
occurrences when a series is edited «this and following» and creates new ones with new ids. A link
kept outside `schedule` (`assignments.lesson_id`, `lesson_plans.lesson_id`) would silently point to
a deleted lesson. With the link in `lessons` / `lesson_assignments`, the predicate gets
`and plan_id is null and id not in (select lesson_id from schedule.lesson_assignments)`: a
prepared lesson counts as touched and is kept, like a charged one. Moving a lesson keeps its links;
deleting a lesson drops its links (the plan and assignments stay in the bank).

The ids are opaque to `schedule`, as `assignments.board_id` is to `homework` (ADR-0041): no new
backend dependency. A deleted plan or assignment leaves a dangling id that every read skips
(`LessonPlans.find(ids)` and `Assignments.find(ids)` skip missing rows, as `Textbooks.find` does).

## Module dependencies

| Module | Today | After |
|---|---|---|
| `textbooks` | `shared`, `identity::api` | unchanged (courses, plans added inside) |
| `homework` | `shared`, `identity::api`, `textbooks::api` | unchanged (`Courses` for `course_id`) |
| `schedule` | `shared`, `identity::api`, `meetings::api` | unchanged (plan / assignment ids are opaque) |
| `ai` | `shared`, `textbooks::api`, `homework::api` | **+ `schedule::api`** (read facade `LessonJournal`, ADR-0072) |

No cycle: `schedule` depends on none of `textbooks`, `homework`, `ai`.

Frontend directions (ADR-0058, `eslint.config.js` + `frontend/AGENTS.md`): **`schedule` →
`textbooks`** (the lesson card shows the plan; `textbooks` imports only base and `boards`) and
**`textbooks` → `ai`** (the plan editor's AI pane; `ai` imports only base). `schedule` → `homework`
exists already.

## Contract

`textbooks::api` (new):

- `Courses`: `find(id)`, `find(ids)` → `CourseSummary (id, name)`; `ofStudent(studentId)`.
- `LessonPlans`: `find(ids)` → `LessonPlanView (id, title, body, courseId, textbooks [{id, title,
  pages}])`, deleted ones skipped.

`homework::api` (new or extended):

- `Assignments.find(ids)` → `AssignmentSummary` (existing record), deleted skipped.
- `HomeworkJournal.ofStudent(studentId, from, to)` → the student's tasks of assignments given in the
  period: title, given / due / handed-in dates, status, grade, the teacher's review comment, best
  quiz score. Shared with roadmap 02 stage B (`GET …/students/{id}/report`).

`schedule::api` (new):

- `LessonJournal.ofStudent(studentId, from, to)` → lessons in the period (instance time zone):
  start, title, topic, the student's outcome, summary, next plan, `planId`, `assignmentIds`. Shared with
  roadmap 02 stage B.

Events: none new. Course deletion is local (`textbooks`) plus `homework` clearing `course_id` — via
`textbooks::api.CourseDeleted` (`homework` already depends on `textbooks::api`), the only new event.

## REST

| Endpoint | Who |
|---|---|
| `GET/POST /api/teacher/textbooks/courses`, `PUT/DELETE …/courses/{id}` (`version`) | teacher |
| `PUT /api/teacher/textbooks/students/{studentId}/course {courseId \| null}` | teacher |
| Textbook create / update / views: `courseId` instead of `course` | teacher; student views keep `courseName` |
| `GET/POST /api/teacher/textbooks/plans`, `GET/PUT/DELETE …/plans/{id}`, `POST …/plans/{id}/copy` | teacher |
| Assignment create / update / views: `courseId`; views: `sourceId`, `copies` | teacher |
| `POST /api/teacher/homework/assignments/{id}/copy` — sets `sourceId` to the root original | teacher |
| `PUT /api/teacher/schedule/lessons/{id}/plan {planId \| null}` | teacher |
| `POST /api/teacher/schedule/lessons/{id}/homework {assignmentId}`, `DELETE …/homework/{assignmentId}` | teacher |
| Lesson details: `planId`, `assignmentIds` | teacher |
| `POST /api/teacher/ai/lesson-plan`, `POST /api/teacher/ai/period-summary` | teacher |

Links are saved without the lesson `version` (like the summary): they never conflict with time
edits. A cancelled lesson takes no new links. An assignment already linked to another lesson →
409 `schedule.assignment-linked` (move = unlink + link). `STUDENT`, `GUARDIAN`, `ADMIN`: 403 on all
of the above; role tests in `EndpointRolesTest`. Logs: ids only.

The student's cabinet does not change in v1: no course, no plans (YAGNI, Q6).

## AI

**Lesson plan draft** — feature `LESSON_PLAN` (`system_prompts` enum, resource
`lesson-plan.system.v1`, user prompt `lesson-plan.user.v1`):

- Request `{prompt ≤ 4000, courseName?, lesson? {topic, previousSummary, previousNextPlan},
  sources?, context?, modelId?}` — JSON or `multipart/form-data` exactly as `homework-draft`
  (`DraftSources`: up to 5 textbook pages / files, 20 pages, 20 MB). `context` — the recipients'
  AI tags (ADR-0055), sent by the frontend. The lesson texts come from the frontend (as for
  `lesson-summary`), so this feature needs no new dependency.
- Answer `{title, body, textbooks: [{source, pages}]}`: `source` — the index of a given textbook
  source; pages validated by `PageRanges` and the source's own page range; invalid ones dropped.
  The AI cannot point at a textbook it was not given.
- A draft: shown in the plan editor, saved only when the teacher saves the plan.

**Period summary** — feature `PERIOD_SUMMARY` (ADR-0072):

- Request `{studentId, from, to, prompt?, context?, modelId?}`; period ≤ 6 months.
- `ai` gathers the data on the server: `LessonJournal.ofStudent` → `LessonPlans.find(planIds)`
  (titles and pages, not bodies) → `HomeworkJournal.ofStudent`. Texts cut to fixed budgets (lesson summary
  1000, review comment 500, at most 60 lessons and 60 tasks — newest kept), all as data between
  tags. Why not from the frontend (as `lesson-summary` does): the server already has everything,
  the payload is large, and the token limit is enforced here anyway.
- Answer `{summary}` — Markdown with fixed sections: «Что прошли», «Задания», «Получается»,
  «Трудности», «Что дальше». `ai.requests` keeps metadata only.

## Frontend

**«Материалы»** (`features/materials`): tabs «Учебники · Планы · Задания · Доски» (Q4); one
course filter for all tabs (`?course=`, chips «Все · A2 · B1 · Без курса»), its «⋮» opens
«Курсы» (a list dialog: add, rename, reorder, delete with danger confirmation). New feeds:
`LessonPlansFeed` (`@features/textbooks/parts`), `HomeworkBankFeed` (`@features/homework/parts`,
originals only, «Использовано 3 раза», action «Использовать» → copy → editor). The textbook dialog
gets a «Курс» select instead of the free-text field.

**Plan editor** (`textbooks/teacher/lesson-plan-editor-page.ts`, `/teacher/materials/plans/new`,
`…/plans/:id`): title, «Курс», the Markdown field, textbook pages (the picker shows the course's
textbooks when a course is set, else all), the AI pane. DRY: `bind-textbook-dialog.ts` and the
Markdown field move from `homework` to `@features/textbooks/parts` / `shared/` and both editors use
them. «Сделать копию» in «⋮» for a plan used by several lessons. Autosave as the homework draft.

**Lesson card** (`schedule/ui/lesson-card.ts`, teacher only) — two sections above the summary:

- «План»: empty — «Составить», «Из банка», «С ИИ» (hidden without AI); filled — title, textbook
  pages, «Открыть», «⋮» «Заменить» / «Убрать из урока». «Составить» / «С ИИ» open the editor with
  `?lessonId=`, prefilled course (lesson student's current course), AI context (the student's AI
  tags, topic, previous lesson's summary and next plan); on save the route links the plan.
- «Домашнее задание»: linked assignments (title, status); «Задать» opens the homework editor with
  `?lessonId=` — students = the lesson's participants, course = the plan's or the student's,
  textbook pages = the plan's (removable chips), deadline = the next lesson (existing `next-lesson.ts`); AI
  context adds the topic, plan and summary. «Привязать» — a picker of the participants' recent
  unlinked assignments plus «Из банка» (copy for these students).
- The editor stays a `homework` page; the route (`app.routes.ts`) passes it the lesson input and a
  `linkToLesson(assignmentId)` callback from schedule data-access (ADR-0058 composition, as
  `upcomingLessons` today).
- The lesson summary AI draft sends the titles of the linked assignments instead of «that day's
  assignments of the lesson's students» (the *ours* note in `docs/screens/schedule.md` goes away).

**Student card** (`features/students`): Profile — «Курс» select (writes `student_courses`); header
— the course chip. A new action «Итоги за период» → `/teacher/students/:id/summary?from&to`:
period picker (last full month by default), the facts block (roadmap 02 stage B endpoints: lessons
held / missed, topics, homework given / handed in on time / accepted / returned), «Составить с ИИ»
→ the Markdown draft, editable, «Копировать» and print.

Every UI change goes through the `m3-expressive` skill; new texts in `ru.ts` and `en.ts`; gallery
samples for new shared parts (ADR-0059); wiki pages and help articles in every language.

## Migration

- `textbooks/V?__courses.sql`: `courses` from the distinct trimmed non-blank `textbooks.course`
  (case-insensitive, first spelling wins, position by name), `textbooks.course_id` filled, `course`
  dropped. Other tables new and empty. All new tables are in the full reset and the backup (DB).
- `homework/V?__assignment_course_and_source.sql`, `schedule/V?__lesson_links.sql`.

## Decisions for the teacher

1. **Current course:** one per student (proposed) or several (e.g. English and maths)? Does a
   **group** get a course too (proposed: yes, `group_courses`, used by group lessons for the plan
   and homework defaults)?
2. **Course and access:** does a course open its textbooks to its students? Proposed: an explicit
   third member kind of a textbook «Ученики курса» in the existing member picker (dynamic, like a
   group), not automatic for every textbook of the course.
3. **One plan for many lessons:** proposed — a plan from the bank is linked as is (editing it
   changes it for every lesson that uses it, «Сделать копию» to diverge); alternative — every
   «Из банка» makes a copy (like homework). Plans have no per-student state, so sharing is safe.
4. **Homework bank place:** proposed — a tab «Задания» in «Материалы» next to the plans (the
   «Задания» section keeps issued work, review and the journal); alternative — a «Банк» view inside
   the «Задания» section.
5. **Period summary:** a draft to copy and print (proposed for v1), or saved and sent to the
   student / parent (needs an owner module, storage and roadmap 02 phase 2)? Only individual
   students in v1, groups later?
6. **Plans for students:** teacher-only (proposed) or shown to the lesson's students?

## Stages

### A — Courses (B, F) · release 1

- [ ] **A.1** **B** *complex* — ADR-0071; `textbooks` courses, `student_courses`, migration from
  free text, `Courses` facade, `CourseDeleted`, REST and role tests; `homework.course_id`.
- [ ] **A.2** **F** *complex* — course filter and «Курсы» dialog in «Материалы», textbook dialog
  «Курс», student card «Курс»; homework editor «Курс»; wiki, help.

### B — Lesson plans (B, F) · release 1

- [ ] **B.1** **B** *complex* — `lesson_plans`, `lesson_plan_textbooks`, `LessonPlans`, REST
  (incl. copy); `schedule` `lessons.plan_id`, `PUT …/plan`, protection in
  `deleteUntouchedOfSeries`, tests for a series edit keeping a prepared lesson.
- [ ] **B.2** **F** *complex* — move `bind-textbook-dialog` and the Markdown field; plan editor;
  «Планы» tab; lesson card «План»; ESLint direction `schedule` → `textbooks`, `textbooks` → `ai`.

### C — Homework and lessons, homework bank (B, F) · release 1

- [ ] **C.1** **B** *complex* — `assignments.source_id`, copy to the root, `copies`;
  `lesson_assignments`, link / unlink endpoints, protection, `Assignments.find`.
- [ ] **C.2** **F** *complex* — lesson card «Домашнее задание» (create from lesson, link), editor
  prefill and `linkToLesson`, «Задания» bank tab, lesson summary draft over linked assignments.

### D — AI lesson plan (B, F) · release 2

- [ ] **D.1** **B** *complex* — `LESSON_PLAN` feature, prompts, answer validation, tests on
  `FakeProvider`.
- [ ] **D.2** **F** *simple* — AI pane in the plan editor and «С ИИ» in the lesson card.

### E — Period summary (B, F) · release 2

- [ ] **E.1** **B** *complex* — ADR-0072; `LessonJournal`, `HomeworkJournal` (with roadmap 02
  stage B report endpoints), `PERIOD_SUMMARY`, budgets, tests incl. the time-zone boundary.
- [ ] **E.2** **F** *complex* — student «Итоги за период» page, facts block, AI draft, print.

### F — Release

- [ ] **F.1** *simple* — E2E (course → plan → lesson → homework from lesson → summary on the AI
  mock), help articles, `docs/modules/*.md`, `docs/screens*.md`, glossary, CHANGELOG (skill
  `release`).

## Risks and out of scope

- A plan shared by many lessons shows its current text on past lessons; the lesson summary stays
  the record of what happened.
- Out of scope: course syllabus / ordered topics, course progress percentages, automatic plan
  generation for a whole series, student-facing plans, sending the period summary.
