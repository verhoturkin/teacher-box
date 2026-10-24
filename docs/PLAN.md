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
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next
  release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to
  Backlog. This file keeps only unreleased work and the Backlog.

## Next release

### Stage 282 — Correct student filled fields (F)

- [x] 282.1 Isolate student filled fields from outlined styles and follow M3 label, geometry,
      indicator and error states (`shared/ui/filled-field.scss`, `styles.scss`). Expose
      `.tb-field--filled` globally for reuse across features, starting with the student forms. Keep
      the existing neutral disable-access action and the destruction-only red policy. Verify both
      themes, empty/focused/populated/error fields, textarea and read-only login in functional E2E.
- [x] 282.2 Record and enforce Markdown prose wrapping in `AGENTS.md`; check changed Markdown files
      and fix long plan items in `archive/plans/v0.33.0.md`.

## Backlog

Colours of students and groups after 0.20.0: rows without an avatar (the student table of the
monthly report, homework and board lists by name) and the options of student / group selects.

Carried over from 0.6.13 (design audit 2026-09-29, `archive/audit/`):

- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation
or "Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times
in the portal time zone; picking a reschedule time from free slots; file check before upload;
journal filters in the URL; prompt on leaving unsaved settings; invitation and first-run fixes;
list-detail for the review queue; filter chips instead of toggles. _List-detail for the review
queue, «Следующая работа», filter chips and search in long lists are planned in the redesign (stages
237, 242, 248)._

Calls after 0.8.0: call history; teacher moderation (mute / remove a participant); chat in the call;
«ученик ждёт» notification (LiveKit webhooks); opening the student's board from the call; Document
Picture-in-Picture; noise suppression; recording.
