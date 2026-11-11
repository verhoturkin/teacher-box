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

- [x] 366.1 **D** Cloud sessions. `AGENTS.md` §12 becomes "local" and "cloud": what a cloud
  container lacks (JDK 25, Docker, E2E runs) and what to do instead (run the parts that work, say
  what was not run). Add `scripts/agent-setup.sh` — idempotent: `git config core.hooksPath
  .githooks`, `npx -y npm@11 ci` in `frontend/` and `e2e/` when `node_modules` is missing; name it
  in §12 as the cloud environment's setup script. Fix `.codex/hooks.json`: no absolute
  `D:\Prog\…` path.
- [x] 366.2 **D** Fewer prompts and no double runs. `.claude/settings.json`: `permissions.allow`
  for `./mvnw`, `npm run lint|test|test:only|build`, `./scripts/verify.sh`, read-only `git`.
  `scripts/verify.sh` writes `.verify-logs/<part>.ok` with the hash of the tree after a green part
  (`git write-tree` of the index plus the worktree diff); `.githooks/pre-commit` skips a part whose
  stamp matches the staged tree. A test of the stamp in `verify_installer`-style shell checks.
- [x] 366.3 **D** One source for agent configs. `scripts/check-agents.sh` (run by `verify.sh
  docs`): `.claude/skills/*` equals `.agents/skills/*`, `.claude/hooks/format.mjs` equals
  `.codex/hooks/format.mjs`, the `docs-sync` agent exists for both.
- [x] 366.4 **D** Shorter always-loaded rules. `AGENTS.md`: §10 keeps only what §5, §8 and §9 do
  not say; the module structure lives in `backend/AGENTS.md` only; §5 lists every `verify.sh`
  target (`docs`, `installer`). `frontend/AGENTS.md`: no file sizes in prose. Target: root file
  at most 14 KB with no rule lost.

### Stage 367 — smaller files that every interface change touches (F)

- [x] 367.1 **F** `frontend/src/styles.scss` (5081 lines) becomes an index of `@use` partials in
  `frontend/src/styles/` named after the design-system parts (`_tokens`, `_colour`, `_typography`,
  `_frame`, `_buttons`, `_fields`, `_lists`, `_dialogs`, `_states`, …), the cascade order kept.
  Proof: the built CSS of `npm run build` before and after is byte-identical apart from the hash
  in the file name. `docs/design-system.md` «Where it lives» and `core/theme/design-rules.spec.ts`
  follow the new paths.
- [x] 367.2 **F** Help articles: `features/help/articles/{teacher,student,admin}.{ru,en}.ts`
  become folders with one file per topic (`articles/teacher/ru/first-steps.ts`, …) and an index
  that keeps `TEACHER_ARTICLES` and the other exports as they are; no source line longer than 200
  characters (long strings split with template literals or array joins, the rendered text
  unchanged — a spec compares every article with its text before the split). `frontend/AGENTS.md`
  and the `release` skill (both copies) name the new paths.
- [x] 367.3 **D** `CHANGELOG.md` keeps the releases of the current minor series and the previous
  one; older entries move to `docs/archive/changelog/<year>.md`, linked from the bottom. The
  `release` skill (both copies) says where old entries are.

### Stage 368 — the largest pages (F)

- [x] 368.1 **F** `features/homework/teacher/assignment-editor-page.ts` (1795 lines): the page
  keeps routing, loading and saving; each section of the form (recipients and dates, materials,
  questions, AI) is a component of its own with its inputs and outputs in
  `features/homework/teacher/editor/`. No behaviour or markup change: the existing specs pass
  unchanged first, then `assignment-editor-page.spec.ts` is split by section.
- [x] 368.2 **F** `features/homework/teacher/teacher-pages.spec.ts` (1874 lines) is split into a
  spec per page beside its page; shared setup goes to `@testing/homework-fixtures`.
- [x] 368.3 **F** `features/settings/setup/setup-page.ts` (1572 lines): a component per wizard
  step in `features/settings/setup/steps/`, the page keeps the step order and the finish; specs
  split the same way.

### Stage 369 — screen docs describe decisions, not markup

- [x] 369.1 `docs/screens.md` (85 KB) becomes an index plus `docs/screens/<area>.md` (frame,
  notifications, today, schedule, students, homework, payments, materials, settings, cabinet,
  admin, call). Each screen keeps: route and files, what it is assembled from and why, transitions
  and states that are not obvious from the template, the sketch board it follows. Removed: button
  labels, icon names, sizes and colours the template, the dictionaries or `design-system.md`
  already hold, stage numbers and notes on what was removed. Target: at most 35 KB in total.
  `AGENTS.md` §2 and `frontend/AGENTS.md` keep pointing at `docs/screens.md`.
