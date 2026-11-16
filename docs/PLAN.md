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

## v0.52.0

Goals: the teacher runs the call. Mute or remove a participant, chat inside the call, open the
student's board from the call, and keep the call in a Picture-in-Picture window over other tabs.
Call history, «ученик ждёт» and recording stay in
[`roadmap/09`](roadmap/09-calls-waiting-recording.md).

ADRs: a new one if 409.2 needs a frontend dependency of `meetings` on `boards` (ADR-0058).

### 408. Moderation

- [x] 408.1 **B** *complex* — teacher endpoints in `meetings/web/CallsController` to mute a
  participant's microphone and remove a participant (`CallServer.removeParticipant`, a new
  `mute` via LiveKit `MutePublishedTrack`); only the teacher; tests incl. a student → 403.
- [x] 408.2 **F** *simple* — a menu on a participant's tile (`meetings/call/call-tile.ts`):
  «Выключить микрофон», «Удалить из звонка» with a confirmation; the removed student sees why.
  `m3-expressive` skill; help and wiki in both languages.

### 409. Chat and board in the call

- [x] 409.1 **F** *complex* — chat in the call over the LiveKit data channel
  (`meetings/call/livekit-engine.ts`, `call-engine.ts`, a panel in `call-window.ts`): text
  messages, unread badge on the button, not stored after the call. `m3-expressive` skill; help and
  wiki.
- [ ] 409.2 **F** *simple* — «Доска ученика» in the call controls (`call-controls.ts`) opens the
  student's board in a new tab or beside the call, through a route, not an import of `boards`
  code. Help and wiki.

### 410. Document Picture-in-Picture

- [ ] 410.1 **F** *complex* — `documentPictureInPicture` (Chromium only, feature-detected): the call
  moves to a floating window with the tiles and the main controls; back to the tab on close;
  the button is hidden where the API is missing. `m3-expressive` skill; help and wiki.

### 411. Release 0.52.0

- [ ] 411.1 *simple* — skill `release`.

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
