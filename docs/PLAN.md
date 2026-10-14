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

## Next releases — M3 Expressive alignment (0.16.1–0.16.3)

Goals: bring the theme back to M3 Expressive where it drifted (audit 2026-10-14, cross-checked with a second
review): fix breaches of our own rules, button and group geometry, springs, the nested-corner rule, the
emphasized type scale, the flexible navigation bar. **Each stage is its own release** (the teacher's
decision of 2026-10-14): 199 → 0.16.0, 200 → 0.16.1, 201 → 0.16.2, 202 → 0.16.3; each ends with skill
`release` (E2E spec of its version, CHANGELOG, version, archiving of its stage). Button colours and sizes and
the icon set change in 0.17.0 (next section, decided by the teacher on 2026-10-14).

ADR: **ADR-0044** «Выравнивание по M3 Expressive, октябрь 2026» (stage 201: weight 700 for emphasized styles,
dialog surface, nested corners; stage 202: flexible navigation bar).

**How to work these stages** (read before any substep):
- M3 values come from the `m3-expressive` skill (`references/component-tokens.md`, `tokens.md`,
  `components/*.md`), never from memory. A value M3 doesn't publish is written in the commit and in
  `design-system.md` as our decision.
- Every substep updates its section of `docs/design-system.md` in the same commit and is checked in the preview
  (`npm start`, both themes, a phone width of 360 px and 200 % font) with the default portal colour `#0f766e` and
  one light preset colour.
- Verified as **not** a problem (don't redo): the loading indicator under `prefers-reduced-motion` (the preset's
  `.p-progressspinner::after` `!important` rule beats `*::after` by specificity — confirmed in 199.1, 0.16.0);
  the help side sheet title in Title Large (M3 side sheet headline, design-system §8); button `paddingY`
  (0.5625 rem + 1 px borders = 40 px, E2E checks it).

### 200. Springs and buttons (F)

- [x] 200.1 **F** Spring tokens, `styles.scss` ~104–132: add `--tb-spring-slow-spatial` (0.8 / 200),
  `--tb-spring-default-effects` (1.0 / 1600), `--tb-spring-slow-effects` (1.0 / 800) and, for the split button,
  `--tb-spring-standard-fast-spatial` (Standard scheme 0.9 / 1400). Compute `linear()` + duration with a scratch
  script the same way as the existing ones (sample the damped spring, stop within 0.001 of 1, ~32 points); keep
  the `/* damping / stiffness */` comments. Don't use the cubic-bezier fallback table. Delete unused
  `--tb-motion-standard`, `--tb-duration-short`. `shapeTransition()` in the preset (~315): colours, outline and
  shadow on `--tb-spring-fast-effects` instead of PrimeNG's duration.
- [x] 200.2 **F** Button geometry, preset `button` (~442–461) and `togglebutton`: M3E small button —
  `paddingX` 1.5 rem → **1 rem** (16 dp), icon **20 px** (`.p-button-icon` 1.25 rem), pressed corner
  `--tb-shape-md` → **`--tb-shape-sm`** (CornerSmall, 8 dp), also `styles.scss` `:active` rules (~230, ~240,
  ~1481, ~1904). Check `tb-button-steady`, page-header buttons, the phone's equal-width actions. §1 shape table
  and §7 («shape morphs to 8 px»).
- [ ] 200.3 **F** Connected groups pressed: `p-selectbutton` (preset ~607) and `.tb-fc-segment` (`styles.scss`
  ~1523) now grow every corner to 12 px; like `.tb-button-group` (~2193) the pressed button's inner corners narrow
  to `--tb-shape-xs`. First check in the browser that `p-selectbutton`'s outer corners are full (PrimeNG's own
  `:first-child` rules) — fix only if not.
- [ ] 200.4 **F** Split button `.tb-split` (`styles.scss` ~2143, `schedule/.../join-lesson-button.ts`): trailing icon
  22 dp (now 14 px); the chevron turns 180° while the menu is open, on `--tb-spring-standard-fast-spatial` (M3:
  the split button rotates with the standard scheme — no bounce); pressed, the inner corners morph.