- [x] 369.2 `docs/wiki/Features.md` against the Russian help articles: where both explain the same
  action, the wiki keeps the overview and links the in-app help; no duplicated step lists.

### Stage 370 — frontend feature directions (F, ADR-0058)

- [x] 370.1 **F** ADR-0058 and the rule. Declare which feature may import which, in one table in
  `frontend/eslint.config.js` (`featureDirection`) mirrored in `frontend/AGENTS.md`: base features
  (`help`, then `identity`) import no business feature; business features import base ones and
  the pairs listed for them — by screen embedding, which is not the backend table (`billing` →
  `notifications`, `homework` and `schedule` → `ai`); composition features (`home`, `settings`,
  `materials`, `admin`, the new `students` and `account`) import any and are imported by none,
  except `admin` → `settings`. Tests and `import type` count. `frontend/scripts/import-cycles.mjs`
  also fails on a cycle between features. The rule starts as a list of today's violations
  (`PENDING_DIRECTIONS`) that 370.2–370.3 empty.
- [x] 370.2 **F** Student and group cards leave `identity`. `features/identity/students/` and
  `features/identity/groups/` move whole to a composition feature `features/students/` (the page,
  the roster, the cards and their tabs, the student, group and invite-link dialogs, with their
  dictionary keys), except the recipients picker (`member-picker.ts`, `member-recipients.ts`);
  `identity` keeps accounts, invites, login, the directory API, colours, pickers and tags. Routes
  `/teacher/students…` and their lazy chunks stay. `identity/account/account-panel.ts` takes the
  notifications section through a projected slot (`<ng-template tbAccountNotifications>`) and is
  exported from `identity/parts`; the account page of a student and the administrator moves to a
  composition feature `features/account/` (not to `settings`: a student would load the teacher's
  settings chunk), and the settings page fills the slot itself.
- [x] 370.3 **F** `homework` ↔ `schedule`: `homework/teacher/next-lesson.ts` and
  `schedule/teacher/lesson-summary-section.ts` import each other's parts. Keep one direction
  (`schedule` → `homework`, as the lesson owns its homework summary); the editor's "next lesson"
  hint declares what it reads (`UpcomingLesson`, `UpcomingLessons` in `next-lesson.ts`) and takes
  it as the input `upcomingLessons`, resolved by the route `homework/new` in `app.routes.ts`,
  which loads `ScheduleApi` lazily. The violation list of 370.1 is empty and removed.

### Stage 371 — design gallery (F, ADR-0059)

The gallery is built from the real components and tokens; nothing in it is drawn separately.
Styles of the gallery live in its components, not in `styles.scss`.

- [x] 371.1 **F** Frame and foundations. ADR-0059. Feature `features/gallery/` behind the lazy
  route `/gallery`, registered only in development builds (`isDevMode()` in `app.routes.ts`); not
  in navigation, not in the production bundle (a spec checks the route list). One page with a
  section nav that follows the parts of `docs/design-system.md`; sections of this substep: tokens
  (shape, spacing, elevation), colour roles in both themes, typography, icons. One sample = one
  file `features/gallery/<section>/<sample>.ts` of at most 80 lines. ESLint override for
  `features/gallery/**`: sample captions may be literal English text (no dictionaries). Coverage:
  samples are excluded in `angular.json` `coverageExclude`; the page and the nav are tested.
  *The route is `features/gallery/dev-routes.ts`, replaced by an empty `dev-routes.prod.ts` in
  production builds: `isDevMode()` kept the route's code in the initial bundle (ADR-0059).*
- [x] 371.2 **F** Components: buttons (variants, sizes, FAB, segmented), fields (text, select,
  stepper, chips, errors), lists, tables and cards, dialogs, sheets and menus, states
  (`tb-load-state`, empty, snackbar, confirmation). Every `shared/ui/*` component has a sample.
- [x] 371.3 **F** Motion. A sample per `--tb-spring-*` token: the token name, the property it is
  for (spatial / effects), a "Replay" button and a "Reduce motion" switch; the page transitions
  and the dialog, sheet and menu openings of §11.
- [x] 371.4 **F** Checks and docs. A Vitest spec renders every sample; E2E `e2e/tests/layout/`
  runs axe on the gallery — screenshots of it are not compared yet (fonts differ between
  machines; decide after a CI trial). `docs/design-system.md`: each part links its gallery
  section and loses the values the gallery shows; rules and the M3 / *ours* marks stay.
  `frontend/AGENTS.md` and `AGENTS.md` §9: a new shared component or variant adds its sample in
  the same commit.

