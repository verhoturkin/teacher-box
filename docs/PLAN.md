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

**Groundwork for agent development** — no change the teacher or a student sees.

Goals:

- An agent in a cloud session can run the checks its change needs, and the rules say what it
  cannot run there.
- The files every interface change touches get smaller: styles, help articles, screen docs, the
  largest pages.
- Frontend features get declared dependency directions, as backend modules have.
- A gallery of the real components, motion tokens and rules replaces prose descriptions and gives
  copyable samples.

ADRs: new 0058 (frontend feature dependency directions, stage 370), new 0059 (design gallery,
stage 371).

Stages 366–371 are independent and may run in parallel branches, each from this plan. A stage
edits only the files it names; a file two stages need has one owner: `AGENTS.md` files and
`scripts/` — 366; `frontend/src/styles.scss` — 367; `docs/screens.md` — 369;
`frontend/eslint.config.js` — 370 (feature rules) and 371 (one override block for the gallery).
No stage touches the backend, so `./scripts/verify.sh backend` is not needed for them.

### Stage 366 — agent environment and rules (D)

- [ ] 366.1 **D** Cloud sessions. `AGENTS.md` §12 becomes "local" and "cloud": what a cloud
  container lacks (JDK 25, Docker, E2E runs) and what to do instead (run the parts that work, say
  what was not run). Add `scripts/agent-setup.sh` — idempotent: `git config core.hooksPath
  .githooks`, `npx -y npm@11 ci` in `frontend/` and `e2e/` when `node_modules` is missing; name it
  in §12 as the cloud environment's setup script. Fix `.codex/hooks.json`: no absolute
  `D:\Prog\…` path.
- [ ] 366.2 **D** Fewer prompts and no double runs. `.claude/settings.json`: `permissions.allow`
  for `./mvnw`, `npm run lint|test|test:only|build`, `./scripts/verify.sh`, read-only `git`.
  `scripts/verify.sh` writes `.verify-logs/<part>.ok` with the hash of the tree after a green part
  (`git write-tree` of the index plus the worktree diff); `.githooks/pre-commit` skips a part whose
  stamp matches the staged tree. A test of the stamp in `verify_installer`-style shell checks.
- [ ] 366.3 **D** One source for agent configs. `scripts/check-agents.sh` (run by `verify.sh
  docs`): `.claude/skills/*` equals `.agents/skills/*`, `.claude/hooks/format.mjs` equals
  `.codex/hooks/format.mjs`, the `docs-sync` agent exists for both.
- [ ] 366.4 **D** Shorter always-loaded rules. `AGENTS.md`: §10 keeps only what §5, §8 and §9 do
  not say; the module structure lives in `backend/AGENTS.md` only; §5 lists every `verify.sh`
  target (`docs`, `installer`). `frontend/AGENTS.md`: no file sizes in prose. Target: root file
  at most 14 KB with no rule lost.

### Stage 367 — smaller files that every interface change touches (F)

- [ ] 367.1 **F** `frontend/src/styles.scss` (5081 lines) becomes an index of `@use` partials in
  `frontend/src/styles/` named after the design-system parts (`_tokens`, `_colour`, `_typography`,
  `_frame`, `_buttons`, `_fields`, `_lists`, `_dialogs`, `_states`, …), the cascade order kept.
  Proof: the built CSS of `npm run build` before and after is byte-identical apart from the hash
  in the file name. `docs/design-system.md` «Where it lives» and `core/theme/design-rules.spec.ts`
  follow the new paths.
- [ ] 367.2 **F** Help articles: `features/help/articles/{teacher,student,admin}.{ru,en}.ts`
  become folders with one file per topic (`articles/teacher/ru/first-steps.ts`, …) and an index
  that keeps `TEACHER_ARTICLES` and the other exports as they are; no source line longer than 200
  characters (long strings split with template literals or array joins, the rendered text
  unchanged — a spec compares every article with its text before the split). `frontend/AGENTS.md`
  and the `release` skill (both copies) name the new paths.
- [ ] 367.3 **D** `CHANGELOG.md` keeps the releases of the current minor series and the previous
  one; older entries move to `docs/archive/changelog/<year>.md`, linked from the bottom. The
  `release` skill (both copies) says where old entries are.

### Stage 368 — the largest pages (F)

- [x] 368.1 **F** `features/homework/teacher/assignment-editor-page.ts` (1795 lines): the page
  keeps routing, loading and saving; each section of the form (recipients and dates, materials,
  questions, AI) is a component of its own with its inputs and outputs in
  `features/homework/teacher/editor/`. No behaviour or markup change: the existing specs pass
  unchanged first, then `assignment-editor-page.spec.ts` is split by section.
- [ ] 368.2 **F** `features/homework/teacher/teacher-pages.spec.ts` (1874 lines) is split into a
  spec per page beside its page; shared setup goes to `@testing/homework-fixtures`.
