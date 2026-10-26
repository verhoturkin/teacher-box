# Design system

> The 2026-10 redesign (ADR-0048, releases 0.21.0–0.26.0) is finished and shipped; this page is the single source
> of its rules. The target spec and mockups are kept as history in `archive/redesign-2026-10/`.

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
- **Layout** — content up to `--tb-content-max` (1440 px); short pages (not found) in `--tb-content-narrow` (56 rem), form fields `tb-form--narrow` (26 rem); top strip
  80 px (compact top app bar 64 px), bottom bar 64 px (M3E flexible navigation bar), rail 96 / 280 px — chrome sizes in **px** so a large font grows text, not frames.
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
and multiselect `arrow_drop_down` / `arrow_drop_up`, «×» of dialogs, drawers, toasts and chips `close` (a chip's own
`times-circle` too, `styles.scss` `.p-chip`; elsewhere `times-circle` is the `error` of messages), the date
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
| Lesson repetition, retry, return for rework, re-invite | `replay` | `pi-replay` |
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
| Admin: events (chip «События» of the journal) | `sync` | `pi-sync` |
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
| Stop following repeats | `stop_circle` | `pi-stop-circle` |
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
  of `@material/material-color-utilities` — selectable **Fidelity** (default), Tonal Spot, Vibrant, Expressive,
  Neutral, Monochrome, Content, Rainbow or Fruit Salad. MCU uses spec 2025 for Neutral, Tonal Spot, Vibrant and
  Expressive; the other variants fall back to spec 2021. Choosing M3 Expressive component patterns does not
  require the Expressive colour variant. All M3 roles of both themes (primary, secondary, tertiary, error, surfaces,
  outlines, inverse) and the neutral palette (tones 99…10 as shades 0–950) come from it (`color-scheme.ts`) and are
  pushed via `updatePreset`. No `oklch(from …)` in CSS. Recomputed on load and when the portal colour, scheme or
  contrast is saved. Named contrast choices Reduced / Standard / Increased / Maximum map to MCU −1 / 0 / 0.5 / 1;
  Standard is the default. Numeric levels are implementation details, never UI labels.
- **Contrast is guaranteed by tone** (ADR-0023 kept): primary, error, success, warning ≥ 4.5:1 against their on-
  colour, page, card and list tiles; secondary, tertiary, on-surface-variant ≥ 4.5:1 on every surface; every
  on-*-container ≥ 4.5:1 on its container; inverse-primary on inverse-surface. This portal readability floor also
  applies at Reduced contrast, after MCU generation. A role short of it is moved along its
  hue (`readable`). The hero card (the selected scheme's primary container) carries only on-primary-container:
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
  success-container, missed — error-container + on-error-container (the debt and overdue-work accent), cancelled — surface-container-highest + on-surface-variant +
  strikethrough; student request — 2 px warning outline; busy / off-time — outline / outline-variant; a dropped
  lesson waiting for confirmation — 2 px primary outline and, in the middle of its card over an 88 %
  surface-container-lowest veil, a standard button group of M3E extra small icon buttons (32 dp, 20 dp icon, 18 dp
  apart, pressed 8 dp corners): ✓ «Перенести» filled and wide (40 dp), ✕ «Отменить перенос» tonal (32 dp); on a card
  narrower than 6 rem (lessons side by side) both are 32 dp and 4 px apart, and the dragged card lies above its
  neighbours, including adjacent day columns when the controls extend beyond a narrow card; the move is saved only on ✓.
- **Colours of students and groups (0.20.0, `core/theme/label-colors.ts`):** M3 static colours (formerly custom
  colours) — ten reference colours (Tailwind 500, red 600; hues about 30° apart), each giving the four roles
  `label-<c>`, `on-label-<c>`, `label-<c>-container`, `on-label-<c>-container` of both themes (`--p-md-*`) from its
  **Fidelity** scheme (2025 spec), so the container keeps the reference colour. Our decisions: not harmonized with
  the portal colour (harmonizing pulls neighbouring hues together); on-roles moved along the hue to 4.5:1;
  containers at least ΔE×100 10 apart and the colour role 3:1 on list and dialog surfaces (`label-colors.spec.ts`).
  `data-tb-label="<c>"` (or class `tb-label--<c>`) brings `--tb-label`, `--tb-on-label`, `--tb-label-container`,
  `--tb-on-label-container`; the same scheme gives its surface containers lowest / low / high and on-surface /
  on-surface-variant (`--tb-label-surface-container-*`, `--tb-on-label-surface*`, text 4.5:1 on all of them). Where
  it shows (the teacher only; the colour is looked up by id, `TeacherColors`): the avatar of a student or a
  group's leading icon uses the label container and its paired on-role; a photo keeps its image with a 2 px
  colour ring (our decision, 0.27.0). Rows keep the portal's neutral surface and selected state; the nearest-lesson
  card keeps primary-container; chips of student and group multiselects — the container (`tbChipColors`);
  the teacher's calendar (`showStudent`; the student's never) — a planned
  lesson takes the container, a conducted / missed / cancelled one keeps its status container plus a 4 px stripe
  of the colour at its start. The dialogs pick it in a select «Цвет» with a 20 px swatch per option («Без цвета» — an
  outlined empty circle).
- **Surfaces:** page — surface-container (light) / surface (dark); cards, menus, dropdowns —
  surface-container-lowest (light) / surface-container (dark); in component styles `--tb-card`; list tile `--tb-list-item` —
  surface-container / surface-container-high. The light list baseline uses surface-container rather than low
  for clearer separation from the light card. Cards inside panes remain transparent and inherit the pane's
  field surface. These surface assignments are portal decisions. **Dialogs** (M3, ADR-0044, 0.16.2) — surface-container-high in both
  themes: inside `.p-dialog` `--tb-card` is the dialog's colour and list tiles are
  surface-container-lowest, so they stand apart in both themes (`color-scheme.spec.ts`); surface-container-highest is
  used only by the fields in it, as M3 filled text fields do. The top bar keeps its tone when the
  page scrolls (no raise on scroll). Scrim 32 % in both themes.
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

- **Breakpoints** — M3 (600 / 840 / 1200 / 1600 px, ADR-0048); em ranges, same in CSS and `mobile.ts`
  (`BREAKPOINT_QUERIES`, `injectWindowSize()`), no gaps:

  | Window | Query | Navigation | Panes | Main action |
  |---|---|---|---|---|
  | compact (phone) | `width < 37.5em` | bottom bar: five sections; ☰ → modal expanded rail | 1 | extended FAB above the bar |
  | medium | `37.5em <= width < 52.5em` | collapsed rail 96 px (icon + label) | 1 | teacher: FAB «Создать» atop the rail, the only FAB |
  | expanded | `52.5em <= width < 75em` | collapsed rail 96 px | 2: fixed 360 + flexible | teacher: FAB «Создать» atop the rail, the only FAB |
  | large | `75em <= width < 100em` | collapsed rail 96 px (*ours*, D5) | 2: fixed 412 + flexible | teacher: FAB «Создать» atop the rail, the only FAB |
  | extra-large | `width >= 100em` | expanded rail 280 px, items 56 px, 4 px gap | 2–3: 412 + flexible + sheet ≤ 400 | teacher: small extended FAB «Создать» atop the rail, the only FAB |

  Narrow table cells next to the rail — medium and expanded (`37.5em <= width < 75em`); the main list column
  keeps 13rem from large. Regions and «Создать» by breakpoint — redesign spec §3 (231).
  No other breakpoints (480 px is gone). Below 30em height the top bar is not sticky.
- **Regions** (**M3**): the window and the navigation region (rail, top bar, bottom bar) are surface-container;
  page content lives on `surface` — in panes, or in the cards of a page that has no panes yet. The page title
  is the `tb-page-header` of the first pane (or of the page without panes), never a band of its own.
- **Rail** (`side-nav.ts`, 231.1, redesign spec §3.2): brand · «Создать» (teacher, 232.1) · sections · spacer ·
  bottom group. From medium the rail runs the full window height (sticky at `top: 0`, `z-index` 1001 so the open
  «Создать» list paints over the page) and its brand stands in the row of the top strip, as in the sketches: the
  strip starts where the rail ends (`--tb-rail-width` 96 / 280 px on the shell), the body is pulled up under it and
  the content pushed back down by the strip's height (*ours*). **Brand** —
  the portal logo (`tb-portal-logo round`) and name, plain text, not a link or button (**M3**: a logo in the
  rail must not look like an action); expanded rail: 28 px logo + name in Title Large emphasized (0.31.0; our branding decision), wrapping, in line with
  the item icons (*ours*); collapsed rail: the 40 px logo alone, the name `tb-sr-only` (*ours*). **Bottom
  group** (`tb-side-nav__footer`, pushed down by `margin-top: auto`): the area's settings (`footerLinks`:
  teacher `/teacher/settings`; the student and the admin have none — «Настройки» is the admin's fifth destination) and «Справка»
  (`/<area>/help`), same items as the sections. **Expanded item** (**M3E** expanded rail): the target spans
  the rail's width, the 56 px pill indicator hugs icon + label — 16 dp before and after, 8 dp between — in
  secondary-container; state layer and focus ring on the indicator.
