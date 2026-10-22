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

## v0.29.0 — Unified lesson repeats and interface consistency

Bring search, material cards and profile fields into the current portal design. Replace the standalone
regular-lesson workflow with repetition configured on a lesson. Refresh board previews on exit and use
one student/group picker while preserving each feature's access and assignment semantics.
The teacher selected assignment-editor variant 1: main editor with a supporting AI pane on the right;
preserve every editor feature. All repeat intervals remain selectable for new and existing lessons:
once, every week, every 2 weeks, every 3 weeks or every 4 weeks.

Architecture: add an ADR for lesson-owned repetition, occurrence identity, exceptions and migration;
update the ADR index and `docs/modules/schedule.md`. Layout proportions and material-card sizing are
product decisions, not M3-prescribed values. Use the `m3-expressive` skill for all interface work.

### Stage 257 — Search, material sizing and profile surfaces

- [x] 257.1 **F** Add the global search results scroller (`core/search/global-search-view.scss`,
  `.tb-search__panel`) to the shared scrollbar styling in `styles.scss`. Match panes/dialogs in docked
  and full-screen search, keep the track clear of rounded corners, and retain keyboard scrolling and
  visible active results. Check light/dark themes and long result lists.
- [x] 257.2 **F** Make the Materials search span the available pane width like Students
  (`features/materials/{materials-page,my-materials-page}.ts`, `identity/students/students-page.ts`).
  Place filter chips and sorting below it; preserve query, sorting, member filters and tabs. Check
  teacher/student pages, narrow panes and clearing a query without a width jump.
- [x] 257.3 **F** Reduce the maximum linear size of board/textbook cards by approximately 20% through
  `.tb-material-grid` in `styles.scss` and `shared/ui/material-card.ts`. First measure the current wide
  layout, then set a bounded responsive grid so sparse lists do not stretch cards. Keep preview aspect
  ratio, readable titles, menus and interaction targets; retain a usable compact layout. Check both
  material types, teacher/student views, single-card lists and long titles. Record sizing in
  `docs/design-system.md` as a portal decision.
- [x] 257.4 **F** Fix outlined-label cutout backgrounds in the student's Profile tab
  (`identity/students/student-profile-tab.ts`, `.tb-field` in `styles.scss`). Resolve the label fill from
  its actual containing surface instead of assuming `--tb-card`; inspect account/group profile forms
  that share the same field styling. Check empty/filled/focused/error fields in light/dark themes and
  prevent regressions in dialogs and panes. Update the field rule in `docs/design-system.md`.

### Stage 258 — One student/group picker

- [x] 258.1 **F** Introduce a reusable picker in `identity` exported via `parts.ts`: one searchable
  dropdown, Students/Groups sections, distinguishable types, selected chips, clearing and keyboard
  access. Preserve typed student/group IDs; support the selection cardinality required by each caller.
  Cover namesakes, duplicate membership, empty options, archived/unavailable values and prefilled
  values. Use existing PrimeNG controls and portal field/error conventions.
- [x] 258.2 **F** Replace paired fields in `boards/teacher/board-dialog.ts` and
  `textbooks/teacher/textbook-dialog.ts`. Preserve STUDENT/GROUP grants and dynamic group membership;
  keep create/edit validation and member prefill, including creation from a student's Materials route.
  Check the existing backlog item about the rail Create action losing `?student=` and resolve it here.
- [x] 258.3 **F** Adopt the picker in `homework/teacher/{assignment-editor-page,assign-more-dialog}.ts`
  and `notifications/teacher/broadcast-dialog.ts`. These callers resolve groups into a snapshot of
  student IDs; keep deduplication, excluded/already-assigned recipients, scheduled delivery and existing
  validation. Keep each caller's empty-selection meaning (broadcast to all, save without assignment,
  or no material grants), and preserve explicit individual choices when selecting/removing groups.
  Do not replace material grants with snapshot semantics. Update design-system, relevant
  module specs, help articles in ru/en and affected wiki pages alongside the change.

