# Design system

The **current** UI rules: Material 3 Expressive (M3E) on PrimeNG 21. This page brings together ADR-0015,
ADR-0017–0027, the call window of ADR-0030, the M3E alignment of ADR-0044, the button accent of ADR-0045 and the icons of ADR-0046, which are the history (*why*); if they disagree with this page, this page is right. A change to
a rule updates this page in the same commit, and a new decision also gets an ADR. UI wording follows
[`glossary.md`](glossary.md) (Russian and English); texts live in dictionaries (§14).

Where it lives: preset `core/theme/teacher-box-preset.ts`, colour scheme `core/theme/color-scheme.ts`,
tokens and shared classes `src/styles.scss`, components `shared/ui/*`, breakpoints `core/layout/mobile.ts`.
No other UI kits (Angular Material, Material Web). Icons — Material Symbols Rounded, a subset font built from the
classes in use (§1 «Icons», ADR-0046); no primeicons.

## 1. Tokens

- **Spacing** — 4 px grid, `--tb-space-N` = N × 4 px. Component styles take spacing only from tokens.
- **Shape** (radius):

  | Token | px | Use |
  |---|---|---|
  | `--tb-shape-xs` | 4 | tooltips, inputs, inner corners of split button and list tiles |
  | `--tb-shape-sm` | 8 | pressed button (M3E CornerSmall), chips, tags, inner corners of connected button groups |
  | `--tb-shape-md` | 12 | selected toggle, menu items |
  | `--tb-shape-lg` | 16 | FAB, menus and dropdowns, outer corners of a list right on the page |
  | `--tb-shape-lg-plus` | 20 | cards |
  | `--tb-shape-xl` | 28 | dialogs, top of the bottom sheet |
  | `--tb-shape-xl-plus` | 32 | login and invite card |
  | `--tb-shape-2xl` | 48 | loading indicator |
  | `--tb-shape-full` | — | buttons, search fields, navigation indicator |

  Radii come only from this scale. `--tb-shape-button` (20 px) is half a 40 px button.
  **Nested corners** (M3 optical roundness, ADR-0044): a child inside a padded container takes `inner = outer −
  padding`, never below `--tb-shape-xs`. Lists, tile tables and key figures set it through `--tb-list-outer`: right
  on the page 16 px (M3 list CornerLarge); in a card on a computer 20 − 20 → 4 px; in a dialog 28 − 24 = 4 px; in a
  phone card 20 − 12 = 8 px. The rule is written as `max(xs, calc(outer − padding))` beside the container's padding.
- **Elevation** — surfaces differ by tone, not shadow. Shadows `--tb-elevation-1..3` only on floating
  elements: FAB, menus, dropdowns, date picker (level 2), dialogs (3), bottom sheet (1).
- **State layers** — content colour over the element: hover `--tb-state-hover` 8 %, focus and pressed 10 %;
  disabled — container 12 %, content 38 % (`--tb-state-disabled*`). Hover only on things that act: rows that
  open as a whole (`tb-list__item--link`), not on static rows. Ripple is on.
- **Motion** — M3E springs, precomputed as `linear()` with a duration: `transition: border-radius
  var(--tb-spring-fast-spatial)`. Spatial (overshoot; position, size, shape): `--tb-spring-{fast,default,slow}-spatial`;
  effects (no overshoot; colour, opacity): `--tb-spring-{fast,default,slow}-effects`; the standard-scheme
  `--tb-spring-standard-fast-spatial` (0.9 / 1400, barely overshoots) only for turns that must not bounce (split
  button chevron). Curves are computed (sample the spring until within 0.001 of 1), never the cubic-bezier fallback.
  Used for button shape (colours and outline on `--tb-spring-fast-effects`), call toggles, nav indicator, section folding,
  FAB appearance. **Overlays** (0.16.3, `styles.scss` «Overlays on M3E springs») replace PrimeNG's cubic-bezier:
  they enter with scale or position on a spatial spring and opacity on the effects spring of the same speed —
  dialogs default (scale from 0.93), menus, dropdowns and the date picker fast (0.93), the snackbar fast (0.8), the
  side sheet slides in on default spatial; they leave without a bounce on the standard fast spring and fast effects
  (the snackbar fades and closes its line). Our decision (M3 publishes no choreography): the bottom sheet sits on
  the bottom edge and would lift off it on an overshoot, so it enters on the standard fast spring too; the scrim
  fades on default effects (in) and fast effects (out).
  `prefers-reduced-motion: reduce` disables transitions and animations (the loading indicator stays a circle).
- **Layout** — content up to `--tb-content-max` (1440 px); short pages (not found) in `--tb-content-narrow` (56 rem), form fields `tb-form--narrow` (26 rem); top bar
  64 px, bottom bar 64 px (M3E flexible navigation bar), rail 96 / 280 px — chrome sizes in **px** so a large font grows text, not frames.
- Preset tokens reference `--tb-*`; no literal values in component styles.

### Icons (ADR-0046)

Material Symbols Rounded, weight 400, outlined (`'FILL' 0`); filled (`tb-i--filled`) only for the active
navigation section (§4) and checked states. Markup: `<i class="tb-i tb-i-<name>" aria-hidden="true"></i>`,
`icon="tb-i tb-i-<name>"` on `p-button`, `icon="tb-i-<name>"` on `tb-empty-state`; the class names the
symbol (`tb-i-calendar_month`) and is always written whole — `npm run icons` finds the classes in `src/` and
builds the subset font `core/theme/symbols.woff2` with the map `core/theme/icons.scss`; the design-rules test
fails while they disagree. Sizes: `--tb-icon-size` 24 px (lists, navigation, icon buttons — M3), 20 px in
buttons with a label (M3E small), 18 px in chips; `--tb-icon-opsz` follows the size. Dark theme: grade −25 for
icons only. A glyph is a private code point with an empty alternative text: nothing shows before the font
loads and screen readers skip it; the meaning is in the label or the tooltip. In generated content —
`@include icon-font; @include glyph('tb-i-<name>')` (`styles.scss`).

