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

## v0.32.0

Let the teacher choose the portal's M3 colour scheme and contrast through named options.
Redesign Settings → Portal around identity, appearance and an interactive preview; preserve existing branding on upgrade.
Selected design: the scheme gallery with name/logo and a local preview, a standard set of source colours
inspired by Pantone selections, and an M3-styled popup custom colour picker with HEX input.
Increase baseline tonal-block separation by one surface-role step in the light theme.

### 273. Persist portal appearance preferences (B)

- [x] **273.1** Extend `platform/portal/PortalSettings`, `PortalService`, `PortalSettingsRepository` and
  `web/PortalController` with validated colour-scheme and named contrast preferences; add a platform Flyway
  migration with Fidelity / standard defaults. Cover teacher writes, public reads, student/admin rejection,
  legacy requests, backup/restore and reset behaviour in the portal tests.

### 274. Generate and apply selectable M3 schemes (F)

- [x] **274.1** Extend `core/portal/portal.ts`, `core/theme/color-scheme.ts`, `portal-accent.ts` and their
  callers to generate all nine MCU variants and four named contrast levels. Reapply the theme when only
  scheme or contrast changes; retain the portal's readability guarantees and semantic custom colours in
  both themes. Test presets/custom accents, effective spec fallback, contrast adjustment, startup and updates.

### 275. Redesign Settings → Portal (F)

- [x] **275.1** Implement the selected layout in `features/settings/portal-settings-card.ts`: portal name,
  logo, preset/custom source colour, scheme, contrast and a local preview. Show contrast as Lower, Standard,
  Higher and Maximum (localized labels only; no numeric levels). Preserve existing branding defaults and
  explicit save behaviour; make dirty preview/reset behaviour clear and support compact screens and keyboard use.
  Update `features/settings/i18n/{ru,en}.ts`, category summary and component tests.
- [x] **275.2** Update `docs/design-system.md`, `docs/modules/platform.md`, the relevant `docs/wiki/` page and
  teacher help articles in both languages; add the appearance regression to the existing functional E2E suite.
  Document actual MCU spec support and the portal's own readability adjustments separately.

- [x] **275.3** Restore the popup custom colour picker in `portal-settings-card.ts`, keep HEX input and local
  preview, and verify popup opening/outside-click dismissal in the settings functional E2E suite.

### 276. Release 0.32.0

- [ ] **276.1** Follow the release skill: run affected-part checks and functional E2E, update the Russian
  CHANGELOG and version files to 0.32.0, archive this plan and update `docs/archive/plans/README.md`.

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
