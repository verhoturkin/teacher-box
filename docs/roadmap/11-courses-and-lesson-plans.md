# 11. Courses, lesson plans, videos, bank, period summary

Status: **decided 2026-11-20**; v0.60.0 (stages 459–463) released —
[`archive/plans/v0.60.0.md`](../archive/plans/v0.60.0.md); v0.61.0 (stages 464–466) scheduled in
[`PLAN.md`](../PLAN.md). This file is the design spec both releases build from; the release
of v0.61.0 moves its facts into `docs/modules/*.md`, ADR-0071 and ADR-0072 and deletes it. ADRs:
0071 «Курсы, планы уроков и банк» (courses and plans in `textbooks`, the lesson as the hub of its
plan and homework, the bank), 0072 «ИИ читает журнал периода» (`ai` → `schedule::api`).

## Goal

The teacher prepares and reviews work around **lessons**, grouped by **course**:

1. Materials (textbooks, plans, homework) are grouped by course.
2. A student and a group have the course they study now (one each).
3. A lesson has a plan: a Markdown text with textbook pages (from the course's textbooks when there
   is a course) and videos by link. The lesson's students see it.
4. Homework belongs to a course and to the lesson where it was given; it is created from a lesson
   in one tap or linked to one.
5. A **bank** keeps the originals of plans and assignments for reuse; using one always makes a copy.
6. A YouTube video added to a plan or an assignment gets its transcript at once, in the video's
   original language, with a way to pick another language.
7. (v0.61.0) The AI drafts plans and summarizes a student's period.

## Principles

- **One owner per fact.** Each table below is the only place the fact is written; other modules
  hold its UUID at most and read it through the owner's `api`.
- **The lesson is the hub.** What belongs to a lesson (its plan, its homework) is a link the
  `schedule` module keeps next to the lesson; content stays with its owner (plans in `textbooks`,
  assignments in `homework`). Series edits, moves and deletion handle links in one place.
- **No new business module.** Courses and plans join `textbooks` (UI «Материалы»): every module
  that needs them already depends on `textbooks::api`, and the free-text `textbooks.course`
  becomes the course entity with a plain SQL migration inside one schema. The package and schema
  keep the name `textbooks` (a rename is churn with no user value).
- **Reuse, don't invent.** Plans reuse the homework Markdown field, «Привязать учебник», the video
  section and the copy logic; the AI reuses `DraftSources`, student context (ADR-0055) and system
  prompts (ADR-0043).

## Decisions (teacher, 2026-11-20)

1. One current course per student **and per group**.
2. A textbook can be shared with «Ученики курса» — a third member kind next to students and groups,
   dynamic like a group; a course does not open its textbooks by itself.
3. Using a plan or an assignment from the bank **always makes a copy**; the bank keeps only
   originals — never a plan on a lesson, never an issued assignment.
4. The bank lives in «Материалы» (tabs «Планы» and «Задания»).
5. Period summary: per student, not stored, not sent (groups and sending — later).
6. **Students see the plan** of their lesson.
7. Automatic transcripts — YouTube only; other hosts — pasted by hand.
8. «Показывать ученику» of a transcript stays off by default.

## Glossary (new terms, ru / en)

| ru | en | Meaning |
|---|---|---|
| Курс | Course | A named programme, e.g. «Английский A2», «ОГЭ математика». |
| Текущий курс | Current course | The course a student or a group studies now; at most one. |
| План урока | Lesson plan | Markdown plan with textbook pages and videos, on one lesson. |
| Банк | Bank | Originals of plans and assignments for reuse, in «Материалы». |
| Использовать | Use | Make a copy of a bank item for a lesson or for students. |
| Итоги периода | Period summary | AI draft about a student's period (v0.61.0). |

## Entities and owners

| Fact | Owner | Storage | Notes |
|---|---|---|---|
| Course | `textbooks` | `courses (id, name 1–100 unique ci, position, version)` | Delete → links cleared. |
| Textbook's course | `textbooks` | `textbooks.course_id` (null = none) | Replaces free-text `course`. |
| Current course | `textbooks` | `student_courses (student_id PK, course_id)`, `group_courses (group_id PK, course_id)` | One each. |
| Textbook shared with a course | `textbooks` | `textbook_members.member_type = COURSE` | Students of the course + members of its groups. |
| Lesson plan | `textbooks` | `lesson_plans (id, title 1–200, body ≤ 20 000, course_id, bank, source_id, created_at, updated_at, version)` | See «Bank». |
| Plan's textbook pages | `textbooks` | `lesson_plan_textbooks (plan_id, textbook_id, pages)` | Rules of `assignment_textbooks`. |
| Plan's videos | `textbooks` | `lesson_plan_videos` — the shape of `assignment_videos` | Up to 5, `transcript_shown` off by default. |
| Video rules, captions | `textbooks` (moved from `homework`) | code: `VideoLink`, `VideoCaptions`, `VideoTranscripts`, `youtube/` | One implementation. |
| Assignment's course | `homework` | `assignments.course_id` | Checked by `textbooks::api.Courses`. |
| Assignment in the bank | `homework` | `assignments.bank`, `assignments.source_id` | See «Bank». |
| Lesson's plan | `schedule` | `lessons.plan_id` (unique, null = none) | One plan per lesson, a plan on ≤ 1 lesson. |
| Lesson's homework | `schedule` | `lesson_assignments (lesson_id, assignment_id unique, position)` | Many per lesson. |
| Period summary | — | not stored | An AI draft like every other. |

