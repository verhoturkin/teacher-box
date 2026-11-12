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

**Remaining plan backlog: interface consistency, shared components and calls.**

Goals:

- Finish the remaining interface tasks against today's screens, without repeating shipped work.
- Make rescheduling, invitations and technical journal filters easier to use.
- Add call history, moderation, chat, waiting notices, board access and Document Picture-in-Picture.
- Consolidate shared controls and make style maintenance verifiable.

Scope: only the Backlog of this plan, reviewed against 0.47.1. Roadmap proposals are not part of
this release. Recording and the four deferred proposals remain in Backlog below. Free-time
suggestions in stage 386 only improve an existing reschedule request; they do not add self-booking,
public booking, working-window settings or extra-lesson requests.

ADRs to write during implementation: call lifecycle and LiveKit webhooks (amends ADR-0030 and
ADR-0060), ephemeral call chat, Document Picture-in-Picture ownership, and CSS layer ordering.
Allocate ADR numbers from the current index when each stage starts. New notification texts belong
to their business module and use `shared.notice` (ADR-0061).

Order: 383 → 384–387 → 388–389 → 390 → 391–393 → 394. Stages 384–387 can be implemented
independently after the audit; 391–393 build on the call lifecycle in 390. Each implementation
stage gets its own branch from current main and a pull request. This change only writes the plan.
All UI implementation uses the `m3-expressive` skill and updates the gallery for shared controls.

### Stage 383 — reconcile the old audit with current screens (F)

- [ ] 383.1 **F** Recheck DA-081/DA-082 in
  `docs/archive/audit/design-audit-2026-09-29-findings.md` against `docs/screens/` and the named
  current components. Add a compact finding table to this section: reproduction, current file,
  expected behaviour and a regression check. Close findings whose screen or cause disappeared;
  only reproduced defects enter 383.2. Do not revive historical markup requirements.
- [ ] 383.2 **F** Fix the confirmed layout findings in their owning components. Check compact and
  wide layouts, keyboard navigation and both themes; use the existing `e2e/tests/layout/` suites.
  Record which old findings were fixed or no longer apply.
- [ ] 383.3 **F** Recheck invitation and first-run findings against
  `features/identity/invite/invite-page.ts`, `features/settings/setup/steps/` and
  `docs/screens/today.md`. Separate broken flows from intentional current behaviour (including
  hiding completed onboarding steps); add concrete remaining fixes to stage 387 before coding.

### Stage 384 — student and group colour cues (F)

- [ ] 384.1 **F** Audit `features/identity/groups/member-picker.ts`, student/group selectors and
  name-only rows in boards and homework. Reuse identity colour helpers in option templates and
  any rows still missing cues; keep names readable without colour. Do not redo the monthly report
  or review queue, which already have colour cues. Follow feature import directions.
- [ ] 384.2 **F** Add focused component checks for student/group options and rows, keyboard
  selection and missing colours. Update affected screen docs and shared-control gallery samples.

### Stage 385 — portal time zone and journal URLs (F)

- [ ] 385.1 **F** Start with `features/schedule/schedule-labels.ts`, schedule pages and
  `shared/dates/iso-date.ts`. Inventory user-facing timestamps and use the portal time zone
  consistently for lesson labels, details and request previews. Keep date-only values as dates;
  do not shift them through UTC. Use existing portal settings rather than a second source of truth.
- [ ] 385.2 **F** Test a browser zone different from the portal zone, midnight boundaries and DST
  transitions. Update help in both languages to state the displayed zone; verify calendar inputs
  and formatted labels refer to the same instant.
- [ ] 385.3 **F** `features/admin/logs/journal-page.ts`: round-trip view, request ID, period,
  level, text and logger through query parameters. Validate unknown values, preserve unrelated
  parameters, and support reload and browser back/forward without request loops. Tests cover a
  shared URL, clearing filters and malformed parameters.

### Stage 386 — free-time suggestions for a reschedule request (B, F)

- [ ] 386.1 **B** `schedule/application/TeacherAvailability`, `ChangeRequestService` and
  `schedule/web/MyScheduleController`: add bounded suggestions for an existing lesson and chosen
  date using its duration, existing lessons, off-times and Google busy intervals. Exclude the
  moved lesson itself. Define a finite search interval and step in the API contract; label results
  as conflict-free suggestions, not teacher-approved working hours. Expose no busy-event details.