- **«Создать»** (`core/layout/create-menu.ts`, 232.1, ADR-0048): the teacher's global create action, projected
  into the rail under the brand (`Shell` input `create`; student and admin have none; none on compact). Small
  extended FAB in the expanded rail (56 px, corner large, 16/8/16, Title Medium — **M3**), FAB 56 px centred in
  the collapsed rail (**M3**: collapsed rail → FAB, expanded → extended FAB); elevation 0 as nested in the rail
  (**M3**), primary-container, hover = state layer; 16 px to the destinations (*ours*). It opens `tb-fab-menu`
  (variant `extended` / `rail`) with seven items — Занятие, Задание, Оплата, Ученик, Доска, Учебник, Сообщение — the
  current section's item first, on «Материалы» the item of the open tab (*ours*). *Ours, against M3* (a FAB menu
  holds up to six): «Доска» and «Учебник» are two kinds of one section (245.2), merging them would hide a kind. *Ours, against M3* (which keeps FAB menus off extended FABs and rails):
  one global entry point instead of a create button per section (ADR-0048). An item opens
  `/teacher/<section>?create=<kind>`; the section opens its form via `openOnCreate()`
  (`core/routing/create-param.ts`) and drops the parameter with `replaceUrl`. «Сообщение» has no section: it is
  a `button` item (`FabMenuItem.run`) that opens the broadcast dialog over the current page (`NewMessageState`,
  the feature's dialog through `NEW_MESSAGE_DIALOG`, focus back on the FAB); a message sent refreshes
  «Отправленные» of the bell's sheet (235.3). From 600 px it is the screen's only
  FAB (232.2): a section whose create action is a menu item renders its `tb-page-fab` only on compact
  (`@if (mobile())`), and the home quick actions are gone; on compact the teacher home shows the same items
  as the phone FAB menu. Actions «Создать» does not make keep their header button at every width: «Оплата» of one
  student (ledger, prefilled).
- **Panes** (`shared/ui/panes.ts`, 230.2; **M3** canonical layouts): `tb-panes` holds `tb-pane`s of kind
  `fixed` (360 dp on expanded, 412 dp from large — **M3**), `flexible` (the rest, at least one per page) or
  `sheet` (standard side sheet, ≤ 400 dp, surface-container-low — **M3**). A pane is a `surface` sheet
  (dark: surface-container-low, including field label backgrounds, to separate it from the surface window — *ours*) with
  28 dp corners on the surface-container window (*ours*), 24 dp inner padding (16 on compact, *ours*); 24 dp
  spacer between panes, 24 dp margin at the trailing edge and the bottom, 16 dp at the sides on compact
  (**M3**). From expanded the panes stand side by side and each scrolls on its own; on compact and medium they
  follow one another and the window scrolls. Focus order = template order = visual order (nothing reorders
  panes); `label` makes a pane a named region. A pane that appears after the page enters on
  `--tb-spring-default-spatial` (opacity on the effects spring), panes of a new page don't, no stagger
  (*ours*). The shell drops its own content padding for a page of panes. A list right in a pane nests its
  corners: 28 − 24 = 4 px, on compact 28 − 16 = 12 px (`--tb-list-outer`, ADR-0044). **List-detail:**
  `injectListDetail(() => routeHasDetail)` — from expanded both panes, on compact and medium only the list or
  the detail by the route; the detail then has «back» (`tb-page-header [back]`) to the list's route. The page
  title is in the header of the first pane. First consumer: help (`/<area>/help[/:topic]`) — the contents with
  the search and each article's summary in the fixed pane, the article using the full flexible pane width.
  `tb-panes medium="two"` with `injectListDetail(open, 'two')` keeps both panes on medium at 50 % each
  (redesign spec §3.1: Settings only, *ours*). **Settings** (`/teacher/settings[/:category]`, 234,
  `features/settings/settings-categories.ts`): the categories as a segmented list of tonal two-line rows (a 40 px
  tonal icon circle, name, a short «what it holds»; hover — the 8 % state layer; the chosen row — secondary container,
  emphasized name, the icon circle on the surface; the group's outer corners 16 px, the rows between 4 px, 2 px apart;
  interactive `tb-list` rows have the same hover state layer and no underlined names, 0.28.0)
  in the fixed pane, the chosen one beside it (from expanded `/teacher/settings` shows the first, «Мой
  аккаунт»). Categories in list order: «Мой аккаунт» (`account`), «Портал» (`portal`), «Расписание и
  календарь» (`calendar`: time zone, Google Calendar, calendar feed), «Звонки» (`calls`), «Мессенджеры»
  (`messengers`: failed deliveries first when there are any — the item carries their count as a badge — then
  bots, own messengers, bot abilities, students' messengers, what to send), «Оплаты» (`payments`: default
  lesson price), «ИИ-помощник» (`ai`: model, usage, prompt library, system prompts), «Данные» (`data`). A
  category's detail is a stack of `p-card`s, no fold cards. Integrations live only here (ADR-0048): there are no
  Calls or AI sections. The old addresses redirect to their category: `?open=<fold>`, `?google=` (→
  calendar), `?drive=` (→ data), `/teacher/account`, `/teacher/calls`, `/teacher/ai` and the messenger tabs of
  «Уведомления» (`?open=` / `?tab=` → messengers); its other addresses open the bell's sheet (§8).
- **Bottom bar** (231.2): five sections of the role (`BAR_ITEMS` in `shell.ts`, **M3**: 3–5 destinations) in the
  order of `TEACHER_BOTTOM_NAV` / `STUDENT_BOTTOM_NAV` / `ADMIN_BOTTOM_NAV`, filled up from the menu; no «Ещё».
  Teacher (D2): «Главная» (for «Сегодня» until it ships), «Расписание», «Задания», «Ученики», «Оплаты»; student
  (246.1): «Главная», «Расписание», «Задания», «Материалы», «Оплаты» — all five in the bar, no «Ещё»; admin (247.1): «Состояние», «Журнал»,
  «Интеграции», «Копии», «Настройки» — all five in the bar too. The other sections and the rail's bottom group are in the **modal expanded
  rail** under ☰ (**M3E**: more than five destinations → modal expanded rail): `p-drawer` + `tbModalDrawer` on the
  start edge — scrim 32 % (**M3**), Esc / scrim / a destination / its menu button (`menu_open`, «Закрыть») close
  it, focus trap, focus back to ☰; `tb-side-nav [modal]` with the brand at the top; surface-container, elevation
  level 2, 16 dp trailing corners (**M3E** modal expanded rail), 280 px wide (*ours*, M3: 220–360). Item as
  wide as its label, ≥ 64 px, the
  rest of the width shared (`minmax(64px, auto)`: «Расписание» fits a 360 px phone), Label Medium, never truncated —
  a larger font wraps a label with hyphens (M3: whole up to 2× text); the rail's labels wrap the same way. The bar
  (M3E flexible navigation bar, 0.16.3, ADR-0044) is 64 px of
  surface-container without a top border; item padding 4 px, 4 px from the icon to the label. Indicator — 56×32
  pill, secondary-container, moves on `--tb-spring-fast-spatial`; same in the rail (96 px, M3E collapsed rail). **Active item** (M3E flexible bar and vertical rail item, 0.16.2):
  label in **secondary** and Label Medium emphasized (Bold 700), the icon on-secondary-container on the pill and
  **filled** (`'FILL' 1` on `--tb-spring-fast-effects`, 0.17.2); navigation icons are 24 px;
  inactive labels on-surface-variant, Label Medium. The expanded rail (280 px) keeps on-secondary-container and
  Label Large for its horizontal items.
- **Top bar** (sticky, no divider below it): from medium the **top strip** — 80 px (*ours*, spec §3.2), the
  global search (teacher only, below) in the middle, the bell and the avatar at the trailing end (no portal name: it is at the top of the rail); on compact the **M3
  small top app bar** — 64 dp, ☰ (leading button, «Разделы», `aria-haspopup="dialog"`), the title of the section
  in Title Large on one line (the destination whose link leads the address; reverses 0.9.2, which hid it), bell,
  avatar. The title is not a heading: the page's one h1 stays in `tb-page-header`. User button — the avatar alone
  (40 px circle, a photo or the person icon) at every size, named «<name>: меню пользователя». User menu:
  «Мой аккаунт», theme, language, sign out. No cabinet name.
- **Global search** (`core/search/global-search-view.ts`, 248, teacher only; sources in `search-sources.ts`, the
  frontend over loaded lists, spec §2 D6): in the top strip the **M3 docked search bar** (56 px filled pill, as
  `tb-search-field`, with the hint chip «Ctrl K» / «⌘ K») and under it the **search view** — a `surface-container`
  dropdown, 28 px corners (*ours*), results in groups «Ученики · Группы · Задания · Доски · Учебники» (up to 5
  each, «Ещё N»), states: hint, loading, no results, group failed. ARIA combobox + listbox (`aria-activedescendant`);
  ↑ ↓ move, Enter opens, Esc closes. **Ctrl K / ⌘ K** (`shell.ts`) focuses the bar. **Compact:** the top app
  bar's search icon (`aria-haspopup="dialog"`) opens a **full-screen search view** with «back»; the focus returns
  to the icon on close.
- **Cards on the phone:** 16 px at the sides (M3 compact), 12 px around a list or a table, so the titles of
  all cards line up.
- **One column inside a pane** (ADR-0021, refined by ADR-0048): panes replace multi-column pages only from
  expanded, and keep the fixes of ADR-0021 — a pane is never narrower than 360 dp and below expanded there is
  one pane; lists keep the subgrid of `tb-list`, so row buttons line up within a pane; running text (task
  statements, answers, help) is at most 66 ch. Inside a pane cards are stacked (`tb-stack`), ordered by
  importance (what needs action first); no card grids, except the feed layouts the redesign spec names (Today,
  Materials, the student's home, admin status) once they ship, with a fixed column order that is also the
  reading order. A page without panes is one column of cards. Every page full width (0.9.2: settings and «Мой аккаунт» too); a form keeps a
  readable width inside its card (`tb-form--narrow`); «Мой аккаунт» puts its forms in cards side by side — they
  take the card's width (0.15.1). Columns only inside one row of data
  (name — value, table columns, row buttons, filter fields).
- **Foldable sections** `tb-fold-card` (not tabs): header is a button with chevron and a line of explanation;
  content loads on first open; open sections in the URL (`?open=`). No page uses them since 247.2: the
  settings of the teacher and of the administrator are list-detail (§ panes above) and the teacher's
  notifications are in the bell's sheet (§8).

Student screens (0.27.0) reuse the teacher’s pane anatomy: schedule has a week/month calendar and a supporting
pane with mini-month, upcoming lessons and requests; compact starts with the shared day agenda. Payments
has tonal balance/charged/paid/price figures and a journal with operation filter chips, with receipts kept
in their rows. This role-specific composition is our product decision.

Administrator settings (0.27.0): an optional `[tbPaneHeader]` projects headings and save actions outside
the pane scroll area. Fields and category lists scroll independently on desktop; compact keeps page scrolling.
This persistent-header placement is our product decision.

### Compact cabinet refinements (0.31.0)

From M3: compact page margins are 16 dp; shape uses the existing M3 corner scale; panes and components
adapt to available space, with primary actions preceding secondary actions.

Portal decisions: both home briefings are hidden on compact; teacher today's lessons and weekly figures
remain in the feed. The compact roster omits its total. Homework search is always rendered and row tags
stack vertically. Teacher schedule screens use the same wrapping filter chips as the student; week/month
recreate the calendar to apply its initial view. Student calendar lessons open a bottom sheet only on compact,
and a centered `tb-dialog` on medium and wider screens, matching the teacher. Student upcoming lesson
actions keep Join above the connected request pair.
Compact schedule support sections are individually contained with large (16 dp) corners and normal margins.
The notification drawer has extra-large (28 dp) top corners, an 8 px top inset and 16 dp content margins,
with no shadow on compact;
its read-all action is in the header and unread titles replace dots. These compositions and inset choices
are ours, not additional M3 measurements.

## 5. Page anatomy

- **Header** `tb-page-header` (`@shared/ui`): «Назад» icon button on nested pages (tooltip = destination,
  e.g. «Все задания»); h1; «?» help if the section has an article; detail line (due date, status); actions on
  the title line (56 px), main one last (right). On the phone actions go under the title, equal width.
  **0.9.2:** on the phone a section page shows no title (visually hidden, kept for screen readers; the top app
  bar names the section since 231.2) and no «?» («Справка» is under ☰); the header keeps only details and
  actions, and takes no room without them.
  Nested pages keep «Назад» + title on one line.
- **Main action** — filled `tb-page-fab`, last header action (from 600 px only when «Создать» does not make it,
  232.2); on the phone an extended FAB (icon + label,
  primary-container, shadow), always visible. FAB only for create/record (student, lesson, task, payment);
  at most one per page.
- **FAB menu** `tb-fab-menu` (`@shared/ui`, M3 Expressive, 0.15.0): the home page's «Создать» on a phone (the
  items of the rail menu, 232.2). The FAB «+» (56 px, primary container) opens up to six pills over it (56 px high, full corners,
  primary container, Title Medium, icon 24 px, 24 px padding, 4 px apart, end-aligned, appearing one after another)
  and turns into the round «Закрыть» (primary). Motion (**M3E**): the FAB and the items have a state layer (hover 8 %,
  focus and pressed 10 %); pressed, the FAB's corner morphs from large to medium and it shrinks to 96 % on
  `--tb-spring-fast-spatial` (hover: elevation 4); the icon turns 90° on the swap; the list enters item by item
  (30 ms apart, *ours*) and leaves on an effects spring (`animate.leave`); the phone's `tb-page-fab` morphs the
  same way. Reduced motion: no animation. Esc, a tap outside, the focus leaving or an item close it; the focus
  goes to the first item and back to the FAB; ↓ ↑ Home End move between items. In the rail (`variant` `rail` /
  `extended`, 232.1) the list opens 8 px under the FAB, start-aligned, fixed over the page (*ours*), and the FAB
  keeps its shape with the close icon.
- **No wrapping cards in a pane** (0.24.1, sketches): inside `tb-pane` a `p-card` has no surface, corner or padding —
  the title of the section stands on the pane (Title Medium emphasized), the tonal rows or blocks (`tb-list`,
  `tb-figures`) lie under it, 12 px apart (*ours*), the list group's outer corner is 16 px. The one container left is
  the filled `tb-hero`. A page without panes (not redesigned yet) keeps its cards. **On a phone** (below 37.5em) a
  page of panes lies right on the window (sketches): the pane has no surface and no corners, the window and the top
  bar take `surface` (`SystemBars` paints the status bar the same way), the panes add no margin — the pane's own 16 px
  are the room at the sides; the bottom bar keeps `surface container`. Tabs on a phone keep the width of their label
  and scroll.
- **Key figures** `tb-figures` (Today: the month, the week): one tonal block (`--tb-list-item`, corner 16), two
  columns, each figure `tb-figure__label` — an overline (Label Small, upper case) over `tb-figure__value`
  (Headline Small); `tb-figure--wide` takes both columns (*ours*).
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
  buttons are under the event across its width, with Join above the connected request pair (0.31.0) and are hidden while the lesson
  runs (0.15.1: the student's card is laid out as the teacher's — no visible title, «Занятие» or the group, the
  topic and «Занятий на неделе» next to the tile). No «Расписание» link: the schedule is in the
  navigation. When the lesson ends the widget asks the home page to reload the summary. The teacher's card has no
  visible title (`h2.tb-sr-only` «Следующее занятие»): it is the first card and the tile says what it is.
- **Today** (teacher home, 0.24.0, spec §6; `features/home/teacher-home.ts`): one flexible pane (`tb-panes`);
  the page's title is the date («Понедельник, 19 октября»; the nav label is «Сегодня»);
  the header carries a muted summary line (lessons today · works to review · requests; empty parts left out). A feed
  of three stacks with a fixed order that is also the reading order: lead (hero + `today-lessons.ts` «Занятия сегодня»),
  queue (`todo-queue.ts` «Нужно сделать»), figures (`billing` month card + `week-figures.ts` «Неделя»). Columns by
  window size: extra-large 3 (1.25 : 1 : 0.8), large 2 (the figures go under the queue, the lead spans both rows),
  otherwise 1; the empty stack is hidden. On compact all sections remain in the same order (0.31.0),
  the briefing is hidden and «Создать» is the FAB.
  - 0.24.1: the sections have no cards (above). «Нужно сделать» carries an error badge with the count (M3 large
    badge); a row is a 40 px tonal icon circle (lesson, review, request; a debt — error container), what is to do
    in the first line and «who · detail» under it, the action a tonal button. The month block is titled with the
    month («Октябрь»): «Поступило» and «Долг» (plan and advances wait for the backend); the week is a 2 × 2 grid.
  - «Нужно сделать» is one `tb-list`: rows (icon, what is to do, who, action in place) from four sources —
    unmarked lessons («Проведено» / «Пропуск»), student requests («Ответить»), works to review («Проверить»), debts
    («Открыть»); at most 5 per source, the rest as «Ещё N». The first-run steps («С чего начать», progress bar,
    «Скрыть») sit at the end of the same card until done or hidden. Nothing to do — a compact empty state.
  - Compact (239.4, our decision): a row stays one line with a chevron as its whole-row action; a row with one
    action runs it, a row with two (unmarked lesson) opens a bottom sheet (`tbModalDrawer`, `tb-sheet`) with both
    as buttons.
  - «Занятия сегодня»: rows with the time (Label L, tabular figures), who and the status tag; the nearest unfinished
    lesson is the selected row (secondary container). «Неделя»: four name — value rows (held lessons, absences,
    homework given, handed in on time) for the current Monday–Sunday week.
- **Schedule** (teacher, 0.24.0, spec §7; `features/schedule/teacher/schedule-page.ts`): the calendar is the main
  pane (`FullCalendar`: week / month, toolbar with filter chips by owner and the time-zone chip «Часовой пояс
  портала»), the supporting pane beside it holds the mini-month (`ui/mini-month.ts`, M3 date picker, docked: weeks from
  Monday, a dot under a day with lessons, the shown day filled; *our decision:* no input — a click on a day only moves
  the calendar), «Запросы учеников» and «Нерабочее время». The unified lesson form offers Repeat: Once / every 1–4 weeks, optional end date, and Only this / This and following. Bulk actions disclose affected and protected existing occurrences before submission; completed, charged and individually changed lessons are preserved.
  Lesson states in the grid (`styles.scss`): planned — filled, held / missed — tonal, cancelled — struck through;
  **unmarked** past lesson — a 2 px solid `error` outline (`tb-lesson--unmarked`); **requested change** — a 2 px dashed
  `outline` (`tb-lesson--request`, 3:1 to the card; it was `warning` before); off time — hatched. A lesson is
  marked from its dialog; the «Отметьте прошедшие занятия» card stays on a phone only.
  - Compact (240.3, `ui/schedule-agenda.ts`): the screens «Повестка» / «Неделя» / «Месяц» (a connected button group; the
    «⋮» menu also leads to «Нерабочее время», a screen of its own with a back arrow); the agenda is a
    week strip (seven days, ‹ ›, today and the chosen day marked) over the day's list; a row is one line (time, who,
    status tag), unmarked lessons sit in a group under the row with «Проведено» / «Пропуск», a jump chip «Не отмечено
    занятий: N» leads to them.
