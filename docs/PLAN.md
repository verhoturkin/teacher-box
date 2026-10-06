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

## v1.8.1

Goals: fixes in the built-in calls (dropdown and toggle shapes, the devices menu, a movable self-view, no
tooltips, steadier sound) and in the build: CI checks the nginx image again, and the single-container variant is
removed — Teacher Box ships only as the split variant.

ADR: [0031](adr/0031-split-variant-only.md) (replaces the single variant of ADR-0004).

### Stage 108. Call fixes

- [x] 108.1 **F** Shapes: the selected/first/last option of a `p-select` list is rounded like a menu item
  (the rule moves from the menu preset `css`, where `select-style` overrode it, to `styles.scss`); the microphone
  and camera toggles stay round when off (error container colour instead of a square shape). `styles.scss`,
  `core/theme/teacher-box-preset.ts`, design system §13.
- [x] 108.2 **F** `meetings/call/call-controls.ts`: the devices menu opens above the call window (its z-index was
  under the window's 1050); no tooltips on the call buttons (`call-controls.ts`, `call-prejoin.ts`,
  `call-mini.ts`).
- [x] 108.3 **F** The own camera in a one-to-one call is a floating tile in a corner of the stage, dragged to any
  corner (remembered on the device) or moved with the arrow keys: `call/call-self.ts`, the drag shared with the
  mini window (`call/call-corner.ts`), `call-window.ts`, `styles.scss`, help «Звонки».
- [x] 108.4 **F D** Stuttering sound: capture without the browser's voice isolation (`livekit-engine.ts`), the
  causes and the server checks in `docs/operations.md` and `docs/modules/meetings.md`.
- [ ] 108.5 **F** Sound processing in the devices menu: «Эхоподавление», «Шумоподавление», «Автоусиление
  громкости» (checkable, remembered on the device, applied by restarting the microphone):
  `AudioProcessing` in `call-engine.ts`, `CallDevices`, `CallSession.setAudioProcessing`, `livekit-engine.ts`.
- [ ] 108.6 **F** «Сведения о связи» from the devices menu: participants' connection quality, the transport
  (UDP/TCP, direct / through NAT / TURN, ports, round trip, bandwidth), received sound (loss, jitter, concealed
  share), sent sound loss, video sizes and why the sent one is limited, LiveKit version; refreshed every 2 s.
  `CallConnection.stats()`, `readStats` in `call-stats.ts`, `call/call-stats-dialog.ts`.

### Stage 109. Build

- [x] 109.1 **D** `docker/Dockerfile` target `frontend` gets `LIVEKIT_URL=http://livekit:7880` by default, so
  `nginx -t` (CI) and a container started without the variable get a valid config.
- [x] 109.2 **D B** Remove the single variant: `compose.single.yaml`, Dockerfile targets `single`/`single-build`,
  the Maven profile `bundle-frontend`, `platform/web/SpaWebConfigurer`; E2E runs on the split variant
  (`e2e/compose.e2e.yaml`, `scripts/e2e.sh`, the extra proxy goes); `scripts/verify.sh`, CI, README,
  `docs/operations.md` (moving from single), `.env.example`, AGENTS.md; ADR-0031.

### Stage 110. Release 1.8.1

- [ ] 110.1 Help, CHANGELOG, version 1.8.1, plan archived (skill `release`).

## Backlog

Carried over from 1.6.13 (design audit 2026-09-29, `archive/audit/`):
- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation or
"Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times in the
portal time zone; picking a reschedule time from free slots; file check before upload; journal filters in
the URL; prompt on leaving unsaved settings; invitation and first-run fixes; list-detail for the review
queue; filter chips instead of toggles.

Calls after 1.8.0: call history; teacher moderation (mute / remove a participant); chat in the call;
«ученик ждёт» notification (LiveKit webhooks); opening the student's board from the call; Document
Picture-in-Picture; noise suppression; recording.

Future:
- Two-way Google Calendar sync.
- Board templates / duplicating.
- Lesson packages/subscriptions, online payment.
- Telegram login, 2FA for teacher and administrator.
- WhatsApp and e-mail channels.
- AI hints for students with quotas.