### Stage 259 — Current board preview on exit

- [ ] 259.1 **F** Reproduce stale previews in `boards/editor/{board-page,board-sync,excalidraw-island}.ts`
  and the Materials feed. `flush()` already attempts a preview when a timer is pending: identify the
  missing path rather than adding a second independent exporter. Track scene/preview revisions and
  serialize pending export/upload work; save the latest scene and await its preview before ordinary
  in-app exit unmounts the canvas. Cover changes arriving while a save/export is in flight, live edits,
  missing image files, empty scenes and failed uploads. Define clearing an obsolete preview for an
  emptied board. Preserve the existing unsaved-scene guard and teacher-only upload permissions.
- [ ] 259.2 **B/F** Ensure the returned Materials feed reloads board metadata and invalidates the image
  through `previewUpdatedAt` (`boards/teacher/boards-feed.ts`, `boards-api.ts`, backend boards preview
  controller/service as needed). Test that closing and reopening shows the final image. Treat browser
  tab/window termination separately: asynchronous work on unload is not guaranteed; keep background
  previews/visibility flush and document the actual guarantee. Update `docs/modules/boards.md` and
  help/wiki if the observable behavior changes.

### Stage 260 — A lesson with repetition instead of a standalone regular lesson

- [ ] 260.1 **B/F** Specify and record the unified contract in a new ADR: a lesson has
  one-off or weekly repetition with an interval of 1, 2, 3 or 4 weeks, all selectable for new and existing
  lessons, with weekday/time derived from its date and an optional repeat end date.
  Remove standalone Series domain/API/UI CRUD; retain only the internal metadata needed to generate
  occurrences. Define occurrence identity, timezone/DST behavior, generation horizon, exceptions,
  concurrency and recurrence boundaries. Preserve every existing repeat interval and its phase during
  migration, including 3/4-week repeats; never truncate rules to existing generated lessons.
- [ ] 260.2 **B** Add contract/domain tests, then implement lesson-owned repeat rules through
  `TeacherScheduleController`, `ScheduleService`, `ScheduleViews` and `LessonRepository`. Replace
  `SeriesExtension` with idempotent occurrence generation. Cover the phase of all 1–4-week intervals, end dates,
  conflicts, non-working time, group/student access, optimistic locking and duplicate prevention.
  Preserve the current rolling generation horizon unless the ADR justifies a change.
- [ ] 260.3 **B** Add a new Flyway migration from `Series`/`SeriesRepository` storage. Split old
  multi-weekday rules into lesson-owned rules per weekday without changing the original weekly phase.
  Preserve existing lesson UUIDs, UTC/local timing, participants, statuses, original occurrence dates,
  individual moves, completion IDs, student requests and integration references. Preserve rules with no
  upcoming generated lessons and historical/ended rules. Test representative old databases, migrate
  reset SPI/constraints, and remove obsolete storage only after all consumers are converted.
- [ ] 260.4 **B/F** Define and implement change/cancel/delete scopes from a lesson: Only this lesson or
  This and following. Use original occurrence dates to determine the boundary even for moved lessons.
  A one-off edit is an exception; deleted/cancelled occurrences must not regenerate. Switching the
  following scope to Once keeps the selected lesson and stops later repeats. Preserve completed,
  charged and individually modified lessons; disclose the affected set before a bulk action.
- [ ] 260.5 **F** Add Repeat to `schedule/teacher/lesson-dialog.ts` and repeat/scope actions to
  `lesson-details-dialog.ts`. Remove `series-dialog.ts`, Regular tabs/screens/buttons in
  `schedule-page.ts`, standalone series models/API methods and quick-create entries. Convert calendar,
  student-profile and compact flows to the same lesson form. Move `fromTime`/`toTime` helpers out of
  the removed dialog for the non-working-time dialog. Offer Once / Every week / Every 2 weeks /
  Every 3 weeks / Every 4 weeks; cover all five choices and bulk scopes.
