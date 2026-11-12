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

Less context per agent session: smaller always-loaded rules, quieter tools, outlines for big
docs, smaller source files.

### Stage 387 — context economy for agents (D)

Stage 353 of the agent chain; renumbered because stage 353 is taken (v0.44.0).

- [x] 387.1 (353.1) Slim AGENTS.md: move rarely needed parts to docs on demand
  (`docs/agent-environment.md`: layout, all commands, stamps, local and cloud environment; the
  m3-expressive details to `frontend/AGENTS.md`). Section numbers kept. Entry: `AGENTS.md`,
  `CLAUDE.md`.
- [x] 387.2 (353.2) Harness: hide big generated files from search/read (`.ignore`,
  `permissions.deny`: `frontend/src/testing/help-articles.fixture.json`, `docs/assets/`), output
  limits in `.claude/settings.json` `env` (`BASH_MAX_OUTPUT_LENGTH`, `MAX_MCP_OUTPUT_TOKENS`), a
  PreToolUse hook that refuses a whole-file Read of a file over ~40 KB. Entry: `.ignore`,
  `.claude/settings.json`, `.claude/hooks/`.
- [x] 387.3 (353.3) **B** Quiet backend test output: `logging.level.root: WARN` in
  `backend/src/test/resources/config/application.yaml` (check `OutputCaptureExtension` users
  first), surefire `redirectTestOutputToFile`, `trimStackTrace`. Entry: `backend/pom.xml`.
- [x] 387.4 (353.4) Outlines for big docs: a short summary/outline at the top of
  `docs/modules/{homework,schedule,boards,ai}.md`, `e2e/README.md`, `docs/glossary.md`.
- [x] 387.5 (353.5) **F** Split the largest homework pages:
  `features/homework/teacher/{assignment-editor-page,assignments-page,assignment-page}.ts` into
  smaller components.
- [x] 387.6 (353.6) *simple* Task sizing rules: complexity mark per substep (`docs/PLAN.md` "How to
  use", `AGENTS.md` §10), model and session choice by complexity (`CLAUDE.md` "Claude Code
  specifics"), a Vitest trap in `frontend/AGENTS.md`. Entry: `AGENTS.md`, `CLAUDE.md`.

## Backlog

- `ArchitectureTests.BUSINESS_MODULES` lacks `textbooks`: derive it like `SchemaIsolationTests`.

After the bundle measurement of 2026-11-11 (see [0.47.1](archive/plans/v0.47.1.md)), not planned:

- Attachments are served with `no-store` (`shared/http/FileDownloads`), so pictures of homework are
  downloaded at every opening; boards serve theirs as `private, immutable`. Needs the teacher's
  decision: a private cache keeps files on a shared computer.
- One language of the dictionaries per load: the unused language is 19 kB of the initial bundle
  and 128 kB over all lazy chunks — too little for the change it needs.
- Caddy alone instead of Caddy in front of nginx (profile `https`): changes ADR-0031 and ADR-0032.

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Voice answers («Записать голос»): `MediaRecorder` in the answer panel of `my-task-page.ts` would upload
a record as an attachment. Missing: the browser records `audio/webm` and `FilePolicy` accepts no `webm` (a one-line
addition, plus `ACCEPTED_FILES`); decided against for now.

Colours of students and groups after 0.20.0: rows without an avatar (the student table of the
monthly report, homework and board lists by name) and the options of student / group selects.

`shared/ui/fold-card.ts` (`tb-fold-card`) is used by no page since 247.2: remove it or find it a use.

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
