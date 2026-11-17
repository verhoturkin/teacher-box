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

## v0.55.0

Goals: the panes of a page can be resized with an M3 drag handle, and the width is remembered for
the user; date and time fields move to M3 pickers — a docked date picker (full-screen on a phone)
and a modal time picker with a dial and an input view, typed entry in every field. KISS: one field
component per value kind, PrimeNG stays where it already fits.

New ADR: 0067 — date and time pickers (own time picker, own field around the PrimeNG calendar,
date and time as two fields). Changed specs: `docs/design-system.md` §7 and §9.

Source: the `m3-expressive` skill references (`layout.md` «Drag handles & pane resizing»,
`components/feedback.md` «Date pickers», «Time pickers», `component-tokens.md` `DragHandle`,
`DatePickerModal`, `TimePicker`, `TimeInput`). M3 publishes no measurements for the docked date
picker and no type roles for pickers: those values are ours and marked so in the spec.

### 423. Fixes after 0.54.0

- [x] 423.1 *simple* F — buttons render at 16px: the `.p-button { font-size: 0.875rem }` rule never
  applied and was removed in 400.1 (ADR-0065); decided on 2026-11-16: M3 Label Large 14px, done
  in the button `css` of `teacher-box-preset.ts` (`sm` / `lg` keep their own size).
- [x] 423.2 *simple* F — student tags: the free-text tag field is a textarea that grows with the
  text and takes two thirds of the row (`students/student-tags-tab.ts`); a long tag no longer
  widens the AI panel or the review sheet (`ai/student-context.ts`, `contain: inline-size` on the
  chips).

### 424. Resizable panes

M3: the drag handle sits in the spacer and resizes panes; in a fixed-and-flexible layout it
adjusts the fixed pane; it toggles layout sizes when selected; persistent resizing remembers the
width across restarts and breakpoints; its touch target slightly overlaps the panes. Tokens:
4×48 dp, full corners; pressed and dragged 12×52 dp, corner medium (12 dp); container 24 dp wide —
the width of our spacer.

- [x] 424.1 *complex* F — drag handle of the panes (`shared/ui/panes.ts`, a new
  `shared/ui/pane-handle.ts` if `Pane` gets too big). A `tb-pane kind="fixed"` with
  `resizeKey="<page>"` gets a handle in the spacer on its flexible side, only while the panes
  stand side by side (from expanded; none in `single`, none for `sheet` — M3 resizes supporting
  panes only temporarily, YAGNI).
  - Limits (ours): the fixed pane from 360 dp (one column, ADR-0021) up to the width that leaves
    the flexible pane 360 dp, and never more than 50 % of the panes; clamped again on window
    resize, the stored width is kept.
  - Smooth (the main requirement): pointer events with `setPointerCapture`; each move only
    stores the pointer x, one `requestAnimationFrame` writes the width to a CSS custom property
    on the pane (`flex-basis: var(--tb-pane-width)`), no signal or change detection per move;
    during the drag the panes drop their transitions and enter/leave animations, the page gets
    `user-select: none` and `cursor: col-resize`; no layout read inside the frame except the one
    `getBoundingClientRect` at drag start. On release the width snaps (ours: within 24 dp) to an
    M3 snap width — 360 dp, 412 dp or the centred split — on `--tb-spring-default-spatial`;
    without a snap it stays where it was dropped.
  - Look (M3 tokens above; colour ours — M3 names none): `outline-variant` at rest, `outline` on
    hover, `on-surface` pressed and dragged; the 12×52 shape morphs on
    `--tb-spring-fast-spatial`; the hit zone is the 24 dp spacer plus 8 dp over each pane (ours).
  - Selecting it (M3 «toggle between layout sizes»): a double click or Enter switches between the
    default width and the last custom one.
  - Accessibility: `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow/min/max` in
    px, `aria-controls` the pane, a label «Изменить ширину панели» / «Resize pane» with a
    tooltip; keyboard ←/→ by 16 dp (ours), Home/End to the limits; RTL mirrors the arrows.
  - Persistence (M3 persistent resizing): `localStorage` under
    `tb.pane-width.<userId>.<resizeKey>` (per user on this device, like the call corner; the
    width in px), read before the first render so the page never jumps; a broken value is
    ignored. *Not done:* sync across devices (no per-user UI-preferences store on the server;
    add one only if the teacher asks).
  - Turn it on for every fixed pane: Ученики, Задания (student), Справка, Оплаты by students,
    Расписание (teacher, student), Интеграции, the AI pane of the assignment editor.
  - Tests: limits and clamping, snap, keyboard, double click, storage per user and key, no
    handle on compact and medium; gallery sample `features/gallery/frame/panes.ts`;
    `docs/design-system.md` §7; wiki page of the interface and the help article in both
    languages (one line: drag the edge between panes, a double click returns the width).
- [x] 424.2 *simple* F — browser check of 424.1: drag on Ученики and Расписание at 1280 and
  1920 px, a Performance trace of a drag without long tasks or forced layouts, reload keeps the
  width, another user's width is separate, keyboard and screen reader names, light and dark.
  *Fixed: `aria-valuenow` stayed stale after the default toggle. Not checked: a second (student)
  login — the key holds the user id; forced layouts (no long tasks, one write per frame).*

### 425. M3 date and time pickers

Today every date and time is a PrimeNG `p-datepicker`: date only (payment, lesson series end,
off-time days, monthly report with `view="month"`), time only with spinners (`timeOnly`:
off-time, lesson rules, admin settings) and date with time in one panel (`showTime`: lesson,
homework due, change request, request answer, off-time). M3 has no combined picker and no
spinner time picker.