- [ ] 260.6 **B** Convert `SeriesScheduled`/`SeriesStopped` consumers through `schedule::api`; verify
  notifications, reminder rescheduling, student requests, archived groups, ICS and Google Calendar.
  Keep billing driven by individual lesson outcomes and preserve `completionId` idempotency. Automatic
  generation must not flood recipients; mass changes must remove stale external events without
  duplicates. Update schedule/notification specs, design-system, glossary, wiki and help ru/en.

### Stage 261 — Assignment editor with a supporting AI pane (variant 1 selected)

- [ ] 261.1 **F** Specify the selected variant 1 for `homework/teacher/assignment-editor-page.ts` using
  current pane/header/form patterns. Main pane: title, recipients/deadline, Markdown Text/Preview,
  materials and videos. Supporting pane: AI request, prompts, sources and generated draft, on the right
  at wide widths; open it as a modal supporting panel on compact screens, following the review page.
  Preserve request/draft/source state when closing or adapting the AI pane, and define focus return and
  reading order. Inventory every current control before moving it. M3 provides the supporting-pane/
  adaptive patterns; grouping, proportions and compact presentation are portal decisions.
- [ ] 261.2 **F** Implement variant 1; reuse the review page's AI pane patterns and the
  picker from stage 258. Retain title, Markdown Text/Preview, recipients and deadline (including manual
  override and automatic nearest-lesson selection), attachments, textbook bindings/pages, videos and
  transcripts (YouTube subtitles/language, uploaded .srt/.vtt/.txt and student visibility), create/edit
  routes, validation, issue/save, issue-and-place-on-board and the unsaved-changes guard. Preserve the
  existing separate file/textbook management path when editing an issued assignment and the save-
  materials-before-notifying order. Retain AI request, prompt library/search/save, source selection
  from textbooks/PDF/images/transcripts, generation/loading/error/retry states and draft Remove/Insert/
  Replace actions; never overwrite authored text without explicit application. Inventory the
  exact current controls in 261.1 and check each after the move; no parallel Markdown preview column.
- [ ] 261.3 **F** Test authoring, editing, preview, attachments/textbooks/videos, AI interactions, both submit
  actions and leaving with changes. Check compact/desktop, long content, keyboard focus, dark theme
  and 200% text scaling. Update `docs/design-system.md`, homework/AI specs and help/wiki in the same step.

### Stage 262 — Release 0.29.0

- [ ] 262.1 **B/F** Add `e2e/tests/version-0-29-0.spec.ts`: search overflow, full-width material search,
  combined recipients, preview after exiting a board, material card bounds, profile label surfaces,
  assignment-editor variant 1 and all five repeat choices. Exercise a one-off lesson converted to a repeat,
  one moved occurrence, a following-occurrences change and stopping repeats; check the student view.
  Use targeted tests during implementation, then the required part verification before each commit;
  run final full verification and E2E on a fresh instance. Record unavailable checks honestly.
- [ ] 262.2 **B/F** Follow the release skill: audit ru/en help and Russian wiki, add the 0.29.0 changelog,
  bump backend/frontend versions and lockfile metadata, archive this plan and update its archive index.
  Complete release checks before the release commit; publish/tag as part of the agreed release workflow.

## Backlog

Colours of students and groups after 0.20.0: rows without an avatar (the student table of the monthly report,
homework and board lists by name) and the options of student / group selects.

Carried over from 0.6.13 (design audit 2026-09-29, `archive/audit/`):
- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation or
"Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times in the
portal time zone; picking a reschedule time from free slots; file check before upload; journal filters in
the URL; prompt on leaving unsaved settings; invitation and first-run fixes; list-detail for the review
queue; filter chips instead of toggles. *List-detail for the review queue, «Следующая работа», filter chips and
search in long lists are planned in the redesign (stages 237, 242, 248).*

Calls after 0.8.0: call history; teacher moderation (mute / remove a participant); chat in the call;
«ученик ждёт» notification (LiveKit webhooks); opening the student's board from the call; Document
Picture-in-Picture; noise suppression; recording.