## Release after next

**Smaller start bundle, faster start, less hand-written plumbing** — no change the teacher or a
student sees, except that the portal opens faster.

Measured on `3cced13` (production build, `ng build --stats-json`): initial JS 961 kB raw / 253 kB
gzip (budget warning at 700 kB), of it the Aura theme 106 kB, `@material/material-color-utilities`
84 kB; initial CSS 239 kB raw / 30 kB gzip, of it our global styles 219 kB. Backend: 5.9k lines of
hand-written `JdbcClient` repositories; the container health check allows 90 s for the JVM start.

Goals:

- The initial bundle is under the 700 kB warning without raising the budget.
- nginx serves pre-compressed files and keeps connections to the backend; the JVM starts from an
  AOT cache.
- Repositories share the optimistic-lock and mapping plumbing; `meetings` talks to LiveKit without
  its SDK; `notifications` no longer knows the texts of other modules.

ADRs: new 0060 (LiveKit without the server SDK, changes ADR-0030; stage 378), new 0061 (modules
write their own notifications, stage 380).

Stages run in order, one branch and one pull request per stage, each from the latest `main`. Every
stage states its numbers before and after in the pull request (bundle sizes from
`ng build --stats-json`, lines removed, start time). A stage that does not reach its number says so
and keeps what it did reach; it never raises a budget or lowers a gate.

### Stage 372 — only the theme tokens the portal uses (F)

- [x] 372.0 Plan of the release (this section).
- [x] 372.1 **F** `core/theme/teacher-box-preset.ts`: `definePreset(Aura, …)` brings the tokens
  of every PrimeNG component (106 kB of the initial bundle). Build the base from the Aura parts
  the portal uses: `primitive`, `semantic` and the `components` of the PrimeNG modules imported
  under `src/app` (list them with `rg -o "from 'primeng/[a-z]+'" src/app`), imported per component
  from `@primeuix/themes/aura/<component>`; check the current import paths in the package first
  (§13). A spec fails when a `primeng/<module>` is imported in `src/app` and its tokens are not
  in the preset. Compare `/gallery` in both themes before and after (one screenshot each): no
  visual change. Target: initial JS at least 70 kB smaller.
  *Done: `core/theme/aura-base.ts` holds the base, `aura-base.spec.ts` the check. Initial JS
  960.8 → 915.8 kB (gzip 253.1 → 247.7 kB), 45 kB smaller: the target is not reached, because
  the 35 components the portal uses and the `primitive` and `semantic` tokens keep 63 kB of
  Aura's 109 kB.*

### Stage 373 — nginx: pre-compressed files, kept connections (D)

- [x] 373.1 **D** `docker/Dockerfile` (stage `frontend-build`): after `npm run build` write a
  `.gz` next to every `js`, `css`, `html`, `svg`, `json` over 1 kB (`gzip -9 -k`).
  `docker/nginx/default.conf.template`: `gzip_static on`; an `upstream` with `keepalive` for
  `${BACKEND_URL}` used by `/api/` and `/actuator/health` (WebSocket upgrade of boards keeps
  working: `Connection` stays `$teacherbox_connection`). E2E `e2e/tests/` (operations or the
  suite that already checks headers): a hashed script answers `Content-Encoding: gzip`.
  `docs/operations.md` if it describes the proxy.

### Stage 374 — the JVM starts from an AOT cache (D)

- [x] 374.1 **D** `docker/Dockerfile`: a training run of the extracted application in the build
  (`-XX:AOTCacheOutput`, Spring `spring.context.exit=onRefresh`, a throw-away data directory, no
  network), the cache copied into the `backend` image and used by `JAVA_TOOL_OPTIONS`
  (`-XX:AOTCache`); the image still starts when the cache does not match (the JVM ignores it).
  The training run uses the target platform's JRE, so it runs in a per-platform stage, not on
  `$BUILDPLATFORM`. Record the start time (`Started TeacherBoxApplication in …`) before and
  after in the pull request; lower `start-period` only if the number allows. Check the current
  Spring Boot 4.1 and JDK 25 documentation first (§13). *The flag is an argument of the
  entrypoint, not a part of `JAVA_TOOL_OPTIONS`: a server may set that variable in `.env`. The
  start time is measured by the `Docker images` job of CI (without and with the cache);
  `start-period` is unchanged.*

### Stage 375 — styles of one screen load with that screen (F)