- **Forms on a page** — buttons in `tb-form-actions` bottom right; full width on the phone.
- **Toolbar above a list** (`tb-toolbar`): search left, filters (labelled switch) and period right.
- **Search field** — always `tb-search-field` (`@shared/ui`, a form control; 0.15.0): the M3 docked search bar, 56 px,
  a filled pill without an outline (in focus too — the focus state layer), the magnifier and «×» «Очистить поиск» (while
  there is text; Esc clears) each centred in a round end (4 + 48 + 4), the text from 56 px; the browser's own clear
  button is hidden. The search takes the full available width of its pane or card; «×» never resizes it
  (0.28.0, our layout decision). Materials is an exception (0.30.0, ours): search, filter chips and sorting
  share a wrapping toolbar; the desktop search matches a large fixed-pane list search (364 px).
- **Assignment editor (0.29.0, variant 1)**: a main flexible pane for title, recipients/deadline,
  Markdown Text/Preview, textbooks/files and videos. A supporting sheet on the right holds the AI request,
  prompt library/search/save, source selection, generation/error/retry and draft Remove/Insert/Replace.
  From M3: supporting-pane canonical layout and adaptation at the shared breakpoints. Portal decisions:
  the AI pane shares the available width equally with the editor (0.30.0), appears beside it from expanded, and opens
  as a modal right drawer at compact/medium widths. A close action returns focus to the opener. Main
  content precedes AI in DOM/reading order. There is one Markdown Text/Preview field at every width.
  The header keeps Assign/Save (filled) and Assign/Save and place on board (tonal). The AI never changes
  authored text without Insert/Replace. Its editor-scoped state survives closing/adapting the pane.
  The unsaved guard and save-materials-before-notifying sequence remain in the editor.
  Control inventory: title; explicit student/group selections; due date (automatic next lesson, manual
  override/clear); Markdown Text/Preview and hint; textbooks (bind/pages/change/remove/open); new files
  (pick/remove); videos (URL/title, YouTube captions and language, transcript file/text, student visibility,
  add/remove); issue/save and issue/save-and-place-on-board; existing issued materials managed on the
  assignment page; AI request, prompt search/library/save/manage, sources from textbooks/files/video
  transcripts, generate/loading/error/retry, draft Remove/Insert/Replace; leave-with-changes confirmation.

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

