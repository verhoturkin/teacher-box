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

## v0.62.0

Goals: the lesson-plan editor gets the homework editor's pane layout; the phone home-screen icon
matches the web one; the student card header is consistent; the student's Профиль is grouped into
cards laid out in two columns on wide screens, like Settings. No new ADRs.

### 467. Polish after 0.61.0 (F)

- [x] 467.1 *complex* — the lesson-plan editor uses the panes layout of the assignment editor:
  `textbooks/teacher/lesson-plan-editor-page.ts` moves from `tb-page-header` + form to `tb-panes`
  / `tb-pane` with `tb-editor-header` and the AI panel as a fixed resizable side pane, like
  `homework/teacher/assignment-editor-page.ts` (`@shared/ui/panes`); spec, `docs/screens.md`.
- [x] 467.2 *simple* — the phone icon: `public/apple-touch-icon.png` and `public/icons/*.png`
  (manifest icons) are re-rendered as the web client's default logo (`tb-i-school`, the Material
  Symbols outlined cap, primary `#4648d4` on the tonal `#bdbefe` rounded square; maskable — full
  bleed, glyph inside the safe zone), not the filled cap of `favicon.svg`; the manifest and
  `index.html` already point at them.
- [ ] 467.3 *simple* — student card header: the «Итоги» button
  (`students/student-card.ts`, `.tb-student-card__summary`) gets a visible label like «Написать»,
  «Оплата», «Занятие» (icon-only stays only where the others collapse too); the course chip icon
  in `students/card-head.ts` is sized like the other chips' icons.
- [ ] 467.4 *complex* — student Профиль grouped into cards: `students/student-profile-tab.ts`
  splits «Данные» into themed cards and lays all cards out in two columns on wide screens with the
  grid of `settings/settings-page.ts` (`.tb-settings-grid`), one column on narrow; spec,
  `docs/screens.md`, wiki.
- [ ] 467.5 *simple* — browser check of 467.1–467.4 in the built-in browser (wide and 375 px):
  fix small defects, list the rest.
- [ ] 467.6 *simple* — release 0.62.0 (skill `release`).

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
