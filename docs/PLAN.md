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

## Next release

Goals: the teacher's Today stops stretching over a wide screen (sketch «Главная учителя —
варианты», board D); both sides of a lesson see who is already waiting in the portal's call.

### 450. Today on wide screens and call presence

- [x] 450.1 **F** *simple* — Presence in the lesson card. Teacher (`meetings/ui/call-summon.ts`):
  everybody in the room and the teacher not → «Ира ждёт в звонке» / «Все ждут в звонке» without
  «Позвать»; the teacher in too → nothing. Student (`schedule/home/next-lesson-widget.ts`, new
  `meetings/ui/teacher-waiting.ts` on `GET /api/me/meetings/calls`): «Учитель ждёт в звонке» while
  the lesson's portal room has the teacher. Both ask every 10 s instead of 30 s.
- [ ] 450.2 **F** *complex* — Today as board D from large: a flexible lead pane (the lesson hero,
  then the other rows and the queue in two columns) and a fixed 412 dp figures pane on surface
  container (`home/teacher-home.ts`); the hero (`home/today-lessons.ts`, `part="hero"`) on one line:
  the time tile (`schedule/ui/lesson-time-tile.ts`), avatar, name in an emphasized style, the join
  and call buttons as one connected group; a wavy bar of the lesson's elapsed time.

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
