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

## v0.53.0

Goals: the portal moves the way M3 transition patterns say. Fades are clean (out, then in),
common transitions don't bounce, the tab indicator slides, a docked pane makes room for itself,
list rows come and go with motion, loading keeps the layout stable. Decided on 2026-11-16:
top-level destinations on a phone stay fade through (M3: no lateral motion between them); the
slide is for going deeper (list → detail). Decided on 2026-11-16 too: transitions run on M3's
legacy easing and duration (standard set), not on springs, as the M3 transitions pages say; top
level is fades only, without the 0.92 scale.

ADRs: new ADR-0066 — transition choreography per M3 transition patterns (412.1): M3 easing
and duration, sequential fades, coplanar panes, list rows; updates design-system «Motion».

### 412. Page transitions

- [x] 412.1 **F** *complex* — top level and forward and backward per M3 (`styles/_motion.scss`
  «Pages», `core/routing/page-transitions.ts`): the new page waits until the old one has faded
  out instead of cross-fading; top level is fades only (no 0.92 scale); the 30 dp slide and the
  fades on M3 easing and duration tokens (standard set), not springs; under reduced motion a
  short fade instead of skipping. ADR-0066, design-system «Motion».
- [x] 412.2 **F** *simple* — the navigation keeps one indicator during a page transition: the
  snapshot of `tb-side-nav` has no background, so the old indicator shows under the new one and
  vanishes at the end (`core/layout/side-nav.scss`, `view-transition-name` in `_motion.scss`).
  Check the rail and the bottom bar in the browser before and after.
- [x] 412.3 **F** *complex* — forward/back on a phone: when only the route parameters change and
  the single pane switches list ↔ detail (`shared/ui/panes.ts`, `pageMotion` returns `null`
  today), the detail slides in with shared axis X forward and back out on «←». The bottom bar
  between sections stays fade through. Done together with the wide case: beside the list only
  the detail pane fades (ADR-0066).

### 413. Tabs