- [x] 375.1 **F** Move the rules used by one feature out of the global styles into the styles of
  its components: `styles/_calls.scss` → `features/meetings/call/`, `styles/_calendar.scss` →
  `features/schedule/ui/schedule-calendar.ts`, `styles/_excalidraw.scss` →
  `features/boards/editor/`, `styles/_home.scss` → `features/home/`. A rule used by two features
  stays global. The `anyComponentStyle` budget (4 kB warning, 8 kB error) is not raised: a part
  that does not fit stays global and the plan notes it. FullCalendar's `skeleton.css` and
  `themes/classic/theme.css` leave `angular.json` `styles` if the calendar component can carry
  them. Target: initial CSS at least 40 kB raw smaller; `e2e/tests/layout/` stays green.
  *Initial CSS 239.1 → 198.7 kB raw, 29.6 → 22.3 kB gzip. The call: eight sheets of its components
  (`ViewEncapsulation.None`). The calendar with FullCalendar's CSS and the calendar rules of
  `_tables` and `_overrides`: the `calendar` style bundle (27 kB, over the component budget), loaded
  by the schedule routes. Excalidraw's roles: first in the `excalidraw` bundle. `_home.scss` stays
  global: despite its name its classes are shared (`tb-amount`, `tb-link`, `tb-markdown`,
  `tb-widget-footer`, `tb-board-chips`…) or spread over a dozen homework components
  (`tb-assign`, `tb-subtitle`, `tb-submission`…, about 1 kB); only its unused `tb-stats` rules are
  removed.*

### Stage 376 — the colour scheme is computed once (F)

- [x] 376.1 **F** `core/theme/color-scheme.ts`, `appearance.ts`, `label-colors.ts`:
  `@material/material-color-utilities` (84 kB) runs at every start to compute the same roles.
  Keep the computed scheme of the default appearance as generated constants (a script next to
  `scripts/icons.mjs`, a spec that fails when the constants differ from the computed ones); a
  custom appearance stores its computed roles (device setting keyed by the seed colours) and
  loads the library with `import()` only when the seed changes or the store is empty. Target:
  the library is absent from the initial chunks (a spec on the build stats or on the import
  graph, like `scripts/import-cycles.mjs`).
  *Done: initial JS 916.6 → 834.6 kB raw, the library (85.6 kB) is in a lazy chunk only. Constants
  cover the default appearance and the labels; the six named colours with the default appearance
  are kept on the device like any custom one (13 kB of constants would eat the gain).*

### Stage 377 — shared plumbing of repositories (B)

- [x] 377.1 **B** `shared/persistence`: `OptimisticLock.requireUpdated(int, String, Object)` for
  the `if (updated != 1) throw new OptimisticLockingFailureException(…)` blocks; typed column
  readers for the repeated `rs.getObject("…", UUID.class)` / nullable `Instant` / nullable
  `long`. Apply to `billing/persistence` first (pilot, numbers in the pull request), then to the
  other modules in the same branch, one commit per module. Flat read models use
  `JdbcClient.query(Class)` where the columns match the record. No Spring Data JDBC (schema per
  module, `restore` factories). Target: at least 600 lines fewer under `*/persistence/`, gates
  unchanged.
  *Done in part: 5919 → 5709 lines under `*/persistence/` (−210: −232 in the modules, +22 for the
  helper), far below the target, which this code cannot give honestly: a survey showed 21
  optimistic-lock blocks (2 lines each), 4 `wasNull` reads and one line per column in mappers and
  `.param(...)` chains, which no helper shortens. Added `OptimisticLock.requireUpdated` (17 uses in
  8 modules) and `.query(Record.class)` for 23 flat records (the only shape with a real gain:
  −16 % in `meetings`, −8 % in `boards`, −6 % in `ai` and `notifications`). The pilot gave
  `billing` −7 lines (its mappers convert `Money`). Not done: typed column readers (a call of the
  same length, no line saved; nullable numbers are read with `rs.getObject(…, Integer.class)`) and
  binding parameters from objects (enums and `Money` need a conversion, the binding would be
  implicit).*

### Stage 378 — LiveKit without the server SDK (B, ADR-0060)

