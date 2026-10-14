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

## Next release — M3 Expressive alignment (0.16.0)

Goals: bring the theme back to M3 Expressive where it drifted (audit 2026-10-14, cross-checked with a second
review): fix breaches of our own rules, button and group geometry, springs, the nested-corner rule, the
emphasized type scale, the flexible navigation bar. No change of button colours or sizes here — those need the
teacher's decision (next section).

ADR: **ADR-0044** «Выравнивание по M3 Expressive, октябрь 2026» (stage 199: weight 700 for emphasized styles,
dialog surface, nested corners; stage 200: flexible navigation bar).

**How to work these stages** (read before any substep):
- M3 values come from the `m3-expressive` skill (`references/component-tokens.md`, `tokens.md`,
  `components/*.md`), never from memory. A value M3 doesn't publish is written in the commit and in
  `design-system.md` as our decision.
- Every substep updates its section of `docs/design-system.md` in the same commit and is checked in the preview
  (`npm start`, both themes, a phone width of 360 px and 200 % font) with the default portal colour `#0f766e` and
  one light preset colour.
- Verified as **not** a problem (don't redo): the loading indicator under `prefers-reduced-motion` (the preset's
  `.p-progressspinner::after` `!important` rule beats `*::after` by specificity — confirm once in 197.1); the help
  side sheet title in Title Large (M3 side sheet headline, design-system §8); button `paddingY` (0.5625 rem + 1 px
  borders = 40 px, E2E checks it).

### 197. Breaches of our own rules (F)

- [ ] 197.1 **F** Loading indicator, `core/theme/teacher-box-preset.ts` (`.p-progressspinner`, ~line 615): the
  shape in the `primary-container` container is `primary` — with the Fidelity scheme the container keeps the
  portal colour and the shape nearly vanishes. M3: contained active indicator → **on-primary-container**, shape
  38 dp in a 48 dp container (`::after` 60 % → 79 %). Check the reduced-motion pulse stays a circle.
- [ ] 197.2 **F** `features/ai/homework-ai-panel.ts` lines 79, 88, 97, 194, 201, 208: drop `size="small"` (40 px
  rule, §7); check the bar wraps on a phone. Add the assignment editor to the page list of the «no outlined,
  small…» check in `e2e/tests/version-0-6-5.spec.ts`.
- [ ] 197.3 **F** `features/meetings/call/call-window.ts:74`: the M2-style ring `tb-call-spinner` →
  `<p-progressspinner>` (label from `t`); delete `.tb-call-spinner` and `@keyframes tb-call-spin`
  (`styles.scss` ~3013–3032). Update `call-window.spec.ts`.