**PrimeNG's own icons** are SVG components (`<svg data-p-icon="…">`), not primeicons: `npm run icons` also
writes the outlines of our symbols as masks (`core/theme/prime-icons.scss`, map `PRIME` in the script) and
`styles.scss` hides the paths and masks the box — one place for every component, no per-use templates: select
and multiselect `arrow_drop_down` / `arrow_drop_up`, «×» of dialogs, drawers, toasts and chips `close`, the date
picker `calendar_month`, `chevron_left` / `chevron_right` (its time `keyboard_arrow_up` / `_down`), number
steps `keyboard_arrow_up` / `_down`, checkbox `check` / `remove`, paginator `first_page` / `chevron_*` /
`last_page`, table sorting `unfold_more` / `arrow_upward` / `arrow_downward`, toast and message `info` /
`warning` / `error` / `check`, busy `progress_activity`, filters `search`. 24 px; 20 in number steps, 18 in the
checkbox and the sort mark. Other PrimeNG icons stay PrimeNG's own SVG: the app shows none of them (a new
component that shows one adds it to `PRIME`).

**One meaning — one symbol.** The set (from primeicons in 0.17.2):

| Meaning | Symbol | Was |
|---|---|---|
| Home | `home` | `pi-home` |
| Schedule, lesson date | `calendar_month` | `pi-calendar` |
| New lesson | `calendar_add_on` | `pi-calendar-plus` |
| Lesson request waiting | `event_upcoming` | `pi-calendar-clock` |
| Time, deadline soon | `schedule` | `pi-clock` |
| Series of lessons, retry, return for rework, re-invite | `replay` | `pi-replay` |
| Off time | `dark_mode` | `pi-moon` (schedule) |
| Homework, assignment | `assignment` | `pi-pen-to-square` |
| Review | `rate_review` | `pi-check-square` |
| Textbook | `menu_book` | `pi-book` |
| Workbook | `stylus_note` | `pi-pencil` (textbooks) |
| Board | `co_present` | `pi-tb-board` (Tabler mask) |
| External board, external link | `open_in_new` | `pi-external-link` |
| Open (go to the page) | `arrow_outward` | `pi-arrow-up-right` |
| Students | `group` | `pi-users` |
| Me (the user button without a photo, 32 px like the photo) | `account_circle` | `pi-user` |
| Add a student | `person_add` | `pi-user-plus` |
| Remove from the lesson | `person_remove` | `pi-user-minus` |
| Account | `badge` | `pi-id-card` |
| Calls, join the lesson, camera | `videocam` / off `videocam_off` | `pi-video` (+ a CSS slash) |
| Microphone | `mic` / off `mic_off` | `pi-microphone` (+ a CSS slash) |
| End the call | `call_end` | `pi-phone` |
| Share the screen | `present_to_all` | `pi-desktop` (call) |
| Full window / back to the window | `open_in_full` | `pi-window-maximize`, `pi-arrows-alt` |
| Minimise the call | `close_fullscreen` | `pi-window-minimize` |
| Weak connection | `network_wifi_1_bar` | `pi-wifi` |
| Call statistics, reports | `bar_chart` | `pi-chart-bar` |
| Billing | `account_balance_wallet` | `pi-wallet` |
| Receipt | `receipt_long` | `pi-receipt` |
| Notifications | `notifications` | `pi-bell` |
| Inbox, nothing new | `inbox` | `pi-inbox` |
| Send, broadcast, Telegram | `send` | `pi-send`, `pi-telegram` |
| VK, messengers, answers | `forum` | `pi-comments` |
| MAX | `chat` | `pi-comment` |
| AI assistant | `auto_awesome` | `pi-sparkles` |
| AI homework draft | `edit_document` | `pi-file-edit` |
| Prompt library | `bookmark` | `pi-bookmark` |
| Settings | `settings` | `pi-cog` |
| Help | `help` | `pi-question-circle` |
| Language | `translate` | `pi-language` |
| Theme: light / dark / system | `light_mode` / `dark_mode` / `brightness_auto` | `pi-sun` / `pi-moon` / `pi-desktop` |
| Palette (portal colour) | `palette` | `pi-palette` |
| Photo | `photo_camera` | `pi-camera` |
| Picture | `image` | `pi-image` |
| PDF | `picture_as_pdf` | `pi-file-pdf` |
| Other file | `draft` | `pi-file` |
| Attach | `attach_file` | `pi-paperclip` |
| Upload | `upload` | `pi-upload` |
| Download | `download` | `pi-download` |
| Copy | `content_copy` | `pi-copy` |
| Link | `link` | `pi-link` |
| Backups, database | `database` | `pi-database` |
| Google Drive | `cloud` | `pi-cloud` |
| Upload to Drive | `cloud_upload` | `pi-cloud-upload` |
| Connect Google | `link` | `pi-google` |
| Restore, history of versions | `history` | `pi-history` |
| Admin: status | `dns` | `pi-server` |
| Admin: log | `list_alt` | `pi-list` |
| Admin: events | `sync` | `pi-sync` |
| Set in Docker | `deployed_code` | `pi-box` (setting) |
| Set in .env, locked | `lock` | `pi-lock` |
| Archive | `inventory_2` | `pi-box` (groups) |
| Block | `block` | `pi-ban` |
| Not found | `explore` | `pi-compass` |
| Add | `add` | `pi-plus` |
| Edit | `edit` | `pi-pencil` |
| Delete | `delete` | `pi-trash` |
| Close, remove, unbind | `close` | `pi-times` |
| Cancel a lesson | `cancel` | `pi-times-circle` |
| End a series | `stop_circle` | `pi-stop-circle` |
| Undo, withdraw | `undo` | `pi-undo` |
| Save | `save` | `pi-save` |
| Done, chosen | `check` | `pi-check` |
| Accepted, completed | `check_circle` | `pi-check-circle` |
| Not done yet (checklist) | `radio_button_unchecked` | `pi-circle` |
| Error | `error` | `pi-exclamation-circle` |
| Warning | `warning` | `pi-exclamation-triangle` |
| Search | `search` | `pi-search` |
| Filter | `filter_list` | `pi-filter` |
| Refresh | `refresh` | `pi-refresh` |
| Sign in / out | `login` / `logout` | `pi-sign-in` / `pi-sign-out` |
| Show / hide the password | `visibility` / `visibility_off` | `pi-eye` / `pi-eye-slash` |
| Preview (as the student) | `visibility` | `pi-eye` |
| More (menu) | `more_vert` | `pi-ellipsis-v` |
| More (navigation) | `more_horiz` | `pi-ellipsis-h` |
| Back / forward | `arrow_back` / `arrow_forward` | `pi-arrow-left` / `pi-arrow-right` |
| Expand / collapse | `expand_more` / `expand_less` | `pi-chevron-down` / `pi-chevron-up` |
| Next, go into | `chevron_right` | `pi-chevron-right` |
| Busy | `progress_activity` + `tb-i--spin` | `pi-spinner pi-spin` |