- [ ] 200.5 **F** *(our decision, not M3)* Menus `p-menu` (preset ~506): items next to a separator get the 12 px
  outer corners, so each group reads as one segment, as our lists do. On the web M3 separates menu groups with a
  divider (no gaps) — keep the divider.

- [ ] 200.6 Release 0.16.1 (skill `release`): E2E spec `version-0-16-1` — button 40 px with 16 px padding,
  pressed groups.

### 201. Shape and type (F, ADR-0044)

- [ ] 201.1 **F** Nested corners (`inner = outer − padding`): on a phone a card (20 px) holds a list with 12 px
  around it, so tiles should end at 8 px, not 16. Set `--tb-list-outer` per container: phone card
  `calc(var(--tb-shape-lg-plus) - var(--tb-space-3))`; measure the padding around lists on a computer and in
  dialogs and apply the same rule (never below `--tb-shape-xs`); a single tile stays fully round. Same for
  `p-table.tb-cards`. §1, §9.
- [ ] 201.2 **F** Type scale, `styles.scss` ~43–65: add the emphasized tokens M3E gives **Bold (700)** — Title
  M/S, Label L/M/S — and Display S (36/44) and Headline L (32/40) with emphasized variants and tracking tokens.
  Change §3 «Weights 400 and 500 only» → 700 only through the emphasized tokens. Font already has 400–700.
- [ ] 201.3 **F** Navigation active item (flexible bar and vertical rail item, M3E): label colour
  `on-surface` → **secondary** (`core/layout/shell.scss` ~211, `side-nav.scss` ~177 — in the rail only the icon
  changes now); label Label M emphasized (bold), as M3 pairs it with the filled icon (the filled icon
  comes with Material Symbols in 206.5). Check «never truncated» at 360 px and 200 % font; if bold doesn't fit, keep 500 and
  note it in §4.
- [ ] 201.4 **F** *(our decision)* Hero time: `schedule/home/next-lesson-widget.ts` / `upcoming-lesson-widget.ts`,
  `tb-lesson-time-tile` — start time in Display S emphasized instead of Headline M (the one hero moment of the
  portal); check the narrow card layout. §5.
- [ ] 201.5 **F** Dialog surface: preset `overlay.modal` (~82) `card` (surface-container-lowest) → M3
  **surface-container-high**; dialogs' lists then need a tile colour that differs from it (decide:
  surface-container-lowest or -highest), tested in `core/theme/color-scheme.spec.ts` for both themes. §2.
- [ ] 201.6 **F** *(optional)* Dark theme grade: `@use '…/google-sans/wght.css'` → the file with the GRAD axis,
  `font-variation-settings: 'GRAD' -25` in the dark theme (M3: a negative grade so light text doesn't look
  heavier). Do it only if the font grows by < 10 % in `npm run build` stats.
- [ ] 201.7 ADR-0044 + row in `docs/adr/README.md`.

- [ ] 201.8 Release 0.16.2 (skill `release`): E2E spec `version-0-16-2`.

### 202. Navigation and motion (F)

- [ ] 202.1 **F** Flexible navigation bar: `--tb-bottom-nav-height` 80 → **64 px**, item padding, indicator
  64×32 → **56×32**, no top border (`shell.scss` ~108–222). Dependants: `shared/ui/fab-menu.ts:74`, `styles.scss`
  ~1880, 1940, 1949, 2969, 2987 (FAB, snackbar, call mini window), `shell.scss:104`. Rail collapsed 88 → **96 px**
  (`side-nav.scss:104`). §4, ADR-0044.
- [ ] 202.2 **F** Springs for overlays: dialogs, bottom sheet, side sheet, menus, snackbar — size/position on
  spatial, opacity on effects springs (now PrimeNG animations). First read the PrimeNG 21 motion/animation API
  (context7); `core/snackbar` is ours. Reduced motion: no movement. §1 («dialogs and snackbar keep PrimeNG
  animations» goes).