- [ ] 197.4 **F** Aura tokens → `--p-md-*` roles (§2): `core/i18n/language-picker.ts` (also `border-radius:
  1.25rem` → `var(--tb-shape-button)`), `core/portal/portal-logo.ts:26`, `features/home/first-run-checklist.ts:90`,
  `features/notifications/teacher/bot-wizard-dialog.ts` (~315–372; `:disabled` `opacity: 0.6` → content colour at
  `--tb-state-disabled-content`), `features/schedule/teacher/lesson-details-dialog.ts:362`
  (`--p-highlight-background` → secondary-container + on-secondary-container),
  `features/settings/portal-settings-card.ts` (~211–240; `#fff` on the swatches: keep only if the check mark is
  ≥ 3:1 on every preset swatch, otherwise take the swatch's on-colour), `shared/ui/fold-card.ts:82`.
- [ ] 197.5 **F** Focus rings and state layers (§1, §11): `shared/ui/search-field.ts:106` and `styles.scss` ~1597
  (`2px primary` → `3px secondary`, offset 2 px); `styles.scss` ~1603 `filter: brightness(0.92)` → hover state
  layer via `color-mix`; `.tb-fc-button:disabled` (~1496) `opacity: 0.38` → container 12 % / content 38 %;
  `core/layout/shell.scss` and `side-nav.scss` literal `opacity: 0.08 / 0.1` → `--tb-state-hover` / `-focus`.
  Leave the sheet handle (`opacity: 0.4`, ~2255): M3 drag handle.
- [ ] 197.6 **F** Guard test `core/theme/design-rules.spec.ts` (reads `src/app/**` as text): fails on
  `--p-primary-color|--p-text-|--p-content-|--p-highlight-`, `size="small"`, `outlined`, hex colours outside
  `core/theme/` and `boards/` (Excalidraw colours). Remove «CI check for unused design tokens» from Backlog if
  it is covered here.

### 198. Springs and buttons (F)

- [ ] 198.1 **F** Spring tokens, `styles.scss` ~104–132: add `--tb-spring-slow-spatial` (0.8 / 200),
  `--tb-spring-default-effects` (1.0 / 1600), `--tb-spring-slow-effects` (1.0 / 800) and, for the split button,
  `--tb-spring-standard-fast-spatial` (Standard scheme 0.9 / 1400). Compute `linear()` + duration with a scratch
  script the same way as the existing ones (sample the damped spring, stop within 0.001 of 1, ~32 points); keep
  the `/* damping / stiffness */` comments. Don't use the cubic-bezier fallback table. Delete unused
  `--tb-motion-standard`, `--tb-duration-short`. `shapeTransition()` in the preset (~315): colours, outline and
  shadow on `--tb-spring-fast-effects` instead of PrimeNG's duration.
- [ ] 198.2 **F** Button geometry, preset `button` (~442–461) and `togglebutton`: M3E small button —
  `paddingX` 1.5 rem → **1 rem** (16 dp), icon **20 px** (`.p-button-icon` 1.25 rem), pressed corner
  `--tb-shape-md` → **`--tb-shape-sm`** (CornerSmall, 8 dp), also `styles.scss` `:active` rules (~230, ~240,
  ~1481, ~1904). Check `tb-button-steady`, page-header buttons, the phone's equal-width actions. §1 shape table
  and §7 («shape morphs to 8 px»).
- [ ] 198.3 **F** Connected groups pressed: `p-selectbutton` (preset ~607) and `.tb-fc-segment` (`styles.scss`
  ~1523) now grow every corner to 12 px; like `.tb-button-group` (~2193) the pressed button's inner corners narrow
  to `--tb-shape-xs`. First check in the browser that `p-selectbutton`'s outer corners are full (PrimeNG's own
  `:first-child` rules) — fix only if not.
- [ ] 198.4 **F** Split button `.tb-split` (`styles.scss` ~2143, `schedule/.../join-lesson-button.ts`): trailing icon
  22 dp (now 14 px); the chevron turns 180° while the menu is open, on `--tb-spring-standard-fast-spatial` (M3:
  the split button rotates with the standard scheme — no bounce); pressed, the inner corners morph.
- [ ] 198.5 **F** *(our decision, not M3)* Menus `p-menu` (preset ~506): items next to a separator get the 12 px
  outer corners, so each group reads as one segment, as our lists do. On the web M3 separates menu groups with a
  divider (no gaps) — keep the divider.

### 199. Shape and type (F, ADR-0044)

- [ ] 199.1 **F** Nested corners (`inner = outer − padding`): on a phone a card (20 px) holds a list with 12 px
  around it, so tiles should end at 8 px, not 16. Set `--tb-list-outer` per container: phone card
  `calc(var(--tb-shape-lg-plus) - var(--tb-space-3))`; measure the padding around lists on a computer and in
  dialogs and apply the same rule (never below `--tb-shape-xs`); a single tile stays fully round. Same for
  `p-table.tb-cards`. §1, §9.
- [ ] 199.2 **F** Type scale, `styles.scss` ~43–65: add the emphasized tokens M3E gives **Bold (700)** — Title
  M/S, Label L/M/S — and Display S (36/44) and Headline L (32/40) with emphasized variants and tracking tokens.
  Change §3 «Weights 400 and 500 only» → 700 only through the emphasized tokens. Font already has 400–700.