- **Red means destruction only.** «Пропуск», «Вернуть на доработку», «Отменить занятие…»,
  «Отозвать запрос», «Вернуть как в .env» are neutral tonal or text: the status they produce
  (a tag, a message) shows the meaning. Filled red stays for the confirmation step only.
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
- **Connected button group** `tb-button-group--connected` (also `p-selectbutton` and the calendar
  views `tb-fc-segments`) — **toggles only** (choosing a value, view or sort; M3: never a connected
  group when no button can be toggled): 2 px gap (**M3** `ConnectedButtonGroupSmall`), inner corners
  8 px, outer full; unselected tonal, selected primary and fully round; no outline. Pressed, the
  outer corners square to 8 px as any button and the inner ones narrow to 4 px. Examples: «Итог»
  of a lesson, a member's attendance, the calendar views.
- **Standard button group** `tb-button-group` — actions side by side («Перенести», «Отменить»;
  «Проведено», «Пропуск» in the agenda): an invisible container with separate tonal buttons, 12 px
  gap (**M3**, Compose `ButtonGroupSmall.BetweenSpace`); a pressed button changes shape and width
  and its neighbours adjust for the moment. A dialog footer keeps 8 px (the dialog's own padding
  between buttons, §8). Never a primary button in a connected group: it reads as «already selected».
- **Split button** `tb-split` (e.g. «Начать урок» | «Открыть в браузере»): 2 px gap, inner corners 4 px (8 px
  while pressed — the size is ours, the outer corners stay round), trailing part 48 px with a 22 px chevron (M3E
  small); while its menu is open the trailing part is round and the chevron turns 180° on
  `--tb-spring-standard-fast-spatial` (M3: the standard scheme, no bounce). The arrow has no tooltip (0.15.0, the teacher's decision): only its
  `aria-label`; the empty host of the popup menu is out of the flow, so the group ends at the edge of its container.
- Icon buttons: tooltip = accessible name, with row context («Отменить занятие: Анна, 14:00»); help «?»
  includes the article («Справка: Портал»); menu buttons have `aria-haspopup` + `aria-expanded`
  (`tbAttributes`).

## 8. Dialogs, sheets, menus

0.31.2 portal decisions: student lesson details keep a 16 px gap between summary and actions, and
a 24 px bottom inset in the desktop dialog. Compact notifications use a transparent scrim; modal focus,
scroll locking and dismissal remain unchanged. Other modal surfaces retain the M3 scrim.

- **Modal side sheet** `tb-side-sheet` (the help, 0.15.0): a right drawer 1 rem from the window edges, 42 rem wide,
  large corners, surface container low, scrim 32 %; the header is «←» (only when there is a way back), the headline
  (Title Large) and «×». A link of a help article to another one opens it in the sheet («←» returns); other links
  close the sheet and open their page. On a phone — the whole screen, no corners.
- **Notifications sheet of the bell** (235.1, redesign spec §10.3): the bell (`core/notifications`) is a button
  that opens and closes `tb-notifications-sheet` (`aria-expanded`). On extra-large it is the **non-modal** M3
  standard side sheet, the third pane of the frame (≤ 400 dp, surface container low, 28 dp corners and 24 dp
  margins like `tb-pane kind="sheet"` — *ours*); it takes the focus when it opens, «×» or Esc closes it and gives
  the focus back, and it stays open across pages. Below it is the modal `tb-side-sheet tb-side-sheet--narrow`
  (400 dp; on compact full width with rounded top corners and no shadow — our decision, see §4),
  closed by a notification that leads to another page. Content: the
  teacher's M3 primary tabs «Входящие N» (badge ≤ 4 characters, **M3**) and «Отправленные»; the student has the
  inbox only. The header and tab bar stay fixed at every width; only the active tab's content scrolls inside
  the sheet (our layout decision). Primary tabs `tb-tabs` (**M3**, every tab bar, 0.24.1): no container, 48 dp, Title Small, the label primary when
  active, a 3 dp primary indicator with 3 dp rounded top corners as wide as the label (the `::after` of `tb-tab-label`,
  the span every tab wraps its label in), one 1 dp outline-variant divider under the whole bar; the tabs share the
  bar's width equally with the label centred (M3 fixed tabs). Anatomy, top to bottom: the header (headline «Уведомления»,
  «×» at the trailing end), the tabs, the tab's content — «Входящие»: the unread list (no dots since 0.31.0; unread titles emphasized), a tick on desktop,
  «Показать ещё»; «Прочитать все» is the icon button `done_all` in the header immediately before close.
  The folded «Прочитанные» follows the unread list (§9). The docked pane is `surface` like the other panes
  and starts below the top strip. «Отправленные»: a line of
  explanation with «Написать ученикам» (secondary, opens the same new-message dialog as «Создать › Сообщение»,
  §4) and the sent messages (title, text, time · recipients). The bell's badge (`p-overlaybadge`, danger) is the
  unread count, hidden at zero. `?notifications=inbox|sent` opens the sheet on any page and is dropped
  (`replaceUrl`); `/teacher/notifications` leads to `/teacher?notifications=inbox` (other parameters kept),
  `/cabinet/notifications` to `/cabinet?notifications=inbox`. The frame gets the feature's content through
  `NOTIFICATIONS_SHEET_CONTENT` (provided in `app.config.ts`), so core/ imports no feature. **There is no
  Notifications section** (235.2, ADR-0048): no «Уведомления» in the menus, no home card of the latest
  notifications. The student's messengers and «Что присылать в мессенджеры» are cards of «Мой аккаунт»
  (`/cabinet/account`: account, then «Мессенджеры», then the preferences, one `tb-stack`); the «connect»
  card on the student's home and the «connect» reminder lead there. The teacher's are in Settings ›
  «Мессенджеры» (§4).
- **One dialog model** (ADR-0050). The author picks the **kind** by content; the window width only
  changes the container. Content and markup are the same at every width. Everything goes through
  `<tb-dialog>` (`shared/ui/dialog`); no feature sets `p-dialog` attributes, widths or phone rules
  itself.

  | Kind | For | Compact (< 600 dp) | Medium and wider |
  |---|---|---|---|
  | `alert` | confirmations, one decision, ≤ 1 field (password, link, language) | basic dialog | basic dialog |
  | `form` | ≥ 2 fields, wizards, pickers | full-screen dialog | basic dialog |
  | `sheet` | an object and its actions (lesson, code, backups) | modal bottom sheet | basic dialog |

- **`<tb-dialog>` API** (`shared/ui/dialog`, 285.2): `kind` (required) picks the kind — `alert` for
  one decision or ≤ 1 field, `form` for ≥ 2 fields, `sheet` for an object with its actions;
  `width` `normal | wide`; `[(visible)]`, `headline`, `confirmLabel` / `confirmSeverity`,
  `cancelLabel` (default «Отмена», `null` = none), `pending`, `error`, `dirty`, `closable`;
  `formId` ties the confirm button to the `<form id>` in the content (Enter submits), without it `(confirm)`
  fires. Slots: `<ng-template tbDialogHeaderActions>` (✎, ⋮), `<ng-template tbDialogFooter>` (a
  custom footer, rare). `dialogSubmit({ visible, form, failed, request, done })` returns
  `pending`, `error`, `dirty` and `run()`: reset on open, `revealErrors`, one request at a time,
  close on success. `<tb-dialog-confirm-step>` is the inline question. *Our decisions:* an `alert` is
  32 rem wide (never over the 35 rem of a confirmation); the dirty-form question on compact is
  `Confirm.danger` over the full-screen form, the discard button is red.