## Bank

Two kinds of rows in `lesson_plans` and in `assignments`, told apart by `bank`:

- **Bank item** (`bank = true`) — content only: no lesson, no students, no tasks, no deadline, no
  board. Edited only in «Материалы»; editing it never changes a copy. The server refuses to give
  it out (409 `homework.bank-item`) or to put it on a lesson (409 `schedule.bank-item`).
- **Working item** (`bank = false`) — a plan on a lesson or an assignment for students, as today.
  `source_id` — the bank item it came from or was saved as (null — none).

How items get into the bank — **automatically, the first time a new item is finished**, so the
bank holds the finished version, not an empty draft:

- an assignment — at its first «Выдать» (the first tasks); a plan — at its first «Готово» in the
  plan editor. If the working item has no `source_id`, the server saves a bank copy (files get new
  `FileStorage` keys, as `AssignmentService.copy` does) and sets `source_id` to it. A working item
  that came from the bank already has `source_id` — nothing is added, so reuse never duplicates;
- created right in «Материалы» → «Создать» — the item is a bank item from the start;
- «Сохранить в банк» / «Обновить в банке» («⋮» of a working item): no original (never saved, or
  deleted) — a new one; else the original's content is replaced by this item's (confirmation).
  Existing assignments enter the bank only this way — the migration puts nothing there.

How items leave it: «Использовать» (`POST …/{id}/use`) makes a working copy (`source_id` = the bank
item): a plan — on the given lesson; an assignment — a draft for the given students (then the
usual editor and «Выдать»). Deleting a bank item keeps its copies (their `source_id` becomes null).
The bank lists show «Использовано N раз» (working items with this `source_id`).

## Why the links live in schedule

`ScheduleService.stop` → `LessonRepository.deleteUntouchedOfSeries` deletes future untouched
occurrences when a series is edited «this and following» and creates new ones with new ids. A link
kept outside `schedule` would point to a deleted lesson. With the link in `lessons` /
`lesson_assignments`, the predicate gets `and plan_id is null and id not in (select lesson_id from
schedule.lesson_assignments)`: a prepared lesson counts as touched and is kept, like a charged one.
Moving a lesson keeps its links. Deleting a lesson deletes its links; assignments stay, and its
working plan stays as an orphan row no list shows (`textbooks` cannot listen to `schedule` events —
`schedule` depends on `textbooks::api`, so that would close a cycle; a facade call may only read).
«Убрать из урока» unlinks and then deletes the working plan by its own endpoint.

`schedule` checks a link when it is made through `textbooks::api.LessonPlans` and
`homework::api.Assignments` (exists, not a bank item, not on another lesson); later deletions leave
a dangling id that every read skips.

## Videos and automatic transcripts

Today (ADR-0047) an assignment keeps up to 5 videos with a transcript, and the teacher fetches
YouTube captions by hand: «Субтитры YouTube» → a list of tracks → one is taken.

- **One implementation.** `VideoLink`, `VideoCaptions`, `VideoTranscripts` and `youtube/` move
  from `homework` to `textbooks` and are published in `textbooks::api`; `homework` keeps
  `assignment_videos` and calls the api (no new edge). Endpoints move to
  `POST /api/teacher/textbooks/videos/captions` and `…/videos/transcript` (same bodies, same
  `video.*` errors). `TEACHERBOX_HOMEWORK_YOUTUBE_PROXY` keeps its name (existing `.env` files keep
  working); its catalog text says it serves plans too.
- **Automatic, original language.** When a YouTube link is added or changed and the transcript is
  empty, the editor calls `…/videos/transcript {url}` without a language: the server takes the
  suggested track — the author's track in the spoken language, else the recognized one (always in
  the spoken language), else the first. One request, no menu. The tile shows «Субтитры: английский,
  автоматические · Сменить язык»; «Сменить язык» lists the tracks (`…/videos/captions`) and
  replaces the transcript, asking first when the teacher has edited it (`replacing`).