- [ ] 199.3 **F** Navigation active item (flexible bar and vertical rail item, M3E): label colour
  `on-surface` → **secondary** (`core/layout/shell.scss` ~211, `side-nav.scss` ~177 — in the rail only the icon
  changes now); label Label M emphasized (bold) instead of a filled icon (primeicons have none — M3 allows a
  heavier label/icon then). Check «never truncated» at 360 px and 200 % font; if bold doesn't fit, keep 500 and
  note it in §4.
- [ ] 199.4 **F** *(our decision)* Hero time: `schedule/home/next-lesson-widget.ts` / `upcoming-lesson-widget.ts`,
  `tb-lesson-time-tile` — start time in Display S emphasized instead of Headline M (the one hero moment of the
  portal); check the narrow card layout. §5.
- [ ] 199.5 **F** Dialog surface: preset `overlay.modal` (~82) `card` (surface-container-lowest) → M3
  **surface-container-high**; dialogs' lists then need a tile colour that differs from it (decide:
  surface-container-lowest or -highest), tested in `core/theme/color-scheme.spec.ts` for both themes. §2.
- [ ] 199.6 **F** *(optional)* Dark theme grade: `@use '…/google-sans/wght.css'` → the file with the GRAD axis,
  `font-variation-settings: 'GRAD' -25` in the dark theme (M3: a negative grade so light text doesn't look
  heavier). Do it only if the font grows by < 10 % in `npm run build` stats.
- [ ] 199.7 ADR-0044 + row in `docs/adr/README.md`.

### 200. Navigation and motion (F)

- [ ] 200.1 **F** Flexible navigation bar: `--tb-bottom-nav-height` 80 → **64 px**, item padding, indicator
  64×32 → **56×32**, no top border (`shell.scss` ~108–222). Dependants: `shared/ui/fab-menu.ts:74`, `styles.scss`
  ~1880, 1940, 1949, 2969, 2987 (FAB, snackbar, call mini window), `shell.scss:104`. Rail collapsed 88 → **96 px**
  (`side-nav.scss:104`). §4, ADR-0044.
- [ ] 200.2 **F** Springs for overlays: dialogs, bottom sheet, side sheet, menus, snackbar — size/position on
  spatial, opacity on effects springs (now PrimeNG animations). First read the PrimeNG 21 motion/animation API
  (context7); `core/snackbar` is ours. Reduced motion: no movement. §1 («dialogs and snackbar keep PrimeNG
  animations» goes).
- [ ] 200.3 **F** *(decide first; §13 says «stays round»)* Call toggles (`styles.scss` ~2800–2818): an
  off/active toggle turns from round to a rounded square (M3E icon button selected shape) on the fast spatial
  spring.

### 201. Release 0.16.0

- [ ] 201.1 Skill `release`: help articles (if any text changed), E2E spec `version-0-16-0` (button 40 px with
  16 px padding, nav bar 64 px, no `size="small"` in the editor), CHANGELOG, version, plan archiving.

## Later — decisions for the teacher (M3 Expressive, each its own ADR and release)

- **Button colours** (ADR superseding part of ADR-0026): main action filled **primary**, red only for an
  irreversible confirmation, green/amber only for statuses. Scope: `severity="success"` (56 uses) and
  `"danger"` (37) in `frontend/src/app`, `shared/ui/confirmation` (`safeConfirmation` is green), E2E
  `version-0-6-5.spec.ts`, `version-0-6-12.spec.ts`, the help article on the portal colour
  (`help/articles/teacher.ru.ts` ~523: the warning about a green portal colour), the ΔE check in
  `core/theme/portal-accent.ts`, design-system §7.
- **Button sizes**: M (56 dp, icon 24, padding 24, pressed CornerMedium) for one hero action («Начать урок»);
  E2E 40 px checks get that exception; §7.
- **Icons with filled variants** (filled icon for the active section, M3): primeicons have none; 97 distinct
  `pi-*` icons in use; compare sets (licence, bundle size, coverage of those 97, filled variants); the
  design-system intro forbids Material Symbols today.

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