- [ ] 368.3 **F** `features/settings/setup/setup-page.ts` (1572 lines): a component per wizard
  step in `features/settings/setup/steps/`, the page keeps the step order and the finish; specs
  split the same way.

### Stage 369 — screen docs describe decisions, not markup

- [ ] 369.1 `docs/screens.md` (85 KB) becomes an index plus `docs/screens/<area>.md` (frame,
  notifications, today, schedule, students, homework, payments, materials, settings, cabinet,
  admin, call). Each screen keeps: route and files, what it is assembled from and why, transitions
  and states that are not obvious from the template, the sketch board it follows. Removed: button
  labels, icon names, sizes and colours the template, the dictionaries or `design-system.md`
  already hold, stage numbers and notes on what was removed. Target: at most 35 KB in total.
  `AGENTS.md` §2 and `frontend/AGENTS.md` keep pointing at `docs/screens.md`.
- [ ] 369.2 `docs/wiki/Features.md` against the Russian help articles: where both explain the same
  action, the wiki keeps the overview and links the in-app help; no duplicated step lists.

### Stage 370 — frontend feature directions (F, ADR-0058)

- [ ] 370.1 **F** ADR-0058 and the rule. Declare which feature may import which, in one table in
  `frontend/eslint.config.js` (`featureBoundary`) mirrored in `frontend/AGENTS.md`: base features
  (`identity`, `help`) import no business feature; business features import base ones and the
  pairs the backend allows; composition features (`home`, `settings`, `materials`, the new
  `students`) import any. `frontend/scripts/import-cycles.mjs` also fails on a cycle between
  features. The rule starts as a list of today's violations that 370.2–370.3 empty.
- [ ] 370.2 **F** Student and group cards leave `identity`. `features/identity/students/`
  (`students-page.ts`, `student-card.ts`, `student-profile-tab.ts`, `roster.ts`, `card-*.ts`) and
  `features/identity/groups/` (`group-card.ts`, `group-profile-tab.ts`, `group-members-tab.ts`)
  move to a composition feature `features/students/`; `identity` keeps accounts, invites, login,
  the directory API, pickers and tags. Routes `/teacher/students…` and their lazy chunks stay.
  `identity/account/account-panel.ts` takes the notifications section through a projected slot or
  moves with the account page to `settings`.
- [ ] 370.3 **F** `homework` ↔ `schedule`: `homework/teacher/next-lesson.ts` and
  `schedule/teacher/lesson-summary-section.ts` import each other's parts. Keep one direction
  (`schedule` → `homework`, as the lesson owns its homework summary); the editor's "next lesson"
  hint takes its data through an input or a small API type owned by `schedule/parts`' data layer
  that needs no `homework` import. The violation list of 370.1 is empty.

### Stage 371 — design gallery (F, ADR-0059)

The gallery is built from the real components and tokens; nothing in it is drawn separately.
Styles of the gallery live in its components, not in `styles.scss`.

- [ ] 371.1 **F** Frame and foundations. ADR-0059. Feature `features/gallery/` behind the lazy
  route `/gallery`, registered only in development builds (`isDevMode()` in `app.routes.ts`); not
  in navigation, not in the production bundle (a spec checks the route list). One page with a
  section nav that follows the parts of `docs/design-system.md`; sections of this substep: tokens
  (shape, spacing, elevation), colour roles in both themes, typography, icons. One sample = one
  file `features/gallery/<section>/<sample>.ts` of at most 80 lines. ESLint override for
  `features/gallery/**`: sample captions may be literal English text (no dictionaries). Coverage:
  samples are excluded in `angular.json` `coverageExclude`; the page and the nav are tested.
- [ ] 371.2 **F** Components: buttons (variants, sizes, FAB, segmented), fields (text, select,
  stepper, chips, errors), lists, tables and cards, dialogs, sheets and menus, states
  (`tb-load-state`, empty, snackbar, confirmation). Every `shared/ui/*` component has a sample.
- [ ] 371.3 **F** Motion. A sample per `--tb-spring-*` token: the token name, the property it is
  for (spatial / effects), a "Replay" button and a "Reduce motion" switch; the page transitions
  and the dialog, sheet and menu openings of §11.
- [ ] 371.4 **F** Checks and docs. A Vitest spec renders every sample; E2E `e2e/tests/layout/`
  runs axe on the gallery — screenshots of it are not compared yet (fonts differ between
  machines; decide after a CI trial). `docs/design-system.md`: each part links its gallery
  section and loses the values the gallery shows; rules and the M3 / *ours* marks stay.
  `frontend/AGENTS.md` and `AGENTS.md` §9: a new shared component or variant adds its sample in
  the same commit.

## Backlog

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