- [ ] 386.2 **B** Keep teacher approval and the existing conflict check when applying the move;
  suggestions never reserve a slot. Test another student's lesson, group lessons, DST, no free
  interval, stale availability and two requests for the same time.
- [ ] 386.3 **F** `features/schedule/student/change-request-dialog.ts`: offer suggestions for the
  selected day and retain manual time entry. Provide loading, empty and retry states and portal
  time-zone labels. Add an E2E request → teacher approval journey and update schedule help/wiki.

### Stage 387 — invitation and first-run fixes (B, F)

- [ ] 387.1 **F** `features/identity/invite/invite-page.ts`: match the server's login constraints
  before submission, show a specific error and keep the entered data after recoverable errors.
  Add boundary tests against the existing server contract; server validation remains authoritative.
- [ ] 387.2 **B, F** Implement only the remaining reproducible invitation/setup defects listed
  by 383.3. Cover expired/used invitations, an already signed-in user, interrupted setup and return
  after completion. Preserve account isolation and the current onboarding decisions unless the
  reproduced defect requires a documented change. Add targeted regression tests and help updates.

### Stage 388 — shared steps and copy field (F)

- [ ] 388.1 **F** Introduce `shared/ui/steps.ts` and `shared/ui/copy-field.ts` following current
  shared UI conventions. Define accessible current/completed step semantics; the copy field has a
  label, selectable value, copy result and clipboard-failure feedback. Do not expose secrets in
  feedback or logs. Add unit tests and gallery samples for all states.
- [ ] 388.2 **F** Replace matching duplicated controls in `features/settings/setup/steps/`,
  invitation links and messenger connection settings. Inventory callers first; preserve their
  current navigation, validation and copy behaviour. Update `docs/design-system.md`.

### Stage 389 — CSS layers and unused-token checks (F, D)

- [ ] 389.1 **F** `app.config.ts`, `core/theme/teacher-box-preset.ts` and `src/styles/`: document
  the layer order in an ADR and enable PrimeNG `cssLayer` using the current supported API.
  Migrate overrides incrementally; remove `::ng-deep` and `!important` only where the layer and
  component boundaries replace them. Document necessary exceptions instead of weakening styles.
- [ ] 389.2 **F** Check the gallery and affected screens in both themes and compact/wide layouts,
  including overlays, focus, disabled controls and reduced motion. Keep CSS budgets unchanged;
  compare built CSS size and run the layout suites before completing the migration.
- [ ] 389.3 **F, D** Add `frontend/scripts/check-design-tokens.mjs` to frontend verification.
  Compare owned token definitions with usages in TypeScript, templates and SCSS; account for
  aliases, generated theme values and dynamic names using an explicit documented allowlist.
  Add fixtures for used, unused, aliased and dynamic tokens. Fix confirmed dead tokens; keep this
  distinct from the existing Aura component-token coverage check.

### Stage 390 — call lifecycle, history and waiting notices (B, F, D)

- [ ] 390.1 **B, D** `meetings/livekit/LiveKitCallServer`, `CallServer`, `compose.yaml` and
  `docker/nginx/default.conf.template`: add verified LiveKit lifecycle webhooks and an ADR.
  Validate the JWT and body digest, reject forged payloads and keep the internal webhook path
  inaccessible through the public proxy. Use current LiveKit/Nimbus documentation.
- [ ] 390.2 **B** Add meetings-owned session/presence persistence and migrations, idempotent event
  processing and reconciliation after missed or reordered events. Include reset/backup handling.
  Define session boundaries and bounded history pagination; preserve history without retaining
  audio/video. Test reconnects, duplicate events, server restart and room termination.
- [ ] 390.3 **B, F** Extend `meetings/web/CallsController.java` and meetings feature parts with
  teacher history and each student's own history: start, end, duration and participants. Compose
  the teacher view in the student card. Test access isolation, group calls and an empty history.
- [ ] 390.4 **B, F** `meetings/application/CallService` and `meetings/notices/`: send a waiting
  notice after 30 seconds of student presence without the teacher, once per waiting episode.
  Cancel it when the student leaves or the teacher joins; a later new episode may notify again.
  Reuse current presence display and notification preferences, with a join link and ru/en texts.
  Test timing with a fixed clock and fake call server; update calls help/wiki and operations docs.