- [ ] 202.3 **F** *(decide first; §13 says «stays round»)* Call toggles (`styles.scss` ~2800–2818): an
  off/active toggle turns from round to a rounded square (M3E icon button selected shape) on the fast spatial
  spring.
- [ ] 202.4 Release 0.16.3 (skill `release`): E2E spec `version-0-16-3` — nav bar 64 px.

## Release 0.17.0 — M3 Expressive buttons and icons

Goals (the teacher's decisions of 2026-10-14): one accent — every main action is filled **primary** (the portal
colour), green and amber only for statuses; red only where an action destroys something; one large button, the
hero «Начать урок»; Material Symbols Rounded instead of primeicons, with a filled icon for the active section.

ADR: **ADR-0045** «Кнопки: цвет — акцент, а не смысл; размер M для героя» (supersedes the colour part of
ADR-0026 and ADR-0019); **ADR-0046** «Material Symbols Rounded вместо primeicons» (changes the design-system
intro: «no Material Symbols» goes).

### 204. One accent for buttons (F, ADR-0045)

Rules after this stage (design-system §7 rewritten): filled — the page's main action and a dialog's submit, always
primary; tonal — secondary actions, neutral `secondary` only (no coloured tonal: `tb-tonal` + severity goes);
text — «Отмена» and labelled row actions; filled **danger** — only the confirmation of an irreversible action in
a dialog (`dangerConfirmation`); red also stays on the bin icon button and «Удалить…» menu items
(`tb-menu-item--danger`). «Пропуск», «Вернуть на доработку», «Отменить занятие…» on a page or in a row become
neutral tonal/text — the status they produce shows the meaning.

- [ ] 204.1 ADR-0045 + row in `docs/adr/README.md`; design-system §7 tables (role → variant; meaning → colour
  rows go), §8 confirmations, §11 E2E list. Mark ADR-0019 / ADR-0026 as partly superseded.
