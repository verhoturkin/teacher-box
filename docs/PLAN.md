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

## v0.60.0

Goals: voice answers and audio files of homework play in the deployed portal (458, done). Courses
group the materials; a lesson gets a plan its students see and the homework given at it; a bank
keeps the originals of plans and assignments, and using one makes a copy; a YouTube video gets its
transcript at once. Design spec — [`roadmap/11`](roadmap/11-courses-and-lesson-plans.md) (read the
section the substep names). New ADR: 0071 «Курсы, планы уроков и банк» (460.1).

### 458. Homework fixes

- [x] 458.1 **B D** *simple* — voice answers did not play: `homework/ui/voice-player.ts` plays a
  file from a `blob:` URL, and the CSP (`PlatformSecurityAutoConfiguration.CONTENT_SECURITY_POLICY`,
  `docker/nginx/security-headers.conf`) had no `media-src`, so `default-src 'self'` blocked it
  (`npm start` sends no CSP, so it played there). `media-src 'self' blob:` added to both;
  `PlatformSecurityIntegrationTest` checks it and that nginx sends the backend's policy.
- [x] 458.2 **B** *simple* — flaky `AvailabilityIntegrationTests` (409 instead of 201, by the date
  and the order of the classes): `UpcomingLessonsIntegrationTests` kept a weekly series at 12:00 in
  Moscow and a one-off lesson to 18:45, outside `Slots.SERIES_HOURS`, so a later future slot met
  them; they are at 13:00 and 17:00 now. `GroupLessonsIntegrationTests` moves a lesson to
  `Slots.next` instead of a day later at the same hour, for the same reason.

### 459. Videos in materials, automatic transcripts

- [x] 459.1 **B** *simple* — move `homework/domain/VideoLink`, `homework/application/VideoCaptions`,
  `VideoTranscripts` and `homework/youtube/` to `textbooks` (`api` for `VideoLink` and
  `VideoTranscripts`, the adapter inside); `POST /api/teacher/homework/videos/captions|transcript`
  → `/api/teacher/textbooks/videos/*` (same bodies and `video.*` errors); `AssignmentVideos` /
  `HomeworkViews` over the api; `SettingsCatalog` text of `TEACHERBOX_HOMEWORK_YOUTUBE_PROXY` (name
  kept); tests move with the code; `docs/modules/homework.md`, `textbooks.md`. Spec: roadmap/11
  «Videos and automatic transcripts».
- [x] 459.2 **F** *complex* — `homework/teacher/video-section.ts`, `ui/video-links.ts`,
  `ui/video-list.ts` and the caption calls of `homework-api.ts` move to `@features/textbooks/parts`;
  automatic transcript on adding / changing a YouTube link with an empty transcript (one
  `…/videos/transcript {url}`), the tile note «Субтитры: <язык>, автоматические · Сменить язык»
  (the tracks menu, `replacing` check), quiet notes with «Повторить», never an overwrite; help
  article of homework videos (ru, en), `docs/screens/homework.md`, wiki.

### 460. Courses