- [x] 413.1 **F** *complex* — one active indicator that slides from tab to tab and takes the width
  of the new label, on a spatial spring (`styles/_sheets.scss` `.tb-tabs`, today a per-label
  `::after` that grows from the middle; PrimeNG's `.p-tablist-active-bar` is hidden because it
  spans the tab). Every tab bar (student and group cards, schedule side pane, the bell's sheet).
  Gallery sample.

### 414. Panes and the rail

- [x] 414.1 **F** *complex* — the docked notifications pane is a coplanar sheet: it opens by
  growing its width from 0, so the page beside it narrows smoothly, and closes by shrinking
  (`animate.leave`, missing today) — `core/notifications/notifications-sheet.ts`. The same for a
  `tb-pane` that appears or leaves beside others (`shared/ui/panes.ts`): the neighbours resize
  instead of jumping. Width on default spatial, content opacity on effects. Match the video
  `GM3-Transitions-TransitionPatterns-7-5`
  (https://firebasestorage.googleapis.com/v0/b/design-spec/o/projects%2Fgoogle-material-3%2Fimages%2Flygxnh2p-GM3-Transitions-TransitionPatterns-7-5-v01.mp4?alt=media);
  view it frame by frame (built-in browser, the `<video>` drawn into a canvas contact sheet).
- [x] 414.2 **F** *simple* — expanding and collapsing the rail (`core/layout/rail-state.ts`,
  `side-nav.scss`): check in the browser; if the width and labels jump, animate the width on
  default spatial and the labels on effects.
- [x] 414.3 **F** *complex* — list-detail in one pane (Settings:
  `features/settings/settings-page.ts`, one route for `/teacher/settings` and
  `/teacher/settings/:category` in `settings.routes.ts`): the first choice of a section moves
  differently from the next ones, and its motion takes the list of sections with it. Likely cause:
  `pageMotion` (`core/routing/page-transitions.ts`, 412.3) reads 2 → 3 segments as forward and
  slides the whole content, 3 → 3 gives no motion. Fix: with the list on screen (not compact) the
  list stands still and only the detail column changes, with the same motion every time (M3: the
  detail of a list-detail layout, not a page); on compact the list ↔ detail forward/back of 412.3
  stays. Check the other list-detail pages (students, groups, schedule side pane) for the same
  split. Browser check of the first and a later choice.

### 415. List rows

- [x] 415.1 **F** *complex* — shared enter/leave motion for list rows in `shared/ui/` (on
  `animate.enter` / `animate.leave`): a leaving row fades out on fast effects and then closes its
  height on the standard fast spring; a new row opens its height and fades in. Gallery sample,
  design-system «Motion».
- [x] 415.2 **F** *simple* — apply 415.1 where rows are removed or added: notifications
  (`features/notifications/inbox/notification-list.ts`), then the other lists that delete,
  archive or filter rows (homework, materials, students, payments, lessons). Rows changed by a
  filter or a route parameter on wide screens enter the same way.

### 416. Overlays

- [x] 416.1 **F** *complex* — menus and the snackbar enter and exit along an axis instead of
  scale (M3: scale implies an elevation change) in `styles/_motion.scss`. Menus, dropdowns and
  the date picker match the video `GM3-Transitions-TransitionPatterns-7-2`
  (https://firebasestorage.googleapis.com/v0/b/design-spec/o/projects%2Fgoogle-material-3%2Fimages%2Flyfs4dk9-GM3-Transitions-TransitionPatterns-7-2-v01.mp4?alt=media):
  the container opens away from its anchor along Y (down under the button, up above it), the
  items appear top to bottom as it opens, it closes with a short fade. The snackbar opens upwards
  from the bottom and matches the video `GM3-Transitions-TransitionPatterns-7-3`
  (https://firebasestorage.googleapis.com/v0/b/design-spec/o/projects%2Fgoogle-material-3%2Fimages%2Flyfs56ki-GM3-Transitions-TransitionPatterns-7-3-v01.mp4?alt=media).
  View the videos frame by frame (built-in browser, the `<video>` drawn into a canvas contact
  sheet). design-system «Motion», `/gallery/motion`.
- [x] 416.2 **F** *complex* — the global search opens with a container transform (M3 transition
  patterns, the search video `GM3-Transitions-TransitionPatterns-3-4`,
  https://firebasestorage.googleapis.com/v0/b/design-spec/o/projects%2Fgoogle-material-3%2Fimages%2Flyfrdrxa-GM3-Transitions-TransitionPatterns-3-4-v01.mp4?alt=media):
  the docked search bar's pill grows down and a little to the sides into the search view under it, its corners go from
  full to the view's corner, the field row stays in place, the results fade in once it has
  opened; closing runs the same way back. The full-screen view on compact grows from the search
  icon of the top app bar. `core/search/global-search-view.ts` (no motion today); a spatial
  spring for the container, effects for the content; a fade alone under reduced motion. ADR-0066
  (container transform), design-system «Motion».
- [x] 416.3 **F** *complex* — dialogs match the video `GM3-Transitions-TransitionPatterns-7-1`
  (https://firebasestorage.googleapis.com/v0/b/design-spec/o/projects%2Fgoogle-material-3%2Fimages%2Flyfs2znj-GM3-Transitions-TransitionPatterns-7-1-v01.mp4?alt=media):
  the scrim fades in first, then the dialog's container opens downwards from its top edge (its
  height grows, no scale) and the content fades in just after; closing is a quick fade with the
  container collapsing, then the scrim fades out. Today `.p-dialog` grows from scale 0.93
  (`styles/_motion.scss`). Every `p-dialog`, the confirmations included; side and bottom sheets
  stay as they are. design-system «Motion», `/gallery/motion`.

### 417. Skeleton loaders

- [x] 417.1 **F** *complex* — skeletons in `tb-load-state` (`shared/ui/load-state-view.ts`) for
  list sections: the shape of the rows while they load, a pulse from top left to bottom right,
  the content fades in over it; the loading indicator stays for the rest. Static under reduced
  motion. Gallery sample, design-system.

### 418. Release 0.53.0

- [ ] 418.1 *simple* — skill `release`.

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Decided against on 2026-11-15 (don't propose again without a new reason): `no-store` of homework
attachments stays (a shared computer must not keep files); one language of the dictionaries per
load; Caddy alone instead of Caddy in front of nginx; colours on the board list; times in the
portal time zone; search in the remaining long lists and list-detail for the review queue.

- [x] *simple* F — buttons render at 16px: the `.p-button { font-size: 0.875rem }` rule never
  applied and was removed in 400.1 (ADR-0065); decided on 2026-11-16: M3 Label Large 14px, done
  in the button `css` of `teacher-box-preset.ts` (`sm` / `lg` keep their own size).
