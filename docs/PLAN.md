# Teacher Box plan

Active plan only, in English. Completed releases — [`archive/plans/`](archive/plans/README.md); don't read them
unless the task needs history.

## How to use

- A release is a `## vX.Y.Z` section (or `## Next release` until the number is known): goals (2–5 lines),
  new/changed ADRs, then stages.
- Stages are numbered globally, continuing from the archive. Substeps: `85.1`, `85.2`, …
  Tags: **B** backend, **F** frontend, **D** docker/infra.
- A substep names its entry points — files, classes, endpoints, routes (`schedule/teacher/lesson-details-dialog.ts`,
  `ScheduleService.cancel`) — so the work starts there instead of a repository search.
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to Backlog. This file
  keeps only unreleased work and the Backlog.

## Next release

README (~600 lines) duplicates the user guides: messengers, schedule, calls, boards, AI, proxy and
the feature tour. Move the guides to the GitHub wiki (enabled 2026-10-16) and leave a slim stylish
README with the basics and links.

### 208. User guides to the wiki, slim README (D)

- [ ] 208.1 **D** Wiki pages (`teacher-box.wiki.git`): `Home`, `Features`, `Install`, `First-steps`,
  `Update`, `Backups`, `Messengers`, `Schedule`, `Calls`, `Boards`, `AI-assistant`, `Proxy`, `FAQ`
  (Russian, from README; repo links made absolute). Process follows the move: skill `new-setting`
  §4 and `AGENTS.md` §6.1 point user settings at the wiki, `docs/operations.md` proxy link → wiki.
  *Texts ready in 208.2; the push waits for one click in the web UI — GitHub creates the wiki repo
  only with its first page (clone/push return «Repository not found» until then).*
- [x] 208.2 **D** Slim stylish README (~150 lines, Russian): centered hero, badges, highlights,
  feature grid, one-command install, short manual/HTTPS/NAS (`<details>`), first steps, update,
  settings, FAQ and security in short, links to the wiki pages.

## Backlog

Carried over from 0.6.13 (design audit 2026-09-29, `archive/audit/`):
- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation or
"Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times in the
portal time zone; picking a reschedule time from free slots; file check before upload; journal filters in
the URL; prompt on leaving unsaved settings; invitation and first-run fixes; list-detail for the review
queue; filter chips instead of toggles.

Calls after 0.8.0: call history; teacher moderation (mute / remove a participant); chat in the call;
«ученик ждёт» notification (LiveKit webhooks); opening the student's board from the call; Document
Picture-in-Picture; noise suppression; recording.