- [x] 460.1 **B** *complex* — ADR-0071 (Russian, row in `docs/adr/README.md`); `textbooks`
  migration: `courses`, `student_courses`, `group_courses`, `textbooks.course_id` from the free
  text, `member_type COURSE` (students of the course + members of its groups, current, in
  `TextbookAccess`); `textbooks::api.Courses`, `CourseDeleted`; REST `…/textbooks/courses`,
  `…/students/{id}/course`, `…/groups/{id}/course`, `…/course-links`; `homework.assignments.course_id`
  (checked by `Courses`, cleared on `CourseDeleted`), in create / update / views; role tests,
  `EndpointRolesTest`; `docs/modules/textbooks.md`, `homework.md`. Spec: roadmap/11 «Entities»,
  «Contract», «REST».
  *Done: `DELETE …/courses/{id}` takes no `version` (as a textbook's delete); student and group
  links answer 204; the textbook dialog lost its free-text «Курс» field and keeps `courseId` and
  the `COURSE` members as they are, the homework editor keeps `courseId` on an update — both get
  their «Курс» select in 460.2; error texts of the new codes are in the dictionaries.*
- [x] 460.2 **F** *complex* — course filter (`?course=`) and the «Курсы» dialog in
  `materials/materials-page.ts`; textbook dialog «Курс» select and courses in the member picker;
  «Курс» in the student card Profile (`features/students`) and the group dialog
  (`identity/parts`), chip in the card header; «Курс» in the homework editor; help, wiki,
  `docs/screens/materials.md`, `students.md`, glossary.
  *Done: the reorder needed `PUT …/courses/order {ids}` (backend, every course once, else 422
  `textbooks.course-order-invalid`); the group dialog is `students/groups/group-form-dialog.ts`
  (the course is set after the group is created) and Profile of both cards has the «Курс» card
  (`CurrentCourseCard`); no new shared component, so no gallery sample.*

### 461. Lesson plans

- [x] 461.1 **B** *complex* — `textbooks`: `lesson_plans` (`bank`, `source_id`),
  `lesson_plan_textbooks`, `lesson_plan_videos`; `LessonPlanService` — CRUD, `finish` (first
  «Готово» of an item without `source_id` saves the bank original), `bank` (save / update the
  original), `use {lessonId}` (a working copy), the bank list with `uses`; REST
  `/api/teacher/textbooks/plans/**`; `textbooks::api.LessonPlans` (`find`, `checkLinkable`); tests
  incl. «use never adds to the bank» and «a deleted original keeps its copies». Spec: roadmap/11
  «Bank».
  *Done: `checkLinkable` throws 404 `textbooks.plan-not-found` and 409 `textbooks.plan-in-bank`
  (461.2 may answer `schedule.bank-item` instead); `use` answers 201 `{lessonId, plan}` — the
  lesson id is only echoed, the link is made by 461.2; textbooks and videos are saved with the plan
  (`POST` / `PUT` carry the whole lists, ≤ 20 textbooks) instead of separate bind endpoints;
  `bank` of a bank item — 409 `textbooks.plan-in-bank`, `use` of a working plan — 409
  `textbooks.plan-not-in-bank`; a deleted course or textbook leaves its plans.*
- [ ] 461.2 **B** *complex* — `schedule`: `lessons.plan_id` (unique), `PUT
  /api/teacher/schedule/lessons/{id}/plan` (checked by `LessonPlans.checkLinkable`, no `version`,
  not on a cancelled lesson), `planId` in the details; `deleteUntouchedOfSeries` keeps prepared
  lessons (test: a «this and following» edit keeps the lesson with a plan); the student's
  `GET /api/me/schedule/lessons/{id}/plan` and `…/plan/textbooks/{tid}` (`Textbooks.content`), the
  guardian's under `/api/guardian/students/{sid}/schedule/...` (`GuardianAccess.require`); module
  dependency `schedule` → `textbooks::api` in `package-info.java`; «another student gets 404»
  tests, `EndpointRolesTest`; `docs/modules/schedule.md`.
- [ ] 461.3 **F** *complex* — move `homework/teacher/bind-textbook-dialog.ts` to
  `@features/textbooks/parts` and the Markdown field to `shared/`; plan editor
  `textbooks/teacher/lesson-plan-editor-page.ts` (`/teacher/materials/plans/new|:id`, autosave,
  «Готово», «Сохранить в банк» / «Обновить в банке», the course's textbooks, videos of 459.2);
  `LessonPlansFeed` — the «Планы» tab of «Материалы» (bank items, «Использовано N раз»); gallery
  samples; help, `docs/screens/materials.md`.
- [ ] 461.4 **F** *complex* — direction `schedule` → `textbooks` (`eslint.config.js`,
  `frontend/AGENTS.md`); «План» in `schedule/ui/lesson-card.ts`: teacher — «Составить» (editor with
  `?lessonId=`, the route links it), «Из банка» (use), «Открыть», «Убрать из урока»; student and
  guardian — read-only text, textbook pages, videos (transcripts only when shown); help (teacher,
  student), `docs/screens/schedule.md`, `cabinet.md`, `family.md`.

### 462. Homework at lessons, homework bank

- [ ] 462.1 **B** *complex* — `homework`: `assignments.bank`, `source_id`; the first «Выдать» of an
  assignment without `source_id` saves the bank original (files copied as `AssignmentService.copy`);
  `POST …/assignments/{id}/bank`, `POST …/{id}/use {studentIds}` (a draft), `bank` / `sourceId` /
  `uses` in the views; a bank item is never given out (409 `homework.bank-item`);
  `homework::api.Assignments` (`find`, `checkLinkable`). `schedule`: `lesson_assignments`, `POST /
  DELETE …/lessons/{id}/homework`, `assignmentIds` in the details, prepared-lesson protection,
  dependency `schedule` → `homework::api`; tests; `docs/modules/homework.md`, `schedule.md`.
- [ ] 462.2 **F** *complex* — «Домашнее задание» in the lesson card: «Задать» (`/teacher/homework/new
  ?lessonId=` — participants, course, the plan's textbook pages and videos with transcripts,
  deadline from `next-lesson.ts`; the route passes the lesson input and `linkToLesson`),
  «Привязать» (recent unlinked assignments of the participants, «Из банка» → use); «Сохранить в
  банк» / «Обновить в банке» in the editor's «⋮»; `HomeworkBankFeed` — the «Задания» tab of
  «Материалы»; the lesson summary draft (`lesson-summary-section.ts`) over the linked
  assignments; help, `docs/screens/homework.md`, `schedule.md`, `materials.md`.

### 463. Release 0.60.0

- [ ] 463.1 *simple* — skill `release`: help articles and wiki checked, E2E (course → plan on a
  lesson seen by the student → homework from the lesson → both originals in the bank → use makes a
  copy, the bank unchanged; an automatic transcript is not in E2E — YouTube is outside), CHANGELOG
  0.60.0, versions, archive the section.

## v0.61.0

Goals: the AI drafts a lesson plan from the request, the student's tags and the materials, and
summarizes a student's period. Starts only after the v0.60.0 PR is merged. Spec — roadmap/11 «AI
(v0.61.0)». New ADR: 0072 «ИИ читает журнал периода» (465.1).

### 464. AI lesson plan

- [ ] 464.1 **B** *complex* — `ai`: feature `LESSON_PLAN` (enum migration, `SystemPrompts`,
  resources `lesson-plan.system.v1`, `lesson-plan.user.v1`), `POST /api/teacher/ai/lesson-plan`
  (JSON / multipart as `homework-draft`, `DraftSources` with videos, student context), the answer's
  textbook pages checked against the given sources; tests on `FakeProvider`; `docs/modules/ai.md`.
- [ ] 464.2 **F** *simple* — direction `textbooks` → `ai`; the AI pane in the plan editor (as
  `features/ai/homework-ai-panel.ts`: sources — the plan's textbook pages and videos, context — the
  lesson students' AI tags, the lesson's topic and the previous summary); «С ИИ» in the lesson
  card's «План»; help.

### 465. Period summary

- [ ] 465.1 **B** *complex* — ADR-0072; `schedule::api.LessonJournal`, `homework::api.HomeworkJournal`
  and the report endpoints of roadmap 02 stage B (`GET /api/teacher/schedule/students/{id}/report`,
  `…/homework/students/{id}/report`); `ai` → `schedule::api`; feature `PERIOD_SUMMARY`, `POST
  /api/teacher/ai/period-summary`, budgets; tests incl. the time-zone boundary of the period and
  group lessons; `docs/modules/*.md`.
- [ ] 465.2 **F** *complex* — `/teacher/students/:id/summary?from&to` («Итоги за период» in the
  student card): period picker, facts (sections as feature parts), «Составить с ИИ», editable
  draft, «Копировать», print stylesheet; help, `docs/screens/students.md`.

### 466. Release 0.61.0

- [ ] 466.1 *simple* — skill `release`: help, wiki, E2E (the AI mock drafts a plan and a summary),
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
