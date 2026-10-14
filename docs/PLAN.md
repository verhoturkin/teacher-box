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

## Releases 0.17.0–0.17.2 — M3 Expressive buttons and icons

Goals (the teacher's decisions of 2026-10-14): one accent — every main action is filled **primary** (the portal
colour), green and amber only for statuses; red only where an action destroys something; one large button, the
hero «Начать урок»; Material Symbols Rounded instead of primeicons, with a filled icon for the active section.
**Each stage is its own release** (the teacher's decision of 2026-10-14): 204 → 0.17.0, 205 → 0.17.1,
206 → 0.17.2; each ends with skill `release` (help, E2E spec of its version, CHANGELOG, version, archiving of its
stage). The former stage 207 «Release 0.17.0» is split into the last substep of each stage.

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
- [ ] 204.6 Release 0.17.0 (skill `release`): help articles (button colours), E2E spec `version-0-17-0` (primary
  main actions, red only on danger confirmations), CHANGELOG, version, archiving of stage 204.

### 205. One large button (F, ADR-0045)

- [ ] 205.1 **F** Button M (M3E `ButtonMedium`: 56 dp, full corners, pressed CornerMedium 12 dp, icon 24 dp,
  padding 24 dp, label — our decision: Title Medium) as a class `tb-button-m` in `styles.scss`, also for the split
  button (`tb-split--m`: trailing part 56 dp, inner corners per M3E `SplitButtonMedium` from the skill).
- [ ] 205.2 **F** Use it only in the hero: `schedule/home/next-lesson-widget.ts`, `upcoming-lesson-widget.ts`,
  `join-lesson-button.ts` («Начать урок» / «Войти в урок», `tb-join-wide` on a narrow card). §5 «Nearest lesson
  hero», §7 «Size is one» → «one exception». E2E 40 px checks (`version-0-6-12`, `version-0-6-13`) skip it; a new
  check that the hero button is 56 px.
- [ ] 205.3 Release 0.17.1 (skill `release`): help (the large «Начать урок»), E2E spec `version-0-17-1` (hero
  button 56 px, the rest 40 px), CHANGELOG, version, archiving of stage 205.

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
  `core/theme/icons.scss` (the only place names live). Dark theme `'GRAD' -25` for icons only (201.6 left the text font at grade 0).
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
- [ ] 206.8 Release 0.17.2 (skill `release`): help articles (icons in text), E2E spec `version-0-17-2` (filled
  active nav icon, no primeicons), CHANGELOG, version, archiving of stage 206.

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