## 2. Colour

- **Only roles `--p-md-*`** in styles. Never `--p-surface-N`, `--p-<colour>-N` palettes, or opacity for
  dimming: muted text is on-surface-variant; 38 % only for disabled controls.
  `core/theme/design-rules.spec.ts` fails on Aura tokens (`--p-primary-color`, `--p-text-*`, `--p-content-*`,
  `--p-highlight-*`), hex colours in styles outside `core/theme/` and `boards/`, `size="small"` and outlined buttons.
- **Scheme from the portal colour** (seed, ADR-0034): a preset palette or custom `#rrggbb` → shades 50–950
  (PrimeNG's primary palette: `updatePrimaryPalette`, `palette()`); shade 500 is the seed of the M3 dynamic scheme
  of `@material/material-color-utilities` — **Fidelity**, spec 2025 (M3 Expressive): primary and the primary
  container keep the chosen colour. All M3 roles of both themes (primary, secondary, tertiary, error, surfaces,
  outlines, inverse) and the neutral palette (tones 99…10 as shades 0–950) come from it (`color-scheme.ts`) and are
  pushed via `updatePreset`. No `oklch(from …)` in CSS. Recomputed on load and when the portal colour is saved.
- **Contrast is guaranteed by tone** (ADR-0023 kept): primary, error, success, warning ≥ 4.5:1 against their on-
  colour, page, card and list tiles; secondary, tertiary, on-surface-variant ≥ 4.5:1 on every surface; every
  on-*-container ≥ 4.5:1 on its container; inverse-primary on inverse-surface. A role short of it is moved along its
  hue (`readable`). The hero card (primary container — the portal colour itself) carries only on-primary-container:
  its links and text buttons take that colour (links underlined). All preset palettes and sample own colours are
  tested in both themes. The custom-colour check reports darkening and warns when primary is close (OKLab ΔE×100 <
  12) to error (since 0.17.0 not to success: no button is green, ADR-0045).
- **System bars** (`core/theme/system-bars.ts`): `<meta name="theme-color">` and the manifest link carry the top
  bar's colour — light surface-container, dark surface — following the theme and the portal colour; the manifest's
  `background_color` is the page (surface-container). Chrome paints the status bar from the meta tag and, in an
  installed app, the navigation bar from the manifest's `theme_color`.
- **Custom roles:** success and warning are M3 custom colours (`customColor`): Aura green 500 / amber 500
  harmonized with the seed, tones 40 / 100 / 90 / 10 (dark 80 / 20 / 30 / 90). Error is M3's error palette. No info
  role — info uses tertiary.
- **Status = severity = role** (the map status → severity lives in the module's `*-labels.ts`; tags, calendar
  and widgets take it from there):

  | Meaning | severity | Container |
  |---|---|---|
  | main state («Запланировано», «Выдано») | `primary` | primary-container |
  | neutral («В архиве», «Отключён», «Не отмечено») | `secondary` | secondary-container |
  | success («Проведено», «Принято», «Оплачено») | `success` | success-container |
  | waits for action / warning («Пропуск», «На проверке», «Ждёт ответа») | `warn` | warning-container |
  | error, debt, cancellation («На доработке», «Отменено учеником») | `danger` | error-container |
  | info, hint | `info` | tertiary-container |

- `p-message` — role container, no border or shadow, Body Medium. `p-badge` — error by default, `warn`,
  calm counter `secondary`; a badge on an icon (the bell) has no outline and sits inside the 40 px button: its start at the icon's middle, 4 px from the top (M3). Calendar events: conducted —
  success-container, missed — warning-container, cancelled — surface-container-highest + on-surface-variant +
  strikethrough; student request — 2 px warning outline; busy / off-time — outline / outline-variant; a dropped
  lesson waiting for confirmation — 2 px primary outline and two 28 px round buttons on its card: ✓ «Перенести»
  (primary) and ✕ «Отменить перенос» (surface-container-highest); the move is saved only on ✓.
- **Surfaces:** page — surface-container (light) / surface (dark); cards, «Ещё» panel, dropdowns —
  surface-container-lowest (light) / surface-container (dark); in component styles `--tb-card`; list tile `--tb-list-item` —
  surface-container-low / surface-container-high. **Dialogs** (M3, ADR-0044, 0.16.2) — surface-container-high in both
  themes: inside `.p-dialog` `--tb-card` is the dialog's colour (the notch of a field's label) and list tiles are
  surface-container-lowest, so they stand apart in both themes (`color-scheme.spec.ts`); surface-container-highest is
  not used beside a dialog, as M3 asks. The top bar keeps its tone when the page scrolls (no raise on scroll). Scrim 32 % in both
  themes.
- **Themes:** «Светлая», «Тёмная», «Как в системе», stored on the device; switched by a class on `<html>`.
- Text contrast ≥ 4.5:1, outlines and focus rings ≥ 3:1.

## 3. Typography

- Google Sans variable (weights 400–700), bundled from `@fontsource-variable/google-sans` (no CDN). Monospace — `var(--tb-font-mono)`.
- Set roles with the shorthand `font: var(--tb-type-<role>)` (size, line height, weight) plus
  `letter-spacing: var(--tb-tracking-<role>)`; page text is Body Large.
- Page title — Headline Medium emphasized (phone: Headline Small emphasized); card title — Title Large
  emphasized; dialog title — Headline Small emphasized; section subtitles — Title Medium; field labels,
  buttons, menu items, dropdown options — Label Large; tooltip, `small`, stat details — Body Small.
