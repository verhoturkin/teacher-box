# 02. Student progress report

Status: proposal. Size: L. ADR: yes — «Отчёт о прогрессе ученика» (numeric scores in homework, how
the report is assembled without cross-module reads). Depends on: 01 (soft — the report shows lesson
summaries when they exist), 05 for phase 2.

## Goal

One page per student and period: attendance, homework on time, scores and their trend, lessons
covered (topics and summaries), materials used, payments optionally. The teacher prints it or saves
it as PDF and sends it to a parent; in phase 2 the parent opens it in the portal.

## Current state that matters

- Attendance is in `schedule` (`lesson_participants`, `Attendance`), only events cross modules —
  `schedule` has no facade.
- Homework grade is free text: `homework.tasks.grade varchar(20)` — no trend can be drawn from it.
- The student card already composes tabs from several features (`identity/students/card-tabs.ts`,
  each tab is a part from `@features/<name>/parts`). The report follows the same pattern: the
  frontend composes module endpoints; no module reads another module's data.

## Decisions for the teacher

1. Score scale: proposed an optional number on review with a portal-wide scale — «1–5», «1–10»,
   «0–100 %» or «нет оценок» (settings «Задания»). The free-text grade stays as the comment line.
2. Contents and order of the report; is billing (balance, paid lessons) in it by default? Proposed:
   off by default, a switch before printing.
3. Periods: month, quarter, custom range. Default — the last full month.
4. Phase 2 visibility: does the parent see the report live, or only a snapshot the teacher sends?

## Design

- `homework`: `tasks.score smallint null`, `tasks.score_scale varchar(10) null` (the scale at the
  time of the review, so a scale change does not rewrite history); portal setting
  `homework.score_scale` in the module's own settings table (DB, not env — the teacher changes it
  in the UI); `ReviewService.review` accepts `score`, validated against the scale.
- Per-module report endpoints, all teacher-only, `?from&to` in the instance time zone:
  - `GET /api/teacher/schedule/students/{id}/report` → `{held, missed, excused, cancelledByStudent,
    lateCancellations, lessons: [{date, topic, outcome, summary?}]}`;
  - `GET /api/teacher/homework/students/{id}/report` → `{assigned, submitted, onTime, late,
    accepted, returned, averageScore, scores: [{date, title, score, scale}]}`;
  - `GET /api/teacher/billing/students/{id}/report` → `{charged, paid, balanceAtEnd}`;
  - `GET /api/teacher/textbooks/students/{id}/report` → textbooks bound in the period (optional).
  Group lessons count for each participant. Unknown student → empty report, not 404 (matches
  `GET lessons?studentId`).
- Frontend feature part `features/identity/students/progress/` hosts the page, but every section
  is a part of its own feature (`@features/schedule/parts` → `ProgressAttendanceSection`, …), so
  ESLint boundaries hold. Charts: a simple SVG line of scores and stacked bar of attendance — follow
  the `dataviz` guidance and design-system colour roles, no chart library unless one is already in
  `package.json` (check with `npm ls`).
- PDF: a print stylesheet (`@media print`, A4, light scheme forced) and `window.print()`; no
  server-side PDF rendering. The file name hint goes into `document.title` while printing.
- Phase 2 (after 05): the same four endpoints under `/api/guardian/students/{id}/…` with the
  guardian check, and the page in the guardian's cabinet.

## Stages

### A — Numeric scores (B, F)

- [ ] **A.1** ADR (Russian) + migration `homework/V6__task_scores.sql`, setting storage,
  `ReviewService` validation (`homework.score-invalid`), `HomeworkReviewed` carries `score`;
  views; tests incl. scale change keeping old scores.
- [ ] **A.2** `homework/teacher/review-form.ts`: score control by scale (connected single-select
  group for 1–5, number field for others), settings card «Оценки» in the «Задания» settings
  category; student task page shows the score. Help articles, `docs/modules/homework.md`.

### B — Report endpoints (B)

- [ ] **B.1** schedule report (`ScheduleQueries`), controller tests incl. group lessons and
  the time-zone boundary of the period (a lesson at 23:30 local on the last day).
- [ ] **B.2** homework report (`HomeworkSummaryService`), billing report (`BillingQueryService`),
  optional textbooks report; role tests (student 403) for each.

### C — Report page (F)

- [ ] **C.1** Route `/teacher/students/:id/progress?from&to`, «Прогресс» action in the student card
  header (`card-head.ts`) and an «Обзор» tab teaser; period picker; sections as feature parts;
  page states per ADR-0025 (loading, empty period, error per section — one failing module does not
  blank the page).
- [ ] **C.2** Charts and the print stylesheet; check light/dark, compact layout, print preview in
  Chrome and Firefox.

### D — Docs, E2E

- [ ] **D.1** `docs/wiki/Features.md` and a new section in an existing wiki page (or a page
  «Прогресс-ученика»), help article in ru and en, E2E `e2e/tests/students/progress.spec.ts` (data:
  two held lessons, one missed, two reviewed works with scores → numbers on the page).

### E — Phase 2, parents (after 05)

- [ ] **E.1** Guardian endpoints and the guardian cabinet page, guardian ≠ guardian-of → 404 tests.

## Risks and out of scope

- Score averages across a scale change: average only scores of the current scale, show the count.
- Not a gradebook for schools: no weighted categories, no terms.
