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

## v0.54.0

Goals: fixes from the teacher's review of 0.53.0 — the board fills the screen, one call mode that
floats over everything, a flatter student schedule, fewer chips in the AI helper and the review
sheet. KISS: remove before adding. No new ADR unless the call change needs one.

### 421. Fixes from the 0.53.0 review

- [ ] 421.1 *complex* F — the board is cut off at the bottom: the Excalidraw canvas stops at about
  a third of the viewport, the rest is empty. Find why the host gets no height
  (`boards/editor/board-page.ts`, `board-canvas.ts`, `excalidraw-host.ts`); fix the root cause in
  the layout, not a fixed pixel height. Check the full and mobile widths.
- [ ] 421.2 *complex* F — calls: one floating mode instead of two. Today the call can float in the
  Document Picture-in-Picture window (`meetings/call/call-pip.ts`) or in the in-portal mini window
  (`call-mini.ts`, `call-corner.ts`, `call-host.ts`, `call-session.ts`). Keep only the mode that
  floats over everything (PiP); delete the other one with its tests, labels and help text; where
  PiP is unsupported (Firefox, Safari) keep the smallest fallback that still lets the call go on
  — decide and say which in the commit. In the PiP window show the portal's own header styles
  (title bar of the call view) and set a clear window title (`<call> · Teacher Box`) instead of
  the portal address; if the browser itself paints the origin and it cannot be changed, say so in
  the report. Update `docs/modules/meetings.md`, `docs/screens.md`, wiki and help.
- [ ] 421.3 *simple* F — student schedule (`schedule/student/my-schedule-page.ts`): the cards
  «Ближайшие занятия», «Мои запросы», «История занятий» are nested in a pane; lift them one level
  so they are top-level cards of the page, like the teacher's panes. The «Подписка на календарь»
  card (`schedule/ui/calendar-feed-panel.ts`) has broken layout there — a bordered card inside a
  card with a misplaced edge; make it one plain card. Update `docs/screens.md`.
- [ ] 421.4 *simple* F — AI helper and review sheet. AI helper: remove the suggestion chips
  «Упражнения по теме», «Эссе», «По тексту учебника» (`suggest*` labels in `ai/i18n`), keep
  «Мои запросы». Review sheet (`homework/teacher/review-sheet.ts`): remove the quick-comment chips
  under the comment; grades 1–5 plus «Без оценки» (now 3–5); the student-context tags wrap badly
  on two lines — one line with an ellipsis and the full text in a tooltip (fix in the shared tag
  component, so the AI helper's tags get it too). Check the backend accepts grades 1 and 2.
- [ ] 421.5 *simple* F — browser check of 421.1–421.4 in the built-in browser; fix small defects,
  list the rest.

### 422. Release 0.54.0

- [ ] 422.1 *simple* — skill `release`: help, E2E, CHANGELOG, version, archive this section.

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Decided against on 2026-11-15 (don't propose again without a new reason): `no-store` of homework
attachments stays (a shared computer must not keep files); one language of the dictionaries per
load; Caddy alone instead of Caddy in front of nginx; colours on the board list; times in the
portal time zone; search in the remaining long lists and list-detail for the review queue.

- [x] *simple* F — buttons render at 16px: the `.p-button { font-size: 0.875rem }` rule never
  applied and was removed in 400.1 (ADR-0065); decided on 2026-11-16: M3 Label Large 14px, done
  in the button `css` of `teacher-box-preset.ts` (`sm` / `lg` keep their own size).