- [ ] 204.2 **F** Shared parts: `shared/ui/confirmation` — `safeConfirmation` filled primary (now success);
  `danger` unchanged. `styles.scss` `@each $role…` coloured tonal (~221) goes with its uses
  (`styleClass="tb-tonal"`, 26 uses — grep). Preset `BUTTON_SCHEME` keeps success/warn only if a tag or message
  needs it (buttons don't).
- [ ] 204.3 **F** Features: every `severity="success"` on a button (56 uses, `rg 'severity="success"'
  frontend/src/app`) → no severity (primary); every `severity="danger"` (37 uses) reviewed against the rules
  above. Go module by module (identity, billing, homework, schedule, settings/admin, the rest), one commit per
  module if the diff is large. Tags (`p-tag`) and messages keep their severity.
- [ ] 204.4 **F** Portal colour: `core/theme/portal-accent.ts` (~100) — the «alike success» warning goes (no green
  buttons now); keep «alike error» (red still marks danger). Texts in `features/settings/i18n/{ru,en}.ts`, tests
  `portal-settings-card.spec.ts`, `portal-accent.spec.ts`; help article `help/articles/teacher.{ru,en}.ts` ~523
  (the paragraph on the green portal colour), grep help articles for «зелён» / «green».
- [ ] 204.5 E2E: `e2e/tests/version-0-6-5.spec.ts` (one filled button per page — still holds),
  `version-0-6-6.spec.ts` (green/red buttons by meaning — rewrite: no `p-button-success` on buttons; red only on
  danger confirmations, bin icons), `version-0-6-12.spec.ts`. Help articles that say a button is green.

### 205. One large button (F, ADR-0045)

- [ ] 205.1 **F** Button M (M3E `ButtonMedium`: 56 dp, full corners, pressed CornerMedium 12 dp, icon 24 dp,
  padding 24 dp, label — our decision: Title Medium) as a class `tb-button-m` in `styles.scss`, also for the split
  button (`tb-split--m`: trailing part 56 dp, inner corners per M3E `SplitButtonMedium` from the skill).
- [ ] 205.2 **F** Use it only in the hero: `schedule/home/next-lesson-widget.ts`, `upcoming-lesson-widget.ts`,
  `join-lesson-button.ts` («Начать урок» / «Войти в урок», `tb-join-wide` on a narrow card). §5 «Nearest lesson
  hero», §7 «Size is one» → «one exception». E2E 40 px checks (`version-0-6-12`, `version-0-6-13`) skip it; a new
  check that the hero button is 56 px.

### 206. Material Symbols Rounded (F, ADR-0046)

Decisions: the full variable font from npm (package `material-symbols`, rounded style; self-hosted, no CDN;
CSP `font-src 'self'` already allows it), `font-display: block` so icon names never flash as text; visible
PrimeNG icons replaced too; primeicons removed at the end.

- [ ] 206.1 **F** Spike + ADR-0046: install the package (`npx -y npm@11 install`), import only the rounded CSS in
  `styles.scss`; measure the woff2 size and the first load on a phone profile; check `docker/nginx` caches the
  hashed font for long. Check that a ligature works from CSS generated content (`::before { content: 'home' }`) —
  `p-button [icon]` takes only classes, so icons are classes `tb-i tb-i-<name>`. If it doesn't work, stop and
  return to the teacher with the numbers (the SVG option was the alternative).
- [ ] 206.2 **F** Icon layer in `styles.scss` (section «Icons»): `.tb-i` (font, 24 px, `'FILL' 0, 'wght' 400,
  'GRAD' 0, 'opsz' 24`, `aria-hidden` by usage), size tokens `--tb-icon-size` (24; 20 in buttons — M3E button
  icon; 18 in chips), `.tb-i--filled` (`'FILL' 1`); a generated list of `.tb-i-<name>::before` classes from one map
  `core/theme/icons.scss` (the only place names live). Dark theme `'GRAD' -25` together with 201.6.
  The board icon: a Material Symbol replaces the Tabler mask `pi-tb-board`.
- [ ] 206.3 Mapping table «pi-* → symbol» for all 97 icons in use (`rg -o 'pi-[a-z0-9-]+' frontend/src/app | sort
  -u`) in design-system (new §1 «Icons»): one meaning — one symbol; review it with the teacher before 206.4.
- [ ] 206.4 **F** Replace usages, one commit per group: `core/` + `shared/` + `app.ts`; homework; notifications;
  boards; meetings; schedule; settings + admin; billing + identity + textbooks + ai + home + help. Specs that
  query `.pi-*` change with them.
- [ ] 206.5 **F** Navigation: the active section's icon filled (`'FILL' 1`, the change on
  `--tb-spring-fast-effects`) + bold label (201.3) — `core/layout/shell.scss`, `side-nav.scss`, `NAV_ITEMS` in
  `shell.ts`. §4.
- [ ] 206.6 **F** Visible PrimeNG icons: select / multiselect arrow, dialog and drawer «×», date picker
  (calendar, arrows), checkbox tick, paginator, tag/message icons, toast. First read PrimeNG 21 icon templates
  (context7: `#dropdownicon`, `#closeicon`…); prefer one shared place (`core/a11y/pass-through.ts` or wrapper
  templates) over per-use templates; list what stays PrimeNG's own SVG and why.
- [ ] 206.7 **F** Remove `primeicons` (package, CSS import, `pi-tb-board` mask); the guard test of 199.6 fails on
  `pi pi-` / `pi-`; E2E selectors with `.pi-*` (7 in `e2e/tests`) → accessible names or `.tb-i-*`. Design-system
  intro and §1 updated.

### 207. Release 0.17.0

- [ ] 207.1 Skill `release`: help articles (button colours, icons in screenshots/text), E2E spec `version-0-17-0`
  (primary main actions, red only on danger confirmations, hero button 56 px, filled active nav icon, no
  primeicons), CHANGELOG, version, plan archiving.

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
