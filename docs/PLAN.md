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

Goals: fixes from the teacher's check of 0.62.0.

### 468. Teacher's check of 0.62.0

- [x] 468.1 **B F** «Сменить язык» of a video's captions opens its track menu in the tile and in
  the video dialog: `VideoPlayer` keeps its frame while the embed address is the same (a new
  `PlayableVideo` on every render reloaded the iframe, which blinked and closed the menu). A video
  with one track says at once «… Других языков у этого видео нет» instead of offering the link
  (`VideoTranscripts.Transcript.otherTracks`). *simple*
- [x] 468.2 **F** The plan's AI pane (`ai/lesson-plan-ai-panel.ts`) has the homework pane's
  tertiary «Сгенерировать» with the turning indicator and «Мои запросы» — the prompt library to
  pick from. *simple*
- [x] 468.3 **B** A deactivated student has no future lessons: `schedule` listens to
  `StudentDeactivated` (`ScheduleService.stopStudent`) — own series stop, planned lessons are
  cancelled, planned group lessons go on without them. *simple*

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Left from 0.62.0 (467.6): the AI side pane of the lesson-plan editor was not checked live; neither
was the course saved from Профиль surviving a reload.

Left from 0.57.0 (449.1): the student card actions (3 buttons, 371 px) overflow a 375 px phone;
the schedule toolbar → calendar gap and the `.tb-ops` section margins are child margins, not the
parent's gap; lesson rows, student-side cards with data and the teacher homework / Materials lists
were measured only empty; «Позвать» and the tab ripple on touch were not checked live.

Decided against on 2026-11-15 (don't propose again without a new reason): `no-store` of homework
attachments stays (a shared computer must not keep files); one language of the dictionaries per
load; Caddy alone instead of Caddy in front of nginx; colours on the board list; times in the
portal time zone; search in the remaining long lists and list-detail for the review queue.