### Stage 391 — teacher moderation (B, F)

- [ ] 391.1 **B** `CallServer`, `LiveKitCallServer` and `CallsController`: teacher-only mute and
  remove actions with room/participant validation. Reuse the existing remove adapter; add the
  mute-track call. Never remotely enable a participant's microphone. Specify removal as removal
  from the current session, not a permanent account ban; test repeat actions and departed users.
- [ ] 391.2 **F** `features/meetings/call/call-tile.ts` and `call-controls.ts`: participant actions
  for the teacher, removal confirmation and failure feedback. Students cannot invoke the server
  actions. Test role checks, room mismatch and updating the participant list; update calls help.

### Stage 392 — ephemeral in-call chat (B, F)

- [ ] 392.1 **B, F** Document a room-scoped, non-persistent text chat in an ADR. Start from
  `call-engine.ts` and `call-session.ts`; use the supported LiveKit data API, bind displayed sender
  identity to the authenticated participant and restrict messages to the joined room. Bound message
  length, local history and send rate; render plain text only. No replay after leaving the call.
- [ ] 392.2 **F** Add a chat panel to `call-window.ts`, unread indication and accessible message
  announcements. Test malformed payloads, sender spoofing, reconnect/room changes, rate limits and
  compact layouts. Explain that chat is temporary in ru/en help and the calls wiki.

### Stage 393 — board shortcuts and Document Picture-in-Picture (F)

- [ ] 393.1 **F** `call-controls.ts`, `call-host.ts` and the existing board feature parts: let the
  teacher choose an accessible student's board from the current call and open it without ending
  the call. Resolve group-room participants explicitly; show an empty state when no board exists.
  Compose across features according to ADR-0058; never bypass board access checks.
- [ ] 393.2 **F** `call-window.ts`, `call-mini.ts` and `call-session.ts`: implement Document PiP
  behind capability detection and a user gesture. One session owns the media connection; moving
  the UI between windows does not create another room connection or microphone track. Restore
  the portal UI when the PiP window closes and clean up on logout or call end. Keep the existing
  in-portal mini-window as the fallback for unsupported browsers.
- [ ] 393.3 **F** Test window open/close failures, return to the main window, board navigation,
  control synchronisation and end-call cleanup. Add supported-browser manual checks and update
  `docs/screens/call.md`, calls help in both languages and the wiki.

### Stage 394 — acceptance and release readiness (B, F, D)

- [ ] 394.1 **B, F, D** Reconcile completed substeps, module docs, screen docs, ADR index, gallery,
  ru/en help and wiki. Verify all new student-data endpoints reject another student and ADMIN.
  Include history, waiting, moderation, chat and PiP checks in the relevant functional suites.
- [ ] 394.2 **B, F, D** Run `scripts/verify.sh` for affected parts and functional E2E on an
  environment supporting the backend and calls. Record actual results and remaining limitations;
  cloud-only checks do not substitute for LiveKit/browser integration. Use the release skill when
  the release is ready; assign its version then and archive this plan only after completion.

## Backlog

Deferred and excluded from the plan above:

- Attachment caching instead of `no-store` in `shared/http/FileDownloads`: decide whether files
  may remain in a private browser cache on a shared computer.
- Load only the selected dictionary language: measured savings were 19 kB initially and 128 kB
  across lazy chunks; deferred because of the change's cost.
- Caddy alone instead of Caddy in front of nginx: changes ADR-0031 and ADR-0032.
- Voice answers using `MediaRecorder`: requires WebM support in `FilePolicy` and `ACCEPTED_FILES`;
  decided against for now.
- Call recording: explicitly excluded from this plan; no egress, recording storage or controls.

The independent proposals in [`roadmap/`](roadmap/README.md) are outside this plan and have not
been selected for implementation.

Backlog reconciliation against 0.47.1: removed shipped undo for missed lessons, list search,
next-work/list-detail review, filter chips, pre-upload file checks, unsaved-settings protection,
noise suppression and colour cues already present in reports/review. `tb-fold-card` is in use and
needs no removal task. Remaining audit findings are verified in stage 383 rather than assumed.