- **Basic dialog** (**M3**): 280–560 dp wide, 28 dp corners, 24 dp padding on every side, 16 dp
  headline → body, 24 dp body → actions, 8 dp between buttons, surface container high (ADR-0044),
  scrim; buttons at the trailing edge, the confirming one closest to it; with scrolling content the
  headline and the buttons stay pinned. *Our decision:* width is a parameter, `normal` 32 rem or
  `wide` 40 rem (= 560 dp, the M3 maximum), `alert` ≤ 35 rem; never inline, never closer than 1 rem
  to the screen edge (M3: 56 dp for a custom position). `tb-dialog--short` and the phone rule
  `.p-dialog:not(…)` no longer exist.
- **Full-screen dialog** (`form` on **compact only**, **M3**): 0 dp corners, 56 dp header, 24 dp
  side padding, 8 dp between elements; «✕» first and the only navigation, then the headline, and
  the confirming text button at the end of the header with a clear verb («Создать», «Отправить»,
  not «Готово»), never disabled for invalid fields (§7). Field errors are inline. Closing a dirty
  form opens a basic dialog on top (below).
- **Bottom sheet** (`sheet` on **compact only**): modal `p-drawer` bottom, `tb-sheet`, the
  `tbModalDrawer` behaviour moved into `tb-dialog`; handle with a 48 dp target, 28 dp top corners,
  surface container low (**M3**), height by content up to 50 % of the screen and then scrolling
  (**M3**). *Our decision:* compact only (M3 allows medium too); no swipe — it closes by Esc and
  scrim, an action inside closes it, there is no «✕». Example: the upcoming lesson row on a phone is
  icon, time and details with a chevron (`tb-list__stretched` button) that opens the sheet; the
  teacher's «Отметьте прошедшие занятия» row the same way (on a computer the row has the text
  buttons «Проведено» and «Пропуск»).
- **Footer:** at most **two** actions — dismiss («Отмена», neutral text, §7) and confirm, the
  confirm one last. A dialog that only informs has one: «Закрыть». Extra and dangerous actions
  («Сбросить», «Удалить…», «Снять отметку») go to the «⋮» menu in the header
  (`tb-menu-item--danger`, `aria-haspopup` / `aria-expanded`); at most **one red button** in a
  footer — the confirmation of a dangerous action. Form dialog: `<form [id]>` in the body, submit
  with `type="submit" [attr.form]` (`tbSubmitFor`) so Enter submits; `dialogSubmit()` owns pending,
  error and reset on open.
- **Closing** (*our decision*): from medium `alert` and `form` have no «✕» — the exit is «Отмена»
  and Esc; `sheet` keeps «✕». The scrim closes `alert` and `sheet` and never a `form` (it protects
  typed data); stages that must not be interrupted (restart) set `[closable]="false"`.
- **Dirty form:** closing a `form` with changes asks «Отменить изменения?» (Esc = «Отмена»). On
  compact it is a real basic dialog over the full-screen one (the only case of a dialog over a
  dialog, **M3**); on medium and wider, and inside `alert` and `sheet`, it is the inline
  `<tb-dialog-confirm-step>` — text and its own two buttons instead of the footer.
- **Initial focus** (*our decision*): `form` — the first field (**M3**); `alert` and `sheet` — the
  headline (`tabindex="-1"`), so Enter never confirms a dangerous action. Focus returns to the
  opener on close.
- **Errors:** a server error of a `form` stands above the form (visible without scrolling; the
  dialog scrolls to it); in an `alert` — under the text; a failed action in a `sheet` — an error
  snackbar with «Повторить», not a block in the card.
- **Confirmations:** `Confirm` (`@shared/ui/confirm`) over the one `<p-confirmdialog>` in `app.ts`:
  `confirm.danger({ header, message, acceptLabel, icon? })` — filled red action; `confirm.safe(…)` —
  filled primary (since 0.17.0, not green); both return `Promise<boolean>` and get the neutral
  «Отмена», which cannot be overridden. It is the only way: features declare no
  `ConfirmationService` and no host. Inside a dialog use `<tb-dialog-confirm-step>`.
- **Single choice** (0.19.1, the caption language; also the target of a board, the series scope):
  a `tb-list` with `p-radiobutton` in the lead and a `label` covering the tile (the whole tile
  selects, hover state layer); the checked tile — secondary-container / on-secondary-container
  (*our decision: M3 publishes no role for a selected list tile; as our selected menu items*); the
  default option is checked, so the action is never disabled. A note the choice needs goes above the
  list. A choice of two with one verdict («Одобрить | Отклонить») is a single-select connected group
  (§7) and one submit button.
- **Lesson card** (`sheet`; one shared content component in `schedule/ui` for teacher and student):
  - header: the headline is who (student or group name); trailing ✎ (planned lessons only) and «⋮»;
    under it one status label if the lesson is not planned;
  - body: one segmented `tb-list`, a fact per row with an icon — `schedule` date · time (second
    line «перенесено с …»), `topic`, `videocam` room with a tonal «Подключиться», `dashboard` board
    chips, `event_busy` cancel reason; for a past one-student lesson the row `fact_check` «Итог»
    holds the toggle «Проведено | Пропуск» — **M3** connected group, single-select, selection
    optional (nothing is selected until marked; a press saves at once with `[loading]`, a press on
    the selected one clears the mark; an error is a snackbar and the choice returns);
    *our decision:*
    the width of a list row, icons `check` and `person_remove`;
  - a group lesson adds the subtitle «Участники» (Title Medium) and a `tb-list` of avatar, name and
    attendance label; a student's request is a tertiary-container list row (**M3**: tertiary for
    small items needing attention) with «Ответить»;
  - footer, one state — one action: not started or one student past — none (Esc, scrim, «✕» from
    medium); group past — «Отметить посещаемость»; cancelled — «Восстановить»;
  - «⋮»: «Отменить занятие…» opens its own `form` (reason, «по инициативе ученика», «списать
    оплату», for a series the radio list «Только это / Это и следующие» with the count);
    «Удалить…» is `confirm.danger` with the same scope list; «Снять отметку» only for groups; an
    overlap on restore is `confirm.safe`. The student sees the same facts and their own actions
    («Подключиться», «Перенести | Отменить»), without ✎, «⋮» and marks.