- **Never silently overwritten.** A non-empty transcript is never refetched: not on load, not on a
  copy, not when a plan's videos go into homework (they carry their transcripts). No captions or a
  failure — a quiet note under the tile («У видео нет субтитров» / «Не удалось получить субтитры ·
  Повторить»), never a toast; pasting by hand stays.
- **Visibility.** Students see a transcript only with «Показывать ученику» (off by default) — in
  homework and in plans alike. Other hosts: a player or a link, the transcript by hand.

## Module dependencies

| Module | Today | After |
|---|---|---|
| `textbooks` | `shared`, `identity::api` | unchanged |
| `homework` | `shared`, `identity::api`, `textbooks::api` | unchanged |
| `schedule` | `shared`, `identity::api`, `meetings::api` | **+ `textbooks::api`, `homework::api`** (link checks, the student's plan) |
| `ai` (v0.61.0) | `shared`, `textbooks::api`, `homework::api` | **+ `schedule::api`** (`LessonJournal`, ADR-0072) |

No cycle: `textbooks` and `homework` depend on no `schedule`; `billing` → `schedule` stays.
Frontend directions (ADR-0058, `eslint.config.js` + `frontend/AGENTS.md`): **`schedule` →
`textbooks`** (the lesson card shows the plan) in v0.60.0, **`textbooks` → `ai`** (the plan
editor's AI pane) in v0.61.0. `schedule` → `homework` exists.

## Contract

`textbooks::api`:

- `Courses`: `find(id)`, `find(ids)` → `CourseSummary (id, name)`; `ofStudent`, `ofGroup`;
  event `CourseDeleted(courseId)` (`homework` clears `assignments.course_id`).
- `LessonPlans`: `find(ids)` → `LessonPlanView (id, title, body, courseId, bank, textbooks [{id,
  title, kind, format, pages}], videos [...])`, deleted skipped; `checkLinkable(id)`.
- Videos: `VideoLink.parse`, `VideoTranscripts.tracks(url)`, `VideoTranscripts.transcript(url,
  language?, automatic)`.

`homework::api`: `Assignments.find(ids)` → `AssignmentSummary` (+ `bank`), `checkLinkable(id)`;
(v0.61.0) `HomeworkJournal.ofStudent(studentId, from, to)`.

`schedule::api` (v0.61.0): `LessonJournal.ofStudent(studentId, from, to)` — lessons in the period
(instance time zone): start, title, topic, the student's outcome, summary, next plan, `planId`,
`assignmentIds`.

## REST (v0.60.0)

| Endpoint | Who |
|---|---|
| `GET/POST /api/teacher/textbooks/courses`, `PUT/DELETE …/courses/{id}` (`version`) | teacher |
| `PUT /api/teacher/textbooks/students/{studentId}/course`, `PUT …/groups/{groupId}/course` `{courseId \| null}`; `GET …/course-links` (all of them) | teacher |
| Textbooks: `courseId` instead of `course`, `courseIds` among the members | teacher; student views keep `courseName` |
| `GET/POST /api/teacher/textbooks/plans` (`?bank=true` — the bank), `GET/PUT/DELETE …/plans/{id}`, `POST …/{id}/finish` («Готово»), `POST …/{id}/bank` (save / update the original), `POST …/{id}/use {lessonId}` | teacher |
| Assignments: `courseId`, `bank`, `sourceId`, `uses`; `POST …/assignments/{id}/bank`, `POST …/{id}/use {studentIds}` | teacher |
| `PUT /api/teacher/schedule/lessons/{id}/plan {planId \| null}`, `POST …/lessons/{id}/homework {assignmentId}`, `DELETE …/homework/{assignmentId}`; lesson details: `planId`, `assignmentIds` | teacher |
| `GET /api/me/schedule/lessons/{id}/plan`, `GET …/plan/textbooks/{textbookId}` (the bound pages, as homework does) | student of the lesson |
| `GET /api/guardian/students/{studentId}/schedule/lessons/{id}/plan`, `…/plan/textbooks/{textbookId}` | guardian (`GuardianAccess.require`, ADR-0069) |

Links are saved without the lesson `version` (as the summary): they never conflict with time
edits. A cancelled lesson takes no new links; an assignment on another lesson — 409
`schedule.assignment-linked`. Another student's lesson → 404. `ADMIN` — none. Every new endpoint
goes into `EndpointRolesTest`. Logs: ids only.

## Frontend (v0.60.0)

- **«Материалы»** (`features/materials`): tabs «Учебники · Планы · Задания · Доски»; one course
  filter for all tabs (`?course=`, chips «Все · A2 · B1 · Без курса»), its «⋮» opens «Курсы» (add,
  rename, reorder, delete with danger confirmation). Feeds `LessonPlansFeed`
  (`@features/textbooks/parts`) and `HomeworkBankFeed` (`@features/homework/parts`) list bank items:
  «Использовано N раз», «Создать», «Изменить», «Удалить…». The textbook dialog: «Курс» select;
  the member picker gets courses.
- **Plan editor** (`textbooks/teacher/lesson-plan-editor-page.ts`, `/teacher/materials/plans/new`,
  `…/plans/:id`): title, «Курс», the Markdown field, textbook pages (the course's textbooks when a
  course is set, else all), videos; autosave; «Готово» (finish). «⋮»: «Сохранить в банк» /
  «Обновить в банке». DRY: `bind-textbook-dialog.ts`, the video parts (`video-section.ts`,
  `video-links.ts`, `video-list.ts`, the caption calls of `homework-api.ts`) and the Markdown field
  move from `homework` to `@features/textbooks/parts` / `shared/`.
- **Lesson card** (`schedule/ui/lesson-card.ts`), two sections above the summary:
  - «План» (teacher): empty — «Составить», «Из банка»; filled — title, pages, videos, «Открыть»,
    «⋮» «Убрать из урока» (deletes the working copy). «Составить» opens the editor with
    `?lessonId=`, course prefilled (the group's or the student's), the route links it.
  - «План» (student, guardian): read-only — the text, textbook pages to open, videos with the
    player, transcripts only when shown.
  - «Домашнее задание» (teacher): linked assignments (title, status); «Задать» opens the homework
    editor with `?lessonId=` — students = participants, course = the plan's or the lesson's, the
    plan's textbook pages and videos with transcripts (removable chips), deadline = the next lesson
    (`next-lesson.ts`); «Привязать» — recent unlinked assignments of the participants and «Из
    банка» (use → draft for them). The route (`app.routes.ts`) passes the editor the lesson input
    and `linkToLesson(assignmentId)` from schedule data-access (ADR-0058, as `upcomingLessons`).
  - The lesson summary AI draft sends the titles of the linked assignments instead of that day's
    assignments (the *ours* note in `docs/screens/schedule.md` goes away).
- **Student card / group**: «Курс» select (Profile; the group dialog), the course chip in the
  header.
- **Homework editor**: «Курс»; «Сохранить в банк» / «Обновить в банке» in «⋮».

Every UI change goes through the `m3-expressive` skill; texts in `ru.ts` and `en.ts`; gallery
samples for new shared parts (ADR-0059); wiki pages and help articles in every language.

## AI (v0.61.0)

**Lesson plan draft** — feature `LESSON_PLAN` (`system_prompts` enum, `lesson-plan.system.v1`,
`lesson-plan.user.v1`):

- Request `{prompt ≤ 4000, courseName?, lesson? {topic, previousSummary, previousNextPlan},
  sources?, context?, modelId?}` — JSON or `multipart/form-data` as `homework-draft`
  (`DraftSources`: up to 5 textbook pages / files / videos with transcripts, 20 pages, 20 MB).
  `context` — the recipients' AI tags (ADR-0055) from the frontend; lesson texts from the frontend.
- Answer `{title, body, textbooks: [{source, pages}]}`: `source` — the index of a given textbook
  source; pages checked by `PageRanges` and the source's range; invalid ones dropped.
- A draft: shown in the plan editor, saved only when the teacher saves.

**Period summary** — feature `PERIOD_SUMMARY` (ADR-0072):

- Request `{studentId, from, to, prompt?, context?, modelId?}`; period ≤ 6 months.
- `ai` gathers on the server: `LessonJournal.ofStudent` → `LessonPlans.find(planIds)` (titles,
  pages, video titles) → `HomeworkJournal.ofStudent`; budgets — lesson summary 1000, review
  comment 500, at most 60 lessons and 60 tasks (newest kept); all as data between tags.
- Answer `{summary}` — Markdown: «Что прошли», «Задания», «Получается», «Трудности», «Что дальше».
  `ai.requests` keeps metadata only.
- UI: student card action «Итоги за период» → `/teacher/students/:id/summary?from&to` — period
  (last full month by default), facts (roadmap 02 stage B endpoints: lessons held / missed,
  topics, homework given / on time / accepted / returned), «Составить с ИИ» → an editable draft,
  «Копировать», print.

## Migration

- `textbooks`: `courses` from the distinct trimmed non-blank `textbooks.course` (case-insensitive,
  first spelling wins, position by name), `course_id` filled, `course` dropped; new tables empty.
- `homework`: `course_id`, `bank` (false), `source_id`; `schedule`: `plan_id`,
  `lesson_assignments`. All new tables are in the full reset and in the backup (DB).

## Risks and out of scope

- YouTube may change the InnerTube answer (ADR-0047): automatic transcripts then fail quietly.
- A bank original updated from a working item replaces its content for future uses only.
- Out of scope: syllabus / ordered topics, course progress, plans for a whole series, sending the
  period summary, summaries of groups, speech recognition for other hosts.
