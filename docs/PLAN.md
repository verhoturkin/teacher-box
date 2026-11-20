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

Goals: the type of the portal follows the M3 Expressive scale exactly (tracking per role, no
stray weights or caps); the lesson heroes show the running lesson like the M3E progress indicator.

### 457. M3E typography and the lesson heroes

- [x] 457.1 **F** *simple* — the heroes. `shared/ui/wavy-progress.ts`: the wave is a dash of an SVG
  path, so both ends are round caps riding the wave (as the M3 progress-indicator video); on a hero
  it takes on-primary-container (primary was 1.3:1 on the container). `schedule/home/
  next-lesson-widget.ts`: the student's hero gets the bar too. `home/today-lessons.ts`: the hero's
  empty board line no longer leaves a 32 px band; `home/teacher-home.ts`: an empty lead column no
  longer leaves the left half empty under the hero; the hero is an M3 card (variant C of the
  mockups): content, the bar, then an action row — board and presence at the start, «Позвать»
  and the join button at the end (`meetings/ui/call-summon.ts` hero order). The wave is a cubic sine fit (quadratic halves read as a row of
  arcs). `--tb-type-title-s-emphasized` (read by the call window) declared. Buttons M / XS round
  to half their height (`--tb-shape-button-m`, `-xs`): from 999 px the pressed morph was unseen.
- [ ] 457.2 **F** *complex* — tracking per role. `body` sets body-l tracking (0.5 px) and every
  role inherits it: display and headline get 0.5 px instead of 0, labels 0.5 instead of 0.1. Add
  the missing `--tb-tracking-*` (title-s 0.1, body-m 0.2, label-m/s 0.5; title-m is 0.2 in M3,
  0.15 only emphasized), a `type(<role>)` mixin that sets `font` and `letter-spacing`, a codemod of
  the ~400 `font: var(--tb-type-…)` and a `scripts/` check like `spacing.mjs`.
- [ ] 457.3 **F** *simple* — strays: bare `font-weight: 600/700` (`question-section.ts` ×3,
  `_panes.scss` input number, `schedule-agenda.ts`, `schedule-calendar.scss`) → role tokens;
  odd sizes `0.85rem`/`0.8rem` (admin journal, events) → body-s / label-m.
- [ ] 457.4 **F** *simple* — no caps overlines (M3 has no overline role): ~20 uppercase labels with
  0.04–0.08 em tracking («Поступило», «Оплачено», homework labels) → label-m / label-l,
  on-surface-variant, sentence case. Tabular figures on money and figures (`.tb-amount`,
  `.tb-figure__value`).
- [ ] 457.5 **F** *simple* — one hierarchy for both heroes: the student's lesson title in Headline
  Small/Medium emphasized like the teacher's name (now a body `strong`); docs: the emphasized
  tokens the design system lists but `_tokens.scss` lacks (headline-l, label-s).
- [x] 457.6 **F** *simple* — dark-theme text grade −25 (ADR-0070, changes 0044 item 6):
  `styles/_icons.scss` loads `google-sans/grad.css` (+18 KB), `:root.tb-dark` in
  `styles/_panes.scss` sets `GRAD -25`. Google Sans Flex has no Cyrillic; opsz is 17–18 only.

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Left from 0.57.0 (449.1): the student card actions (3 buttons, 371 px) overflow a 375 px phone;
the schedule toolbar → calendar gap and the `.tb-ops` section margins are child margins, not the
parent's gap; lesson rows, student-side cards with data and the teacher homework / Materials lists
were measured only empty; «Позвать» and the tab ripple on touch were not checked live.

Decided against on 2026-11-15 (don't propose again without a new reason): `no-store` of homework
attachments stays (a shared computer must not keep files); one language of the dictionaries per
load; Caddy alone instead of Caddy in front of nginx; colours on the board list; times in the
portal time zone; search in the remaining long lists and list-detail for the review queue.