- [x] 378.1 **B** ADR-0060. `meetings/livekit/LiveKitCallServer.java` is the only user of
  `io.livekit:livekit-server`, which brings protobuf and Retrofit and forces the OkHttp BOM in
  `backend/pom.xml`. Sign the access token with the Nimbus classes Spring Security already
  brings (HS256, the `video` grant claims of the LiveKit documentation); call the room service
  (Twirp, JSON) through `shared/http/OutboundHttp`. Tests compare the claims and requests with
  what the SDK produced (captured once as fixtures). Remove `livekit-server`, `okhttp-jvm` and
  the `okhttp-bom` import if the Anthropic SDK builds without them. Record the size of the
  `backend` image layer with dependencies before and after.
  *Done: the `dependencies` layer of the backend jar (`java -Djarmode=tools … extract --layers`,
  what the Dockerfile copies as its own image layer; Docker was not available) went from 119 jars,
  89 186 811 bytes to 109 jars, 82 564 809 bytes (−6.6 MB, −7.4 %). Gone: `livekit-server`,
  protobuf with its util and Gson, Retrofit and its protobuf converter, `java-jwt`,
  `logging-interceptor`, OkHttp 5 and Okio 3.16; the Anthropic client takes the OkHttp 4.12.0 and
  Okio 3.6.0 it declares. Fixtures: `meetings/livekit/sdk-fixtures.json` (SDK 0.16.0); deliberate
  differences — JSON bodies instead of protobuf, a 10-minute token per room-service call instead
  of six hours, no empty `sip` grant.*

### Stage 379 — one Google OAuth client (B)

- [x] 379.1 **B** Compare `platform/backup/drive/DriveApi.java` and
  `schedule/google/GoogleApi.java`: the code exchange, token refresh and error mapping. If at
  least 100 lines repeat, move them to `shared/http` (no business names, no module schema) and
  keep the Drive and Calendar calls where they are; otherwise tick this substep with a note in
  italics and change nothing.
  *Done: about 115 lines repeated (the code exchange, refresh, revoke, token parsing, `call`,
  `failure`, `describe`, `errorCode`, `bearer` and the consent address), so they moved to
  `shared.http.GoogleOAuth`; the two exception families stay in their modules (passed in as
  factories).*

### Stage 380 — modules write their own notifications (B, ADR-0061)

- [x] 380.1 **B** ADR-0061 and the contract. `notifications` depends on the `api` of five
  modules and holds their texts (`ScheduleNotifications`, `HomeworkNotifications`,
  `BillingNotifications`, `MeetingNotifications`, `NotificationTexts`). Chat actions already
  live with their owner (`schedule/chat`, `billing/chat`). Contract in `shared`: an event with
  the recipient, the kind (for the user's preferences), the texts in every language and the
  link; `notifications` listens to it and keeps delivery, preferences and the inbox.
  *Done: `shared.notice` (`NoticeRequested`, `NoticeText`, `NoticeKind`), `NoticeListener` and
  `NotificationService.notify(NoticeRequested)` — the notice id is the inbox id, so a redelivery
  notifies once. The golden files `src/test/resources/notices/<module>.txt` hold what today's
  listeners write for `testing.notices.NoticeSamples` in both languages (`NoticeBaselineTest`);
  380.2 and 380.3 compare the modules with them.*
- [x] 380.2 **B** `schedule` writes its notifications; `ScheduleNotifications` is removed.
  *Done: `schedule/notices` (`ScheduleNotices`, `ScheduleNoticeTexts`, `ScheduleNoticeFormats`,
  `ScheduleNoticeKind`); `ScheduleNoticesGoldenTest` gives `notices/schedule.txt` byte for byte.
  Not kept: the listeners of the deprecated `SeriesScheduled` / `SeriesStopped` (replay of
  publications from before 0.29.0) — the registry addresses a publication to a listener by its
  method name, so a listener that left `notifications` cannot take them; for the same reason a
  publication still incomplete for `ScheduleNotifications` at the moment of the upgrade stays
  undelivered (ADR-0061, «Последствия»).*
- [ ] 380.3 **B** `homework`, `billing`, `meetings`, `identity` write theirs; `notifications`
  `allowedDependencies` shrink to `shared` and `identity :: api`; `AGENTS.md` §4.2 table,
  `docs/modules/notifications.md` and the modules' docs updated.

### Stage 381 — E2E jobs use the runner's Chrome (D)

- [x] 381.1 **D** `.github/workflows/ci.yml` job `e2e`: no `npx playwright install --with-deps
  chromium` (its apt part fails on the runners); the scenarios run with `E2E_BROWSER_CHANNEL:
  chrome`, the Google Chrome that the `ubuntu-latest` image ships. `e2e/README.md` describes it.
  *Fallback if a test differs only in Chrome: cache `~/.cache/ms-playwright` instead.*

## Backlog

After the bundle measurement of 2026-11-11 (see "Release after next"), not planned:

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