- **Menus and dropdowns:** 16 px container, 4 px padding, elevation 2; items are tiles with 2 px gap — 4 px
  corners, 12 px on the outer side of the first and the last item and on the selected one; *our decision, not M3:*
  items next to a separator get the outer 12 px too, so each group between dividers reads as one segment, as our
  lists do — the divider stays, as M3 separates menu groups on the web (dropdown lists —
  global rules in `styles.scss`, the select's own style would override the preset), hover 8 %; selected item — secondary-container / on-secondary-container, as M3 menus have it, with a check at its end (the theme and the language: `menuitemradio` + `aria-checked`, no «(выбрана)» since 0.15.0); destructive item red.

## 9. Lists and tables

- **Scrollbars** (0.24.1, *ours* — M3 publishes none): a pane is a clipped, rounded shell (`overflow: clip`) with the
  scrolling area `tb-pane__scroll` inside it, so the scrollbar never sticks out past a corner; the bar is thin, its
  track keeps 16 px from the corners and the thumb is a rounded outline-variant bar (dialogs and sheets the same,
  Firefox gets `scrollbar-width: thin`). Global search results (`.tb-search__panel`) use this same
  styling in docked and full-screen views (0.29.0); the full-screen results can shrink inside the fixed
  viewport and scroll below the search bar. Scrollbar geometry remains a portal decision.

- **Persistent pane headings** (0.28.0, ours): title, search and filters use `[tbPaneHeader]`; the common
  `.tb-pane__scroll` owns the scrollbar. The header keeps a fixed 16 px bottom gap (our decision),
  so scrolled rows never touch its controls; trailing heading margins are trimmed. No nested scroll list.
  Embedded detail components use
  `<ng-template tbPaneHeader>` (`PaneHeader`), which registers the template with the enclosing `Pane` and
  unregisters it on destruction. Without a pane, the heading renders in place. Compact layouts retain the
  window's scroll. Billing keeps the month, figures and journal filters above the scrolling operations.
- **Notifications width** (0.28.0, ours): the docked bell panel has an explicit 25 rem inline size,
  matching the medium drawer; its content never resizes the shell.
- **List interaction** (0.28.0): only rows that open/select as a whole have a hover state layer
  (`tb-list__link`, `tb-list__stretched`, direct link/button or `tb-list__item--link`). Static rows have no
  hover; their individual controls retain their own states.
- **Student/group creation** (0.28.0): the student creation dialog offers «Ученик · Группа». The group
  choice opens the existing group form. The choice is the first child of `tb-form`, using its normal gap.
  There is no separate create-group button in the students header.
- **Monthly payment report** (0.28.0): one flexible pane, persistent title/back/month picker, tonal key
  figures and sections on the pane surface. Detailed report tables retain their labelled columns.

- **Every list of data inside a card or dialog is a segmented list** `ul.tb-list` (CSS subgrid: lead, text,
  trail columns shared by all rows, so buttons line up): tiles `--tb-list-item`, 2 px gap, inner corners 4 px,
  outer `--tb-list-outer` — nested in its container (§1: 4 px in a card on a computer and in dialogs, 8 px in a
  phone card, 16 px right on the page; a single tile has it on all corners), height ≥ 56 px, padding 12 / 16 px.
  - `tb-list__lead` — 40 px secondary-container circle: for people the component `tb-avatar`
    (`@shared/ui/avatar`: the student's photo cut to a circle, otherwise the initials; `size` for a bigger
    one, e.g. 96 px in the «Мой аккаунт» hero; 0.9.2: the teacher has a photo too), an icon for things;
    0.15.2: a list whose icon only decorates (tasks, boards, textbooks, calls, notifications, requests, lessons
    of the student, recurring lessons and days off, payments, AI requests and prompts) takes `tb-list--no-phone-lead`:
    on the phone (< 37.5em) the icon goes and the text starts at the tile's edge; lists of people keep avatars;
    0.15.3: notifications (the home card and the inbox) have no icon at all — `tb-list--no-lead`; on the phone an
    unread one is marked read by a swipe sideways (`tbSwipe`, `@shared/ui/swipe`: follows the finger and fades,
    ≥ 30 % of the width marks it, otherwise it comes back; vertical moves stay the scroll); 0.15.4: on the phone
    such a row has no tick (the teacher's choice) — opening it and «Прочитать все» read it too;
  - `tb-list__text` — `tb-list__title` (Body Large) + `tb-list__supporting` (Body Medium, on-surface-variant);
  - `tb-list__trail` — amount (Title Medium), status or ≤ 3 actions.
  - On the phone (list < 26 rem) row buttons go under the text, full tile width, from the left;
    `tb-list__trail--icons` keeps a status and icon buttons on the right.
  - Students and groups (237.2, redesign spec §8) — **one** `tb-list` in the fixed pane of a list-detail
    (`/teacher/students[/:studentId]`, `/teacher/groups/:groupId` — one route, the page stays; «Ученики» in the
    rail and the bar is active on both, `NavItem.alsoActive`): the header «Ученики» + «N учеников · M групп»
    (current ones); the search; filter chips «Все · Группы · Должники N ·
    Без мессенджера N · Отключённые» (`tb-filter-chips`, below; «Отключённые» — students without access and
    archived groups, they replace the old toggles). From expanded the header, the search and the chips stay and
    only the list scrolls (*ours*); on one pane the window scrolls. Students by name, then groups (group icon in the lead).
    Row: avatar / icon; the name is the row's link (`tb-list__link`) to the card; supporting «nearest lesson ·
    аванс N» (a group: its members · nearest lesson; «нет занятий» when the schedule has none in 4 weeks;
    balances from the billing overview, messengers from notifications, lessons from schedule — a failed read
    only drops its part); trail — one status: the debt in `error` (Title Medium; read out «Долг N»), or else the tag
    «Приглашён» / «Отключён» / «В архиве» (none for an active student; the trail column is shared by the
    subgrid, one status keeps the text column wide in the 360/412 pane); no «⋮» in the row (237.2):
    the student card's access actions live on Profile beside password change; groups retain their header
    «⋮» menu. The row of the open card (from expanded) is `tb-list__item--current`:
    secondary-container, title weight 500 (M3 selected list item), also over a student's colour. With
    nothing open beside the list — «Выберите ученика или группу».
  - Student's card (237.3, `identity/students/student-card.ts`) — header: the 72 px avatar in the student's
    colour (label container, *ours*), the name (h2, Headline Small; on one pane the page header carries it and
    no overflow menu), «с сентября 2025» (Body Medium, on-surface-variant), tags — the status (not for an active student),
    the messengers or «Без мессенджера» (warn), «Аванс N» (success) / «Долг N» (danger); actions — tonal
    «Написать» (`tb-broadcast-dialog [to]`, one recipient, no picker) and «Оплата» (`tb-payment-dialog` with the
    student), filled «Занятие» (`tb-lesson-dialog [studentId]`: «with whom» fixed, the default topic and the
    length from the schedule settings); a deactivated student keeps only «Оплата». On compact the three
    are tonal, equal width across the card. Tabs `tb-tabs` named by `?tab=` (`card-tabs.ts`;
    Обзор, the default, is left out of the address). Обзор — cards one under another, each a part of its
    feature: «Ближайшие занятия» (3 of 60 days, «Ещё запланировано: N»), «Задания» (open ones, works to review
    first, then by the deadline; 5 + «Ещё открытых: N»), «Баланс» (the figure, the lesson price, the last 3
    counted operations), «Связь» (`tb-student-channels` — connected messengers, failed deliveries, «Напомнить»
    without one; `tb-room-link` — the external link with copy, the portal room, or no link). A payment or a
    lesson from the header reads the balance and the lessons again, and the list's balances too.
    Занятия, Задания, Оплаты (237.4) — the full lists, each a part of its feature: «Предстоящие» (nearest first)
    and «Прошедшие» (latest first) cards of `tb-student-lessons-tab` (half a year back and ahead, «Показать
    ранее» reads the year before; a past lesson's tag is its status, a group lesson the student attended or
    missed — the student's own attendance; cancelled rows are inactive); «Все задания» of `tb-student-tasks-tab`
    (open ones as on Обзор, then the accepted ones, the latest reviewed first, with the grade; 20 + «Показать
    ещё»); `tb-student-payments-tab` — four tonal metric tiles (balance, all-time charged, all-time paid,
    lesson price — read-only since 237.5), one horizontal row on wide screens and wrapping on compact, and
    the ledger card «История» (`tb-ledger-list`). The old page `/teacher/billing/students/:id` redirects to
    `/teacher/students/:id?tab=payments`; billing links to a student open that tab.
    Профиль (237.5, `tb-student-profile-tab`) — the student's data changed in place, cards one under another:
    «Данные ученика» (name *, e-mail, phone, note, default topic, colour — always editable fields, under them
    `tb-form-actions` with the tonal «Сохранить», off until a field differs from the saved profile, and the text
    «Отмена» shown only then, which brings the saved values back; a saved profile updates the list row),
    «Цена занятия» (`tb-student-price-card` of billing — the one place a student's price is changed, the same
    field + tonal «Сохранить»), «Видеовстреча» (`tb-room-panel`, a card since 237.6, every action saved at once) and «Вход в
    кабинет» (the read-only login, until when the issued link works, tonal «Новое приглашение» / «Сбросить
    пароль», with disable/reactivate access beside password change). *Our decision (M3 publishes no in-place edit pattern):* fields stay
    editable instead of a read view with a pencil, as the account's sections. The dialog «Новый ученик» asks only
    the name and the contacts; after it the card opens on Профиль with the invitation link over it.
    The header is one part for both cards (`tb-card-head`, `card-head.ts`: the avatar and the actions projected).
  - Group's card (237.6, `identity/groups/group-card.ts`) — the same header: a 72 px tile with the group icon in
    the group's colour (secondary container without one, *ours*), «3 участника · с сентября 2025», the tag «В
    архиве»; tonal «Написать» (`tb-broadcast-dialog [toGroup]` — the current members, no picker; hidden without
    them) and filled «Занятие» (`tb-lesson-dialog [groupId]`), «⋮» — «В архив…» / «Вернуть из архива»; an
    archived group has neither action. Tabs (`GROUP_TABS`): Обзор («Ближайшие занятия» of the group, «Связь»
    with the room link), Занятия (`tb-student-lessons-tab [of]="{groupId}"`), Задания (`tb-student-tasks-tab
    [members]` — the tasks of every member, the name first in the supporting line), Участники
    (`tb-group-members-tab`: members by name — avatar or initials in the student's colour, a link to the card,
    the status tag, an icon button «Убрать из группы: имя» saved at once; under the list a multiselect of the
    current students not in the group and the tonal «Добавить»), Профиль (`tb-group-profile-tab`: «Данные
    группы» — name *, default topic, colour with the same tonal «Сохранить» / «Отмена»; «Цена занятия» —
    `tb-student-price-card [groupId]`; «Видеовстреча» — `tb-room-panel`, not for an archived group). The
    dialog «Новая группа» asks only the name and the students («Создать»); after it the card opens on Профиль.
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
- Homework of the teacher (0.25.0, spec §9; `features/homework/teacher/`) — three panes of one route
  (`/teacher/homework[/tasks/:taskId | /:assignmentId]`): the **list** in the fixed pane (the connected group
  «На проверку · Активные · Готовые» with counts, search is always visible above the list (0.31.0); tonal rows, no
  cards: a work — avatar, student, «задание · сдано …», the «Просрочено» tag; «Ждут сдачи» under them), the **work or
  the assignment** in the flexible pane (blocks on the pane's surface under uppercase labels; the chosen row is
  `tb-list__item--current`), and from **extra-large** the **review side sheet** as the third pane (`review-sheet.ts`,
  standard side sheet ≤ 400 dp: the AI draft with the tertiary tag «Черновик ИИ» and «Вставить», the comment, the
  quick phrases as chips, «На доработку» tonal + «Принять» filled, «Дальше: <student>»); the rail collapses to
  96 dp on this route (`RailState`). On medium and compact the route shows the list or the detail (back arrow); the
  review form sits under the answer on medium.
  - **Floating toolbar** (compact, **M3** floating toolbar; the sizes are *ours*): a pill of surface container high,
    64 dp high, 16 dp from the screen edges (plus the safe area), elevation 2, above the content; it holds the AI
    button, the comment button, «На доработку» and «Принять». The comment, the draft, the quick phrases and the grade
    live in a bottom sheet opened by the comment button; the bottom navigation bar is hidden on this screen
    (`RailState.bottomBarHidden`) so the toolbar takes its place. The toolbar replaces a bottom bar, never sits over
    one.
- AI requests (0.14.7) — the teacher's «Последние запросы» is a `tb-list` of cards, not a table: feature icon
  (`pi-file-edit` / `pi-check-square`); feature + status `p-tag`; «dd.MM.yyyy HH:mm · model · N с», the error under it
  (`tb-negative`); trail `--amount` — tokens; 10 rows, then «Показать ещё».
- Payments of the teacher (0.25.0, spec §10.2; `features/billing/teacher/billing-overview-page.ts`) — the flexible
  pane and a supporting pane «По ученикам» (`tb-panes`; the supporting pane only from medium). Header: the month
  title with the ‹ › icon buttons and the tonal «Отчёт за месяц» (`monthly-report-page.ts` stays a nested route).
  **Figures** — `tb-ops-figures`, four tonal tiles on the pane's surface: «Поступило», «Начислено за занятия»,
  «Долг» (error container, `--debt`), «Авансы»; a note under each («11 оплат», «1 ученик»). **«Операции»** — the
  title on the surface, the connected button group `tb-filter-chips` «Все · Оплаты · Занятия · Пропуски» and the
  «Ученик» select (`p-select`, overlay appended to `body` so the pane does not clip it); the journal is a
  `tb-list` of tonal rows (first/last radius 16, middle 4, no card):
  kind icon, student avatar, «Занятие · Анна Смирнова» + «date, time · status», the amount in the trail (`+` payment
  in `tb-positive`, `−` charge, `0 ₽` absence without a charge). The student's name links to the Payments tab of the
  card (`PAYMENTS_TAB`). **Supporting pane** — «Должники» (the debt in `tb-negative`, the tonal «Напомнить»),
  «Авансы заканчиваются» (≤ 2 lessons left — ours; 5 rows), «По неделям» (bars, the week of today lighter) and the
  link «Все в Учениках». The balances list and the default price are not on the page any more (Students ›
  «Должники»; Settings › «Оплаты»).
  - **Compact (0.31.0):** the page itself shows the month, both arrows and an absolute route to
    «Отчёт за месяц», with no overflow menu; month controls and the report link wrap within the pane.
    Teacher and student figures use the same two-column
    tonal grid without horizontal scrolling, and filter chips wrap. Journal supporting text wraps
    inside the row. The supporting pane and student filter stay hidden; the extended FAB records payments.
    The report month picker fits the available width and appends its overlay to body so pane clipping cannot
    hide it. Figure amounts wrap inside their tiles. These are portal decisions.
- Billing of a student (0.9.3) — the history on the Payments tab of the card (`tb-ledger-list`: calendar / wallet
  icon; operation + status tag; «date · topic or comment»; trail — the amount and «×» for the teacher; 20 rows,
  then «Показать ещё»).
  `tb-list__trail--amount`: on the phone the amount (`tb-list__amount`) goes under the text and the icon
  button stays on the right, so the name keeps its width.
- **Materials** (245.2–245.3, spec §10.1): the teacher's «Материалы» (`/teacher/materials?tab=boards|textbooks`,
  `features/materials`) is one flexible pane on the pane surface — no card around the content: the title, the
  connected button group `tb-segment-group` «Доски N · Учебники N» (on compact under the title),
  `tb-search-field` in the same wrapping toolbar as `tb-filter-chips` («Все · На портале · Внешние · Ученик или группа»;
  for textbooks «Все · Учебники · Рабочие тетради · Другое · Ученик или группа») and the sort menu
  «Сначала изменённые / По названию / Сначала новые» (0.30.0, our layout decision; search 364 px on desktop,
  full width on compact), then the
  feed `tb-material-grid` (`styles.scss`: 2 shrinkable columns on compact, auto-fill from medium with
  192–240 px tracks that can shrink to the available pane width; 12 px between cards on a phone, 16 px wider).
  **Portal sizing decision (0.29.0, not prescribed by M3):** cards cap at 240 px (15 rem), including sparse
  and single-card lists; auto-fill retains empty tracks. Previously a 1440 px viewport gave a 306 × 259 px
  card; the new maximum is 240 × 218 px (about 22% narrower and 16% shorter). Preview aspect stays 8:5,
  caption typography and action targets keep their sizes; compact cards still shrink to fit two columns.
  A card is `tb-material-card` (`@shared/ui`): corner 20 (`--tb-shape-lg-plus`),
  `surface container low`, the preview on top (a board's PNG exported by the editor on save, a textbook's cover — the first page of a PDF, an image itself, none for a Word file (245.1): `tb-blob-image` fetches it with the
  HTTP client as a blob; the icon of the kind while there is none), a tonal tile with the icon and the tag of the
  service («Холст», «Miro») for an external board, the title (`title medium`) and «кому · дата» under the preview,
  «⋮» at the end. The title link is stretched over the whole card, «⋮» stays above it. «Ученик или группа» shows a
  `p-select` of students and groups and keeps the choice in `?student=` / `?group=` (as the old boards page did);
  the rail's «Создать» leads to `?tab=…&create=board|textbook`. The old `/teacher/boards` and `/teacher/textbooks`
  redirect to the tabs with their query. *Isolation decision (frontend rule, AGENTS.md §4.2.6):* the page lives in its
  own feature `features/materials` and only composes two parts that belong to their modules —
  `BoardsFeed` (`@features/boards/parts`) and `TextbooksFeed` (`@features/textbooks/parts`): each owns its API, cards,
  «⋮» menu and dialogs, and takes the search text, the filter, the sort, the member and the students/groups as inputs;
  a feature never imports another's internals. Both feeds stay mounted (the inactive one `hidden`), so both
  numbers of the group are known. The student's page (`/cabinet/materials`, `MyMaterialsPage`) is the same feed
  without the actions: `MyBoardsFeed` / `MyTextbooksFeed`, no «⋮» (`tb-material-card` shows it only when it has an
  actions label), no member select, no create; chips «Все · На портале · Внешние» / by kind; `/cabinet/boards` and
  `/cabinet/textbooks` redirect to the tabs; «Материалы» is the fourth destination of the bottom bar.
- **Admin** (247.1–247.2, spec §5, §10.5):
  - Shell (`admin-layout.ts`, `ADMIN_MENU`): five destinations — «Состояние», «Журнал», «Интеграции», «Копии»,
    «Настройки» — in the rail and all in the bottom bar; «Справка» at the bottom of the rail. `/admin` leads to
    «Состояние»; `/admin/events` redirects to the journal's chip «События» (`?view=events`) and
    `/admin/diagnostics` to «Состояние».
  - «Состояние» (`status-page.ts`): a feed of status tiles in `tb-panes`, a fixed column order that is also the
    reading order — services, event queue, diagnostics | system, resources, last backup, portal address; from
    expanded two columns, below one. The header line is «Версия … · работает …»; «Собрать диагностику» (the
    archive for the developer) is a header action; the diagnostics tile says what is in it. The event queue tile counts pending events and
    failed deliveries and links «Разобрать в журнале».
  - «Журнал» (`journal-page.ts`): filter chips «Логи · События · Ошибки» (`?view=`), «Ещё фильтры» for period
    and level. «Логи» and «Ошибки» are list-detail: entries in the fixed pane, the chosen one beside it (message,
    request code, stack trace); with nothing open the detail pane holds the temporary log levels. On compact the
    detail has «К списку». «События» is a wide page (the internal events, resubmit of stuck ones).
  - «Интеграции» and «Настройки» (`/admin/integrations[/:section]`, `/admin/settings[/:section]`): list-detail
    like the teacher's Settings, the sections in `tb-pane-nav` (`shared/ui/pane-nav.ts`: two-line items with an
    icon in a tonal circle and a count badge for unsaved changes; the chosen one in secondary container). Integrations:
    «Проверка связи» and «ИИ-помощник»; the settings are grouped by the sections of the catalog and saved together
    («Сохранить и перезапустить»). The old `?open=<section>` of the settings redirects to the section. «Копии» is the
    teacher's backups card in a pane (one component, D4).
- **Student cabinet** (246.1–246.3, spec §5, §9, §10.4):
  - Shell (`student-layout.ts`, `studentMenu()`): the rail and the bar hold the five destinations; the inbox is in
    the bell, the account, messengers and preferences in «Мой аккаунт», «Справка» at the bottom of the rail. The
    count of open tasks (assigned or returned, `OpenTasks`, re-read after each navigation) is an **M3 large badge**
    (`tb-nav-badge`, error / on-error, 16 dp pill, «999+» at most) on «Задания»: by the label in the expanded rail,
    on the icon's corner in the collapsed rail and the bar; a screen-reader line «Заданий к сдаче: N» is next to it.
  - Home (`student-home.ts`, spec §10.4): a feed in `tb-panes`, the header «Привет, <имя>» with the line «Следующее
    занятие … · Заданий к сдаче: N». From expanded two columns (1.8fr / 1fr, *ours*), below it one column in
    the same order. Lead column: the nearest lesson (hero), «Сдать» (`tb-my-deadlines-widget`: open tasks as
    tonal rows, nearest deadline first, «Открыть», or tonal «Исправить» for a returned one), «Проверено недавно»
    (the last 3 reviewed tasks, status chip), then the welcome and «connect messenger» cards. Side column:
    «Оплачено N занятий» (`tb-my-balance-widget`: Display Small number = balance ÷ lesson price, the balance, a
    4 dp bar full at 8 lessons (*ours*) over a tonal block; a debt or no price — the balance alone) and the
    lesson materials (one board card and one textbook card, hidden when there are none). No FAB.
  - Homework (`my-homework-page.ts` + `my-task-page.ts`, spec §9): a list-detail like the teacher's, one route
    for `/cabinet/homework` and `/cabinet/homework/:taskId` (the list stays). Fixed list pane: the connected group
    «Сдать · На проверке · Готовые» with counts (the first non-empty one is chosen), search is always visible above the list (0.31.0), `tb-list` rows (icon, title link, «до …» — red when overdue, status tag), the
    current row in secondary-container; beside the detail only the list scrolls. Detail pane: the task with the
    teacher's feedback and the answer form; on one pane «back» in its header leads to the list.
- Boards of the teacher (0.9.3) — a `tb-list` like the students: kind icon; title link + «вид · кому ·
  изменена»; trail — «⋮» only («Резервные копии», «Изменить», «Удалить…» red), one line on a phone. 0.15.3: two
  cards «Доски на портале» (Excalidraw) and «Внешние доски» (by link), each with its own search inside, as the
  assignments (0.15.4; `tb-search-field` «Поиск: <card>», only while the card has boards), the supporting line drops
  the kind; the student's «Мои доски» the same (a card without boards is hidden). A tap anywhere on a row opens
  the board: the title is a `tb-list__link` whose `::before` covers the row (`tb-list__item--link` for the hover,
  the focus ring on the row), the «⋮» stays above it.
- Days off of the teacher's schedule — trail «⋮» only («Изменить», «Удалить…» red).
  Lesson repetition is edited in the lesson dialog (0.29.0).
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
- **Filter chips** (`@shared/ui/filter-chips`, 237.2): a single-select set over a list (M3: an alternative to
  segmented buttons when viewing a list), `role="group"` with a name, each chip a `button` with
  `aria-pressed`. **M3:** 32 dp high, 8 dp corners, label large; unselected — 1 dp outline-variant,
  on-surface-variant; selected — secondary-container without the outline, a leading 18 dp check. *Ours:* the
  set wraps (no horizontal scroll), 8 dp gaps, a 48 dp target over each chip, a count after the label in label
  large emphasized when it is not zero.

- **Segment group** (`@shared/ui/segment-group`, 242.1): a single-select M3 Expressive connected button group over
  a list (`role="group"` with a name, buttons with `aria-pressed`, a count after the label). **M3:** 40 dp, 2 dp
  between buttons, inner corners 8 dp (pressed 4 dp), outer corners round; the chosen one `primary` and fully round,
  the others `secondary container`. *Ours:* the group takes the whole width, the buttons share it by their content.


Student home lesson material tiles (0.33.0, portal decision) use columns matching the material card
width (12–15 rem, capped by the available width) with the standard 12 px gap, rather than stretching
tracks around fixed-width cards. Compact layouts wrap without horizontal overflow.

## 10. Fields

- **M3 filled text field, 56 px, is the only field style** (ADR-0050): every control of a
  `.tb-field` in forms, dialogs, settings and profiles — native `input` and `textarea`
  (`pInputText`, `pTextarea`), `p-select`, `p-multiselect`, `p-datepicker`, `p-inputnumber`,
  `p-password`, `p-autocomplete` and the combined member field (`tb-member-picker`). The rules are the global
  `.tb-field` block of `styles.scss`; no feature picks the variant itself (**M3**: variants are
  never mixed in one area), and there is no outlined variant any more. Not `.tb-field`, so
  unchanged: the search bar (below), `p-selectbutton`, chips, checkboxes and the toolbar controls
  outside forms (the month picker of the monthly report, filters in a table header).
  Markup: a `label` first, then the control (or a `tb-copy-row` / `tb-inline` row whose first
  child is the control), then the optional supporting text:

  ```html
  <div class="tb-field">
    <label for="field-id">Label from the dictionary</label>
    <input pInputText id="field-id" formControlName="field" />
    <small class="tb-hint">Optional supporting text</small>
  </div>
  ```

  From [M3 guidelines](https://m3.material.io/components/text-fields/guidelines) and specs: 56 px
  height, container surface-container-highest, 4 px top corners and square bottom corners, 16 px
  horizontal padding. The empty, unfocused field shows its label in Body Large 16 px from the top;
  focused or populated, it is Body Small 8 px from the top (textareas too). The active indicator is
  1 px, 2 px primary on focus, drawn as an inset shadow of the control so nothing shifts. Error:
  label, indicator and caret in error, supporting text in error 4 px below the control; disabled:
  container 4 % and content, label and indicator 38 % on-surface. Hover is the 8 % state layer.
  *Our decisions (not in M3):*
  - the indicator is on-surface (M3 says on-surface-variant, too weak on a dialog);
  - the placeholder shows only while the label is small (focus), never over the resting label;
  - "populated" is read from the PrimeNG state classes (`p-filled`, `p-inputwrapper-filled`, a
    select label that is not `p-placeholder`), so a field needs no `placeholder=" "`;
  - a native control shows the error icon (24 px, end of the field) when `aria-invalid` or
    `p-invalid` is set; a composite control keeps its arrow as the trailing icon and shows the error
    by colour and text only;
  - the label of a textarea gets the container fill, so scrolled text never runs under it;
  - the PrimeNG form tokens of these controls (border, shadow, fill) are overridden on `.tb-field`
    with the field's own variables; PrimeNG's global `inputVariant: 'filled'` is not used, it would
    also turn the search and toolbar controls filled;
  - contrast: the container sits on a dialog (high), a card (lowest / container) or a pane (surface
    / container low); the fill differs only by 1.05–1.4:1, so the field is told apart by the
    indicator (on-surface, 11–17:1 against the surface in both themes). Nothing beyond the M3 roles
    was needed.
  Keep `tbFieldErrors` on the form; it supplies validation and ARIA state and replaces hints with
  error text.
- The label is first in `.tb-field` (or a `tb-copy-row` / `tb-inline` row with the field first) and
  sits inside the container. A field with its own header (`tb-field__header`) keeps the label
  above. Every field has a visible label (filters too). Label cutouts of the former outlined variant
  and `--tb-field-surface` for them are gone.
- Required fields: `*` after the label + `aria-required` (`tb-field--required`); optional ones unmarked.
- Combined member field (0.29.0): `identity/parts` exports `tb-member-picker`, a grouped
  PrimeNG MultiSelect with one search, Students/Groups sections, removable typed chips and clearing.
  From M3: checkboxes for multiple related choices and input chips for selected entities. Portal decisions:
  grouping both entity types in one dropdown, prefixing chip labels with the type and accepting an optional
  selection limit. Callers wrap it in `.tb-field` with a label targeting its required `inputId` and use a
  reactive form control; its label sits inside the filled container like native controls.
  `tbFieldErrors` supplies the standard required/error semantics. Optional option
  details distinguish namesakes. Unavailable options cannot be newly selected; prefilled unavailable or
  missing IDs stay visible (missing names fall back to IDs) and removable. The field stores explicit
  `{ kind, id }` choices; each caller owns grant semantics or group-to-student snapshot resolution. Homework and broadcast
  use `memberRecipients` to deduplicate snapshots against available students, keeping explicit choices
  independent from groups. An empty group selection never turns into a broadcast to everyone.
- Boards and textbooks use this combined field for material grants, retaining typed student/group IDs
  and dynamic group access. The rail Create Board action retains the current Materials member filter.
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

- **Focus visibility** (0.28.0, ours): `KeyboardFocus` tracks keyboard/pointer input on the document.
  Focus rings appear only after keyboard interaction, including on autofocus and focus return. Pointer
  interaction hides rings; actual focus, input state, validation and elevation remain available.

- Keyboard focus ring: 3 px secondary, 2 px offset (fields: 2 px primary outline). In navigation the ring
  goes around the item and state layers lie over the active indicator, not instead of it.
  Custom controls (the search field's «×», calendar buttons) take the same ring; their hover is a state layer
  (`color-mix` with `--tb-state-*`), never `filter` or a literal opacity.
- Rail and bottom bar are `<nav>` with links, active `aria-current="page"`; the user menu —
  `aria-haspopup="menu"` + `aria-expanded`, ☰ — `aria-haspopup="dialog"` + `aria-expanded`; the user-menu name starts with the visible name.
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

- Portal appearance — source colour, scheme and named contrast, stored in `platform` settings and applied at
  start. Portal settings have three separate tonal cards: Identity (name and logo), Appearance (base and
  custom colour, nine scheme choices with colour samples, contrast), and Preview. From a container width
  of 48 em, Identity and Appearance stack in the left column and Preview spans both rows on the right;
  narrower containers stack the three cards. Colour-scheme help opens `teacher/appearance`. The draft preview follows the
  current selection; an explicit save applies it to the portal. Identity and Appearance use the standard
  `--tb-list-item` surface rather than surface-container-highest.
  This composition and surface choice are our decision.
- Base colours (`core/theme/appearance.ts`) — original indigo and screen approximations inspired by Pantone
  Colours of the Year: Classic Blue (2020), Very Peri (2022), Emerald (2013), Viva Magenta (2023), Peach Fuzz
  (2024), Mocha Mousse (2025), Illuminating (2021), Cloud Dancer (2026). These are portal screen colours, not
  exact Pantone reproductions or a popularity ranking. References: Pantone's
  [2022 selection](https://www.pantone.com/color-of-the-year-2022) and
  [2026 selection](https://www.pantone.com/na/en-us/color-of-the-year/2026).
- Custom colour — the PrimeNG picker opens as a popup from its colour swatch, appended to the document body
  so pane scrolling does not clip it. A labelled HEX input stays beside the swatch; MCU generates the scheme.
- Logo — PNG, JPEG, WebP or SVG ≤ 1 MB, stored in `platform` storage (backed up, removed by full reset),
  served without login at `/api/public/portal/logo`; SVG with `Content-Security-Policy: sandbox`. In the rail (the modal
  one under ☰ too) and its preview in settings it is cut to a circle (`object-fit: cover`); on the sign-in page it keeps its shape.
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