What we take from M3:

- Typed entry everywhere: the field accepts several formats (dots, slashes, dashes, spaces, a
  leading 0 or none), formats the value only on Enter or leaving the field, no input masks; the
  icon is the only way into the picker, each a separate tab stop.
- Date: the docked date picker below the field from medium; on compact the full-screen modal date
  picker (headline, «×», «Сохранить»). Days 40 dp round (`DateContainer*`), today a 1 dp primary
  outline, selected primary / on-primary, the year view replaces the calendar; a header with
  month and year menu buttons and previous/next icon buttons; keyboard Page Up/Down,
  Shift+Page Up/Down, Home/End; screen readers hear the full date. Container
  `surface-container-high`; ours: the docked one keeps the dropdown shadow (on a dialog it would
  merge into the same colour).
- Time: the modal time picker, 24-hour (no AM/PM). Dial view — hour and minute selectors 96×80 dp
  (114 dp wide for 24 h), dial 256 dp `surface-container-highest`, handle 48 dp, centre 8 dp,
  track 2 dp primary, hours 0–11 on the outer ring and 12–23 on the inner; input view — fields
  96×72 dp with labels below; the keyboard / clock icon button lower left switches the views;
  «Отмена» / «ОК»; the selected selector `primary-container`. Horizontal layout when the window is
  short, the input view alone when even that does not fit (M3 fallback).
- Ours: the minute step of a field (5 or 15) — the dial snaps to it, typed minutes are kept as
  typed; the dial is the default view (the field already takes typing), the last view chosen is
  remembered for the session.

- [x] 425.1 *complex* F — ADR-0067 and the spec: `docs/design-system.md` §9 «Date», «Time»,
  «Date and time» with the values above, each marked **M3** or *ours*; a row in
  `docs/adr/README.md`. Decide there whether the docked calendar stays PrimeNG
  `p-datepicker [inline]` inside our overlay (preferred: less code) or needs its own grid — only
  if the M3 header cannot be built with PrimeNG templates. Decided: the PrimeNG grid stays, its
  header is hidden, our M3 header and month / year lists sit around it (ADR-0067).
- [x] 425.2 *complex* F — `tb-date-field` (`shared/ui/date-field.ts`, `ControlValueAccessor`,
  value `Date`): the filled field (ADR-0050) with the trailing `calendar_month` icon button; a
  parser for typed dates (`shared/dates`) with tests for every accepted format and the rejects;
  the docked picker in an overlay under the field from medium, the full-screen dialog on compact;
  `minDate` / `maxDate`; a month mode for the monthly report (no grid: the year header and the
  month list). The grid is `p-datepicker [inline]` with its header hidden; ours: the M3 header
  (shows a month through `defaultDate`, follows `onMonthChange`), the month and year lists,
  Shift+Page Up/Down and Shift+M / Shift+Y, the full date as each day's label (PrimeNG puts only
  the number in the cell's `aria-label`; check with a screen reader whether `#date` content or
  `pt` is enough). Replace the date-only
  `p-datepicker`s (`billing/teacher/payment-dialog.ts`, `monthly-report-page.ts`,
  `schedule/teacher/lesson-dialog.ts` series end, `off-time-dialog.ts` days); a gallery sample in
  `features/gallery/fields/`.
- [ ] 425.3 *complex* F — `tb-time-field` and the `tb-time-picker` dialog
  (`shared/ui/time-field.ts`, `time-picker.ts`, value `HH:mm`, input `step`): typed times
  «14:30», «1430», «14.30», «14 30», «9» → 09:00; the dial with pointer drag and keyboard (arrows
  move by the step, Enter confirms), the input view, both layouts. Replace the `timeOnly` pickers
  (`off-time-dialog.ts`, `settings/fields/lesson-rule-fields.ts`,
  `admin/settings/settings-page.ts`); a gallery sample.
- [ ] 425.4 *complex* F — a date with a time as two fields in one row (date, then time; one value
  in the instance time zone, `shared.time` rules): `homework/ui/due-chips.ts`,
  `schedule/student/change-request-dialog.ts`, `schedule/teacher/lesson-dialog.ts`,
  `request-answer-dialog.ts`, `off-time-dialog.ts`; keep `minDate` (no past time today). Update
  their specs and the E2E steps that type into these fields (`e2e/tests/**`, grep the labels).
- [ ] 425.5 *simple* F — clean-up and docs: drop the `datepicker` overrides of
  `teacher-box-preset.ts` that nothing uses any more (and its `aura-base.ts` entry if
  `p-datepicker` is gone — `aura-base.spec.ts` tells); `docs/screens.md` where it names the
  pickers; wiki and help (typing a date or time, the clock) in both languages.
- [ ] 425.6 *simple* F — browser check of 425.2–425.5: every replaced field at 400, 1024 and
  1920 px, typed entry, keyboard only, the dial with the mouse and touch emulation, light and
  dark; fix small defects, list the rest.

### 426. Release 0.55.0

- [ ] 426.1 *simple* — skill `release`: help, E2E, CHANGELOG, version, archive this section.

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Decided against on 2026-11-15 (don't propose again without a new reason): `no-store` of homework
attachments stays (a shared computer must not keep files); one language of the dictionaries per
load; Caddy alone instead of Caddy in front of nginx; colours on the board list; times in the
portal time zone; search in the remaining long lists and list-detail for the review queue.