- **Emphasized roles** (M3E, ADR-0044) — `--tb-type-<role>-emphasized`: the same size and line as the baseline,
  heavier. Display S, Headline L/M/S, Title L — 500; Title M/S, Label L/M/S — **Bold 700**. Weights are 400 and 500,
  and 700 only through those emphasized tokens (never a bare `font-weight: 600/700`). Emphasized marks the
  exception (titles, the hero time, the active navigation label); the baseline stays the rest of the scale.
  Tracking: `--tb-tracking-<role>` beside `font` (display, headline and title large have none; an emphasized role
  takes its baseline's tracking). The scale has Display S (36/44) and Headline L (32/40) besides the roles above.
- Wrap text between words (`overflow-wrap: break-word`); `anywhere` only for codes, URLs, paths, env names
  and table cells with columns. Empty-state titles have no trailing full stop.
- Dates, plurals and numbers — glossary (`CountPipe`, non-breaking space between number and unit).

## 4. Layout and navigation

- **Breakpoints** (em ranges, same in CSS and `mobile.ts`, no gaps):

  | Window | Query | Navigation | Main action |
  |---|---|---|---|
  | compact (phone) | `width <= 48em` | bottom bar: four sections + «Ещё» | extended FAB above the bar |
  | medium | `48em < width < 75em` | navigation rail 96 px (icon + label) | button in page header |
  | expanded | `width >= 75em` | expanded rail 280 px, items 56 px, 4 px gap | button in page header |

  No other breakpoints (480 px is gone). Below 30em height the top bar is not sticky.
- **Bottom bar:** four sections of the role (`NAV_ITEMS` in `shell.ts`) — «Главная», «Расписание», «Доски» («Мои доски»), «Оплаты»
  (`TEACHER_BOTTOM_NAV` / `STUDENT_BOTTOM_NAV`; the rail keeps the menu order), then «Ещё» (other sections,
  help, settings, account, sign out); five sections fit without «Ещё». Item as wide as its label, ≥ 64 px, the
  rest of the width shared (`minmax(64px, auto)`: «Расписание» fits a 360 px phone), Label Medium, never truncated —
  a larger font wraps a label with hyphens (M3: whole up to 2× text); the rail's labels wrap the same way. «Ещё» is
  active when its section is open. The bar (M3E flexible navigation bar, 0.16.3, ADR-0044) is 64 px of
  surface-container without a top border; item padding 4 px, 4 px from the icon to the label. Indicator — 56×32
  pill, secondary-container, moves on `--tb-spring-fast-spatial`; same in the rail (96 px, M3E collapsed rail). **Active item** (M3E flexible bar and vertical rail item, 0.16.2):
  label in **secondary** and Label Medium emphasized (Bold 700), the icon on-secondary-container on the pill and
  **filled** (`'FILL' 1` on `--tb-spring-fast-effects`, 0.17.2); navigation icons are 24 px;
  inactive labels on-surface-variant, Label Medium. The expanded rail (280 px) keeps on-secondary-container and
  Label Large for its horizontal items.
- **Top bar** (64 px, sticky): logo (cut to a circle, `tb-portal-logo round`) and portal name, bell, user menu
  (settings, help, account, theme, language, sign out; a student's photo instead of the person icon). No cabinet
  name.
- **Cards on the phone:** 16 px at the sides (M3 compact), 12 px around a list or a table, so the titles of
  all cards line up.
- **One column:** cards stacked (`tb-stack`) on every screen, ordered by importance (what needs action
  first). No card grids. Every page full width (0.9.2: settings and «Мой аккаунт» too); a form keeps a
  readable width inside its card (`tb-form--narrow`); «Мой аккаунт» puts its forms in cards side by side — they
  take the card's width (0.15.1). Columns only inside one row of data
  (name — value, table columns, row buttons, filter fields).
- **Long settings pages** use foldable sections `tb-fold-card` (not tabs): header is a button with chevron and
  a line of explanation; content loads on first open; open sections in the URL (`?open=`). Pages: the
  administrator's and the teacher's «Настройки» (portal · calendar and calls · failed deliveries with a
  counter · data), «Уведомления».

## 5. Page anatomy

- **Header** `tb-page-header` (`@shared/ui`): «Назад» icon button on nested pages (tooltip = destination,
  e.g. «Все задания»); h1; «?» help if the section has an article; detail line (due date, status); actions on
  the title line (56 px), main one last (right). On the phone actions go under the title, equal width.
  **0.9.2:** on the phone a section page shows no title (visually hidden, kept for screen readers) and no
  «?» (help is in the user menu); the header keeps only details and actions, and takes no room without them.
  Nested pages keep «Назад» + title on one line.
- **Main action** — filled `tb-page-fab`, last header action; on the phone an extended FAB (icon + label,
  primary-container, shadow), always visible. FAB only for create/record (student, lesson, task, payment);
  at most one per page.
- **FAB menu** `tb-fab-menu` (`@shared/ui`, M3 Expressive, 0.15.0): the home page's quick actions on a phone instead of
  the row of buttons. The FAB «+» (56 px, primary container) opens up to six pills over it (56 px high, full corners,
  primary container, Title Medium, icon 24 px, 24 px padding, 4 px apart, end-aligned, appearing one after another)
  and turns into the round «Закрыть» (primary). Esc, a tap outside or an item close it; the focus goes to the first
  item and back to the FAB.
- **Sections** — `p-card` with a title (h2, Title Large); help as «?» next to the title; section actions —
  tonal, in the title row (`tb-card-title__actions`). In a `tb-fold-card` (its header is a button) the action
  goes in the first body row, right. A card holding the page's only list gets a hidden `h2.tb-sr-only`.
- **Nearest lesson hero** (home, 0.15.0; `schedule/home/upcoming-lesson-widget.ts`, `next-lesson-widget.ts`): a
  calendar event in the `tb-hero` card — the time tile `tb-lesson-time-tile` on the left (primary fill: day «Сегодня» /
  «Завтра» / «чт, 16.10» in Label L, the start in Display S emphasized (0.16.2, our decision: the one hero moment of the portal; tabular figures, one line — the tile grows on a narrow card), the length; within an hour «через N мин»; while it runs «Идёт
  сейчас» and «ещё N мин», from `lesson-clock.ts`), who and the topic next to it, the boards as chips (`tb-board-links [chips]`, the student's `tb-my-board-links` since
  0.15.3: no «Доски:» caption, assist chips `tb-board-chip` in the text colour at 12 %), one filled button
  («Начать урок», while it runs «Войти в урок»; on a narrow card under the tile, full width — `tb-join-wide`, a split
  button too) — since 0.17.1 the one M3E medium button of the portal (56 px, `tb-button-m` / `tb-split--m` via
  `tb-join-lesson-button [medium]`, the student's `tb-lesson-actions [hero]`); the request buttons stay 40 px. The student's request
  buttons are at the end of the event (under it, across the width, on a narrow card) and are hidden while the lesson
  runs (0.15.1: the student's card is laid out as the teacher's — no visible title, «Занятие» or the group, the
  topic and «Занятий на неделе» next to the tile). No «Расписание» link: the schedule is in the
  navigation. When the lesson ends the widget asks the home page to reload the summary. The teacher's card has no
  visible title (`h2.tb-sr-only` «Следующее занятие»): it is the first card and the tile says what it is.
- **Forms on a page** — buttons in `tb-form-actions` bottom right; full width on the phone.
- **Toolbar above a list** (`tb-toolbar`): search left, filters (labelled switch) and period right.
- **Search field** — always `tb-search-field` (`@shared/ui`, a form control; 0.15.0): the M3 docked search bar, 56 px,
  a filled pill without an outline (in focus too — the focus state layer), the magnifier and «×» «Очистить поиск» (while
  there is text; Esc clears) each centred in a round end (4 + 48 + 4), the text from 56 px; the browser's own clear
  button is hidden. Its own width (20 rem, no wider than its place): «×» never resizes it; on a phone it takes the
  toolbar's width.
- **Editor page** (assignment editor, 0.14.0): a long form gets its own route instead of a dialog. The save action
  («Выдать» / «Сохранить») is the header's main action, filled in the portal colour (since 0.14.1, not green); a
  second way to save («Выдать и поместить на доску») is tonal before it. Content cards take the full width; the
  AI assistant is a bar inside the text field, between its header and the text (0.14.4): request, «Промты» menu
  (search, save, library), «Опереться на» popover, generate; the draft comes between the bar and the text. Hidden in
  «Просмотр». Markdown is one field
  with a «Текст / Просмотр» switch at every width — never a second, side-by-side field. Students and groups are two
  multiselects side by side (a settings grid of `minmax(16rem, 1fr)` columns), so a group never gets squeezed. Leaving
  with unsaved changes asks (`canLeaveGuard`, danger confirmation).

## 6. States and feedback

- Every section that loads data has three states via `LoadState` (`shared/ui/load-state.ts`, `track()`)
  and `tb-load-state`: **loading** (M3E indicator centred in the section's place — a 38 px shape in on-primary-container inside a 48 px
  primary-container circle, a pulsing circle under reduced motion; min height, «Загрузка…» `role="status"`), **error** (icon, «Не удалось загрузить …», error text with code, «Повторить»), **ready**
  (data or empty state). Empty state only after a successful load; a bad link («Задание не найдено») is an
  error state.
- Load requests are quiet (`quietContext()` / `SKIP_ERROR_TOAST`): the error shows in the section, no toast.
- **Empty state** — only `tb-empty-state`: icon, what is empty, what will appear, first-action button —
  omitted if the same action is the FAB or a card-title button. `compact` variant for home widgets and
  calendar.
- **Snackbar** (`core/snackbar`): bottom centre, inverse-surface, above bottom bar and FAB on the phone. Never
  takes focus; success/info `role="status"`, error `role="alert"`; 5 s, error 8 s, paused on hover/focus;
  «Закрыть» 40×40; identical message not repeated while visible. Actions toast their result only if it is
  not visible in place (moved off screen or to another section).

## 7. Buttons

Variant = **weight**, colour = **one accent** (ADR-0045): filled is primary (the portal colour), tonal is neutral
secondary, red only destroys; green and amber are statuses, never buttons. Size is one, with one exception (size M
in the hero, below): 40 px pill (icon button 40×40, 48 px touch target),
Label Large, 16 px side padding, 20 px icon (M3E small button); icon buttons 24 px (M3, since 0.17.2); shape morphs to 8 px while pressed. Never `outlined` (outline is for inputs only),
`size="small"`, `success`, `warn`, `info`, `help`, `contrast` on buttons.

| Role | Variant | PrimeNG |
|---|---|---|
| Main page action / dialog submit / login form | filled primary | no severity |
| Secondary page or section action, section save | tonal neutral | `severity="secondary"` |
| «Отмена», «Скрыть», «Понятно», labelled row action | text | `[text]="true"` (+ `severity="secondary"` for «Отмена») |
| Icon action (edit, link) | text, round, neutral, tooltip | `[text]="true" [rounded]="true" severity="secondary"` + `pTooltip` |
| Delete or unbind in a row: bin / «×» icon, labelled «Удалить» with a bin | text red | `[text]="true" severity="danger"` |
| Confirm an irreversible action (in a dialog) | filled red | `severity="danger"` |

- **Red means destruction only.** «Пропуск», «Вернуть на доработку», «Отменить занятие…», «Отозвать запрос»,
  «Вернуть как в .env» are neutral tonal or text: the status they produce (a tag, a message) shows the meaning.
  Filled red stays for the confirmation step only.
- **Page:** at most one filled button outside dialogs — the FAB; without a FAB, the single filled button is the
  page's main decision («Принять», «Сохранить и перезапустить», «Далее», «Войти»), always primary.
  Everything else tonal; «Подключиться» is tonal in rows, filled only in the home hero and the bottom sheet.
- **«Отмена» means only "close without consequences":** neutral text button
  (`severity="secondary" [text]="true"`), never red. «Назад» is navigation (page, wizard step), not closing.
  Window that only informs closes with «Закрыть».
- **Row actions:** at most three; labelled — text; icons — neutral round, red for delete.
- **Size M** `tb-button-m` (ADR-0045; M3E `ButtonMedium`): 56 px, full corners, 12 px while pressed, 24 px icon,
  24 px sides, 8 px gap, Title Medium label (our decision); split button `tb-split--m` (`SplitButtonMedium`:
  trailing part 56 px with a 26 px chevron, inner corners 4 px, 12 px while pressed — ours). Only for the hero (§5).
- **Steady widths:** a button whose label changes («Отменить» / «Не приду») uses `tb-button-steady`.
- Every action that sends a request shows `[loading]` while it runs (`shared/ui/busy.ts`); the submit button is
  never disabled for invalid fields — only while the request runs.
- **Connected button group** `tb-button-group` (also `p-selectbutton` and the calendar views `tb-fc-segments`):
  2 px gap, inner corners 8 px, outer full; unselected tonal, selected primary and fully round; no outline.
  Pressed, the outer corners square to 8 px as any button and the inner ones narrow to 4 px.
- **Split button** `tb-split` (e.g. «Начать урок» | «Открыть в браузере»): 2 px gap, inner corners 4 px (8 px
  while pressed — the size is ours, the outer corners stay round), trailing part 48 px with a 22 px chevron (M3E
  small); while its menu is open the trailing part is round and the chevron turns 180° on
  `--tb-spring-standard-fast-spatial` (M3: the standard scheme, no bounce). The arrow has no tooltip (0.15.0, the teacher's decision): only its
  `aria-label`; the empty host of the popup menu is out of the flow, so the group ends at the edge of its container.
- Icon buttons: tooltip = accessible name, with row context («Отменить занятие: Анна, 14:00»); help «?»
  includes the article («Справка: Портал»); menu buttons have `aria-haspopup` + `aria-expanded`
  (`tbAttributes`).

## 8. Dialogs, sheets, menus

- **Modal side sheet** `tb-side-sheet` (the help, 0.15.0): a right drawer 1 rem from the window edges, 42 rem wide,
  large corners, surface container low, scrim 32 %; the header is «←» (only when there is a way back), the headline
  (Title Large) and «×». A link of a help article to another one opens it in the sheet («←» returns); other links
  close the sheet and open their page. On a phone — the whole screen, no corners.
- **Width by class**, never inline: `tb-dialog` 32 rem, `tb-dialog--wide` 40 rem, confirmations ≤ 35 rem;
  never closer than 1 rem to the screen edge.
- **Phone:** full screen only for dialogs with ≥ 2 fields or long content (e.g. the full reset: password and
  the word); one field or none — `tb-dialog--short`, centred.
- **Form dialog:** `<form [id]>` in the body, submit in the footer with `type="submit" [attr.form]`
  (`tbSubmitFor`) so Enter submits; order «Отмена», then the action.
- **At most one red button per dialog** — the confirmation of the dangerous action. Other dangerous actions go
  to the «⋮» menu in the dialog header (`tb-menu-item--danger`) or a confirmation step inside.
- Initial focus on the dialog title (`[focusOnShow]="false"`, `tabindex="-1"`), not on a button. A dialog
  never opens another dialog on top.
- **Confirmations** only via `dangerConfirmation` / `safeConfirmation` (`@shared/ui/confirmation`): danger —
  filled red action; safe — filled primary (since 0.17.0, not green); both get neutral «Отмена»; the reject label/props cannot be overridden.
- **Lesson dialog:** footer — the main action for the lesson state («Проведено | Пропуск» group,
  «Восстановить», «Отметить посещаемость»); «Изменить» — pencil in the header; «Отменить занятие…»,
  «Удалить…», «Снять отметку» — «⋮» menu; «Начать урок» — tonal.
- **Bottom sheet** (phone row actions that don't fit): `p-drawer` bottom, `styleClass="tb-sheet"`,
  `tbModalDrawer`; handle, 28 px top corners, height by content, full-width buttons. Closes by Esc, scrim and
  «Закрыть» (no swipe). Example: upcoming lesson row on the phone = icon, time and details, chevron
  (`tb-list__stretched` button); sheet holds «Подключиться» and «Перенести | Отменить» group.
  0.15.3: the teacher's «Отметьте прошедшие занятия» the same way — on a computer the row has labelled text
  buttons «Проведено» and «Пропуск» (neutral since 0.17.0), a group «Отметить»; on the phone the row (avatar, name,
  time, chevron) opens a sheet with them full width.
- **Menus and dropdowns:** 16 px container, 4 px padding, elevation 2; items are tiles with 2 px gap — 4 px
  corners, 12 px on the outer side of the first and the last item and on the selected one; *our decision, not M3:*
  items next to a separator get the outer 12 px too, so each group between dividers reads as one segment, as our
  lists do — the divider stays, as M3 separates menu groups on the web (dropdown lists —
  global rules in `styles.scss`, the select's own style would override the preset), hover 8 %; selected item — secondary-container / on-secondary-container, as M3 menus have it, with a check at its end (the theme and the language: `menuitemradio` + `aria-checked`, no «(выбрана)» since 0.15.0); destructive item red.

## 9. Lists and tables

- **Every list of data inside a card or dialog is a segmented list** `ul.tb-list` (CSS subgrid: lead, text,
  trail columns shared by all rows, so buttons line up): tiles `--tb-list-item`, 2 px gap, inner corners 4 px,
  outer `--tb-list-outer` — nested in its container (§1: 4 px in a card on a computer and in dialogs, 8 px in a
  phone card, 16 px right on the page; a single tile has it on all corners), height ≥ 56 px, padding 12 / 16 px.
  - `tb-list__lead` — 40 px secondary-container circle: for people the component `tb-avatar`
    (`@shared/ui/avatar`: the student's photo cut to a circle, otherwise the initials; `size` for a bigger
    one, e.g. 96 px in the «Мой аккаунт» hero; 0.9.2: the teacher has a photo too), an icon for things;
    0.15.2: a list whose icon only decorates (tasks, boards, textbooks, calls, notifications, requests, lessons
    of the student, recurring lessons and days off, payments, AI requests and prompts) takes `tb-list--no-phone-lead`:
    on the phone (≤ 48em) the icon goes and the text starts at the tile's edge; lists of people keep avatars;
    0.15.3: notifications (the home card and the inbox) have no icon at all — `tb-list--no-lead`; on the phone an
    unread one is marked read by a swipe sideways (`tbSwipe`, `@shared/ui/swipe`: follows the finger and fades,
    ≥ 30 % of the width marks it, otherwise it comes back; vertical moves stay the scroll); 0.15.4: on the phone
    such a row has no tick (the teacher's choice) — opening it and «Прочитать все» read it too;
  - `tb-list__text` — `tb-list__title` (Body Large) + `tb-list__supporting` (Body Medium, on-surface-variant);
  - `tb-list__trail` — amount (Title Medium), status or ≤ 3 actions.
  - On the phone (list < 26 rem) row buttons go under the text, full tile width, from the left;
    `tb-list__trail--icons` keeps a status and icon buttons on the right.
  - Students and groups (0.7.3) — a `tb-list`, not a table: initials / icon; name + one supporting line (a
    student's phone, a group's members); trail — status `p-tag` and «⋮» (one popup `p-menu` per list, items
    for the clicked row, `aria-haspopup` + `aria-expanded`). Everything else lives in the edit dialog
    (login read-only, the room — `tb-room-panel`); a student's login and note — tooltip on the name
    (`tb-tooltip-lines`, focusable).
  - Assignments (0.14.1) — the same `tb-list` of cards instead of a table: icon (a board icon when the assignment is
    on a board); title link + «кому · до dd.MM.yyyy HH:mm» (three names, then «и ещё N»); trail — the progress `p-tag`
    (`assignmentProgress` in `homework-labels.ts`: «Не выдано» secondary, «На проверке: N» warn, «Принято» success,
    «Выдано» / «Принято N из M» primary) and «⋮» («Открыть», «Изменить», «Проверить работы», «Открыть доску»,
    «Удалить…» red).
  - Homework cards (0.14.2) — the student's «Задания» (icon; title link + «до …», red when overdue; status), the
    students of an assignment (avatar; name link to the task + «Сдано … / Не сдано»; status; «Добавить» at the top
    right of the card — `tb-card-title__actions` — opens «Выдать ещё ученикам»), the review queue (avatar; name link +
    «задание · сдано · срок»), files of assignments and answers (type icon; name button that downloads + size; the
    red «×» of the textbooks; the teacher's name button opens a PDF or a picture in a tab, the download is an icon
    button; picked files not sent yet are the same cards). The teacher opens a bound textbook by its title. «Открыть доску» — `pi-arrow-up-right`, «На доску» — `pi-tb-board`.
- AI requests (0.14.7) — the teacher's «Последние запросы» is a `tb-list` of cards, not a table: feature icon
  (`pi-file-edit` / `pi-check-square`); feature + status `p-tag`; «dd.MM.yyyy HH:mm · model · N с», the error under it
  (`tb-negative`); trail `--amount` — tokens; 10 rows, then «Показать ещё».
- Billing (0.9.3) — `tb-list`s like the students, also on the phone: balances (avatar; name link +
  «цена за занятие · N занятий · последнее дата»; trail — balance and the wallet button) and a student's
  history (`tb-ledger-list`: calendar / wallet icon; operation + status tag; «date · topic or comment»; trail —
  the amount and «×» for the teacher; 20 rows, then «Показать ещё»).
  `tb-list__trail--amount`: on the phone the amount (`tb-list__amount`) goes under the text and the icon
  button stays on the right, so the name keeps its width.
- Boards of the teacher (0.9.3) — a `tb-list` like the students: kind icon; title link + «вид · кому ·
  изменена»; trail — «⋮» only («Резервные копии», «Изменить», «Удалить…» red), one line on a phone. 0.15.3: two
  cards «Доски на портале» (Excalidraw) and «Внешние доски» (by link), each with its own search inside, as the
  assignments (0.15.4; `tb-search-field` «Поиск: <card>», only while the card has boards), the supporting line drops
  the kind; the student's «Мои доски» the same (a card without boards is hidden). A tap anywhere on a row opens
  the board: the title is a `tb-list__link` whose `::before` covers the row (`tb-list__item--link` for the hover,
  the focus ring on the row), the «⋮» stays above it.
- Recurring lessons and days off of the teacher's schedule (0.15.3) — trail «⋮» only («Изменить», «Завершить…» /
  «Удалить…» red; one popup `p-menu` for both cards).
- Backups (0.9.1) — a `tb-list`: database icon; the date + «kind · size»; trail — «⋮» only («Восстановить…»,
  «Скачать», «Удалить…» red), so a row is one line on a phone.
- **Name — value pairs and key figures** — `tb-stats` / `tb-stat` (tiles one under another: name left, number
  right, details below).
- **Tables** — `p-table` with `styleClass="tb-cards"`: rows are the same tiles (no cell lines, 2 px gaps); on
  the phone each row becomes a card «column: value» (`data-label`); outer corners nest like the lists' (§1). Main column
  `tb-col-main`, amounts `tb-amount`. Statuses — `p-tag`, one shape, no wrapping. Row typing — `tbRowType`.
- Not data lists: wizard steps, help items, checklists, bot capability lists, files picked before upload — plain text
  lists.
- No custom row markup for data in cards or dialogs.

## 10. Fields

- M3 outlined text field, 56 px: outline; hover on-surface; focus 2 px primary; error — error colour.
- `.tb-field` with the `label` **first** (or a `tb-copy-row` / `tb-inline` row with the field first): the
  label sits on the outline (Body Small), primary on focus, error on error. A field with its own header
  (`tb-field__header`) keeps the label above. Every field has a visible label (filters too).
- Required fields: `*` after the label + `aria-required` (`tb-field--required`); optional ones unmarked.
- Errors: `<form tbFieldErrors>` (`shared/ui/field-errors.ts`) shows text under the field (Body Small, error;
  replaces the hint), sets `aria-invalid` / `aria-describedby`, maps server error codes (e.g. `login.taken`)
  to their field; submit with errors shows all and focuses the first.
- Date field — one field with a trailing calendar icon. Search — `p-iconfield` with `tb-i-search`: filled pill
  (surface-container-high), no outline; dropdown filter — the same pill, 48 px, named «Поиск».
- Password: `tb-password-toggle` — 40×40 icon button inside the field, «Показать пароль» / «Скрыть пароль»,
  `aria-pressed`.
- A 40 px button next to a 56 px field is centred on it (`tb-copy-row`).
- Multi-line text (`textarea.p-textarea`, 0.14.2) resizes only vertically and never grows wider than its field, so it
  cannot be dragged out of the card. A review form is as wide as its card (no `tb-form--narrow`).

## 11. Accessibility (WCAG 2.2 AA)

- Keyboard focus ring: 3 px secondary, 2 px offset (fields: 2 px primary outline). In navigation the ring
  goes around the item and state layers lie over the active indicator, not instead of it.
  Custom controls (the search field's «×», calendar buttons) take the same ring; their hover is a state layer
  (`color-mix` with `--tb-state-*`), never `filter` or a literal opacity.
- Rail and bottom bar are `<nav>` with links, active `aria-current="page"`; «Ещё» and the user menu —
  `aria-haspopup="menu"` + `aria-expanded`; the user-menu name starts with the visible name.
- Headings: h1 page title (and «Вход», «Приглашение»); **h2 section** (`p-card` title via the global
  pass-through `core/a11y/pass-through.ts`, `tb-fold-card`); h3 cards inside a foldable section; Markdown
  headings one level below their container.
- Bottom sheet and help panel are modal (`tbModalDrawer`: trap, Esc, scroll lock, `role="dialog"`,
  `aria-modal`, named by title, focus on first action). Focus **returns** to the opener after closing a
  dialog, sheet or menu (`core/a11y/focus-return.ts`); after a failed login — to the password field.
- «×» of dialogs, sheets, toasts — 40×40 button «Закрыть». PrimeNG and FullCalendar service labels in Russian.
  Progress bars — `tbProgressLabel`.
- Links inside text are always underlined; navigation, button-links, row title links (`tb-link`) and menu
  items are not.
- Media queries in `em` ranges; at 200 % font the layout moves to rail/phone without horizontal scroll.
- E2E runs axe (no critical/serious) on the main screens, and checks button height (40 px), the number of
  filled buttons per page, no red «Отмена», no `outlined` / `size="small"` / `success` / `warn` / `info` buttons,
  red buttons only for danger confirmations and deletion (0.17.0).

## 12. Portal branding

- Portal colour — preset palette or custom `#rrggbb`, stored in `platform` settings, applied at start.
  Its swatch in settings is the light primary container with an on-primary-container check (`accentSwatch`):
  white is short of 3:1 on teal and emerald.
- Logo — PNG, JPEG, WebP or SVG ≤ 1 MB, stored in `platform` storage (backed up, removed by full reset),
  served without login at `/api/public/portal/logo`; SVG with `Content-Security-Policy: sandbox`. In the top bar
  and its preview in settings it is cut to a circle (`object-fit: cover`); on the sign-in page it keeps its shape.
- Browser icon — `favicon.svg` (graduation cap on indigo, rounded square) with `favicon.ico` (16/32/48) and
  `apple-touch-icon.png` (180 px); the portal logo, when set, replaces all of them.
- Minimum browsers: Chrome 119, Safari 17.2, Firefox 128 (`linear()`, `:has()`, `color-mix()`); older ones get
  no springs.

## 13. Call window (ADR-0030)

- **Where:** `CallHost` sits in the root component above the routes, so a call goes on across layouts and the
  full-screen board editor; one call per tab (`CallSession`). Styles — section «Built-in calls» of `styles.scss`.
- **Pre-join** — a `tb-dialog`: the camera preview (16:9, `--tb-shape-lg`; initials while the camera is off),
  microphone and camera toggles under it, device fields only when there are several; «Отмена» text, «Войти»
  filled portal colour. Notes when the current call will end.
- **Full window** — fixed over the page (`role="dialog"`, title focused, Esc minimizes), surface-container;
  header: title (Title Large emphasized), time and people (Body Medium, on-surface-variant). Stage
  (`call-layout.ts`): alone — own tile centred with «Пока в комнате только вы»; pair — the other on the stage, own
  tile floating in a corner of the stage as in messengers (`call-self.ts`, elevation 2; dragged to any corner or
  moved with the arrow keys, remembered on the device); three and more — a square grid (`gridSize`, at most two columns on a phone); a
  shared screen — on the stage with everyone in a strip (side, bottom on a phone).
- **Tiles** — `--tb-shape-xl`, surface-container-highest; own camera mirrored, screens not; a 3 px primary
  outline on the speaker; the name in an inverse-surface pill (Label Medium) with a crossed microphone and a
  weak-connection icon; initials in a primary-container circle while the camera is off.
- **Toolbar** — the M3 Expressive floating toolbar: a pill of surface-container-high with elevation 2. Its
  buttons are the exception to the 40 px rule: 56 px (48 px on a phone, 44 px in the mini window) round
  toggles (radius half the height); a switched-off microphone or camera turns error-container with `mic_off` /
  `videocam_off` (0.17.2), and it and an active screen share become a rounded square — the M3E
  icon button selected shape: 56 px CornerLarge (16 px), 48 and 44 px CornerMedium (12 px, as the small icon
  button; our choice for sizes M3 doesn't have) — on `--tb-spring-fast-spatial` (0.16.3); pressed — 12 / 8 px.
  `aria-pressed` on every toggle. «Выйти из звонка» — a wider red button with
  the hang-up phone. No tooltips on call buttons (they cover the video); the labels are for screen readers. The
  settings menu («Настройки звонка», the gear) lies above the window (`baseZIndex`): groups «Микрофон», «Камера»
  (the chosen device checked), «Обработка звука» (three checkable switches) and «Связь» → «Сведения о связи» — a
  `tb-dialog` with titled «label — value» lists (Title Medium headings, Body Medium, values right-aligned with
  tabular figures), refreshed every 2 s. Phones have no screen sharing.
- **Mini window** — on a computer 20 rem, surface-container-high, `--tb-shape-xl`, elevation 3, in a corner
  (dragged by its top line and snapped to the nearest corner, or «Переместить окно звонка»; remembered on the
  device); shows a shared screen, the speaker or a camera; compact toolbar. On a phone — a full-width pill above
  the bottom navigation; the FAB moves above it.
- **States** — «Подключение…» (the M3E loading indicator, `role="status"`), «Связь прервалась, переподключаемся…» (warning
  container), the end of a call with its reason (`role="alert"`), «Закрыть» and «Войти снова»; blocked sound —
  an info message with «Включить звук». Joins and leaves are announced in a polite live region.


## 14. Texts and languages (ADR-0035)

- **No text in templates or code:** every word the user reads comes from a dictionary — `core/i18n/{ru,en}.ts`
  (the frame), `shared/i18n/{ru,en}.ts` (common words: `SHARED_T.common.cancel`, `.save`, `.close`…) or the
  feature's `i18n/{ru,en}.ts` (`T`, from `i18n/texts.ts`). A component keeps its part as
  `protected readonly t = T.<part>` (and `c = SHARED_T.common`) and binds it: `{{ t.title }}`,
  `[label]="t.add"`, `[attr.aria-label]="t.list"`. Texts with numbers or names are functions of the dictionary
  (`t.saved(name)`, `countOf` for plurals); a date or an amount is formatted before it goes in.
- Russian is the source dictionary; another language has the same keys (`Translation<typeof ru>`), and
  `expectComplete` tests it. Wording of both languages follows [`glossary.md`](glossary.md).
- **Language switch** — in the user menu under the themes: each language in its own name with `pi-language`,
  the chosen one highlighted with a check (`aria-checked`); on the sign-in and invitation pages — the
  `tb-language-picker` row under the card. Switching reloads the page.
- Numbers, money and dates use the locale of the language (`locale()`: `ru-RU`, `en-GB`); fixed formats
  `dd.MM.yyyy` / `HH:mm` stay in both languages.
- **Server texts** ([ADR-0036](adr/0036-server-texts-in-the-users-language.md)): every `/api` request carries
  `Accept-Language` with the page's language (`core/i18n/language.interceptor.ts`); a language chosen on the
  device is saved to the account after sign-in, and notifications, bot messages and calendars are written in it.
