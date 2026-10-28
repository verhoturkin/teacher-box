# Design system

The rules of the Teacher Box interface: Material 3 Expressive (M3E) on PrimeNG 21. This page says
**how** things look and behave everywhere; how each screen is composed of them is in
[`screens.md`](screens.md); **why** a rule was taken is in the ADRs (ADR-0015, 0017–0027, 0030,
0044–0046, 0048, 0050). If an ADR disagrees with this page, this page is right. A change to a rule
updates this page in the same commit; a new decision also gets an ADR. UI wording follows
[`glossary.md`](glossary.md); texts live in dictionaries (§14).

**Marks.** **M3** — a value or rule published by Material 3 / M3 Expressive (the `m3-expressive`
skill holds the references). *Ours* — a decision of the portal where M3 publishes nothing or where
we deviate; a deviation says so («*ours, against M3*»). Unmarked rules are project conventions.

**Where it lives:** preset `core/theme/teacher-box-preset.ts`, colour scheme
`core/theme/color-scheme.ts`, tokens and shared classes `src/styles.scss`, components `shared/ui/*`,
breakpoints `core/layout/mobile.ts`. No other UI kits (Angular Material, Material Web); no
primeicons. Minimum browsers: Chrome 119, Safari 17.2, Firefox 128 (`linear()`, `:has()`,
`color-mix()`); older ones get no springs.

**Checks.** `core/theme/design-rules.spec.ts` fails on Aura tokens, hex colours outside
`core/theme/` and `boards/`, `size="small"` and outlined buttons, and when the icon font and the
used icon classes disagree. E2E runs axe on the main screens and checks button rules (§13).

## Part A — Foundations

## 1. Tokens

- **Spacing** — 4 px grid, `--tb-space-N` = N × 4 px. Component styles take spacing only from
  tokens; preset tokens reference `--tb-*`; no literal values in component styles.
- **Shape** — radii only from this scale:

  | Token | px | Use |
  |---|---|---|
  | `--tb-shape-xs` | 4 | tooltips, inner corners of split buttons and list tiles, field top corners |
  | `--tb-shape-sm` | 8 | pressed button (**M3E** CornerSmall), chips, tags, inner corners of connected groups |
  | `--tb-shape-md` | 12 | selected toggle, menu items |
  | `--tb-shape-lg` | 16 | FAB, menus and dropdowns, outer corners of a list right on the page |
  | `--tb-shape-lg-plus` | 20 | cards |
  | `--tb-shape-xl` | 28 | dialogs, top of the bottom sheet, panes |
  | `--tb-shape-xl-plus` | 32 | login and invite card |
  | `--tb-shape-2xl` | 48 | loading indicator |
  | `--tb-shape-full` | — | buttons, search fields, navigation indicator |

  `--tb-shape-button` (20 px) is half a 40 px button.
- **Nested corners** (**M3** optical roundness, ADR-0044): a child inside a padded container takes
  `inner = outer − padding`, never below `--tb-shape-xs`, written as `max(xs, calc(outer −
  padding))` beside the padding. Lists, tile tables and figures set it through `--tb-list-outer`:
  right on the page 16 px (**M3** list CornerLarge); in a card on a computer 20 − 20 → 4 px; in a
  dialog 28 − 24 = 4 px; in a phone card 20 − 12 = 8 px; in a pane 28 − 24 = 4 px (compact
  28 − 16 = 12 px).
- **Elevation** — surfaces differ by tone, not shadow (**M3**). Shadows `--tb-elevation-1..3` only
  on floating elements: bottom sheet (1), FAB, menus, dropdowns, date picker, floating toolbars (2),
  dialogs (3).
- **State layers** — the content colour over the element: hover `--tb-state-hover` 8 %, focus and
  pressed 10 %; disabled — container 12 %, content 38 % (`--tb-state-disabled*`) (**M3**). Hover
  only on things that act (§10). Ripple is on. Custom controls use `color-mix` with `--tb-state-*`,
  never `filter` or a literal opacity.
- **Motion** — **M3E** springs, precomputed as `linear()` with a duration
  (`transition: border-radius var(--tb-spring-fast-spatial)`); curves are sampled until within
  0.001 of 1, never the cubic-bezier fallback.
  - Spatial (overshoot; position, size, shape): `--tb-spring-{fast,default,slow}-spatial`; effects
    (no overshoot; colour, opacity): `--tb-spring-{fast,default,slow}-effects` (**M3**).
  - `--tb-spring-standard-fast-spatial` (standard scheme, 0.9 / 1400, barely overshoots) only for
    turns that must not bounce (the split-button chevron) and for leaving overlays.
  - Overlays (`styles.scss` «Overlays on M3E springs») replace PrimeNG's cubic-bezier: they enter
    with scale or position on a spatial spring and opacity on the effects spring of the same speed —
    dialogs default (scale from 0.93), menus, dropdowns and the date picker fast (0.93), the
    snackbar fast (0.8), side sheets slide in on default spatial; they leave without a bounce on the
    standard fast spring and fast effects. *Ours* (M3 publishes no choreography): the bottom sheet
    sits on the bottom edge and would lift off it on an overshoot, so it enters on the standard
    fast spring too; the scrim fades on default effects (in) and fast effects (out); list items of a
    FAB menu enter 30 ms apart; a pane that appears after the page enters on default spatial, panes
    of a new page don't.
  - `prefers-reduced-motion: reduce` disables transitions and animations (the loading indicator
    stays a circle).
- **Frame sizes** in **px**, so a large font grows text, not frames: content up to
  `--tb-content-max` (1440 px); short pages (not found) `--tb-content-narrow` (56 rem); form fields
  `tb-form--narrow` (26 rem); top strip 80 px (compact top app bar 64 px), bottom bar 64 px, rail
  96 / 280 px.

## 2. Colour

- **Only roles `--p-md-*`** in styles. Never `--p-surface-N`, `--p-<colour>-N` palettes, Aura tokens
  (`--p-primary-color`, `--p-text-*`, `--p-content-*`, `--p-highlight-*`) or opacity for dimming:
  muted text is on-surface-variant; 38 % only for disabled controls.
- **Scheme from the portal colour** (seed, ADR-0034): a preset palette or a custom `#rrggbb` →
  shades 50–950 (PrimeNG primary palette, `updatePrimaryPalette`, `palette()`); shade 500 seeds the
  M3 dynamic scheme of `@material/material-color-utilities` — **Fidelity** (default), Tonal Spot,
  Vibrant, Expressive, Neutral, Monochrome, Content, Rainbow or Fruit Salad (MCU spec 2025 for
  Neutral, Tonal Spot, Vibrant, Expressive; spec 2021 for the rest). M3E component patterns do not
  require the Expressive colour variant. All roles of both themes and the neutral palette (tones
  99…10 as shades 0–950) come from it (`color-scheme.ts`) and are pushed via `updatePreset`; no
  `oklch(from …)` in CSS. Recomputed on load and when colour, scheme or contrast is saved. Contrast
  Reduced / Standard / Increased / Maximum = MCU −1 / 0 / 0.5 / 1; Standard is the default; numbers
  never appear in the UI.
- **Contrast is guaranteed by tone** (ADR-0023), also at Reduced, after MCU: primary, error,
  success, warning ≥ 4.5:1 against their on-colour, page, card and list tiles; secondary, tertiary,
  on-surface-variant ≥ 4.5:1 on every surface; every on-*-container ≥ 4.5:1 on its container;
  inverse-primary on inverse-surface. A role short of it is moved along its hue (`readable`). Text
  ≥ 4.5:1, outlines and focus rings ≥ 3:1. All preset palettes and sample colours are tested in
  both themes. The custom-colour check reports darkening and warns when primary is close to error
  (OKLab ΔE×100 < 12).
- **Custom roles:** success and warning are **M3** custom colours (`customColor`): Aura green 500 /
  amber 500 harmonized with the seed, tones 40 / 100 / 90 / 10 (dark 80 / 20 / 30 / 90). Error is
  the M3 error palette. No info role — info uses tertiary.
- **Status = severity = role.** The map status → severity lives in the module's `*-labels.ts`;
  tags, calendar and widgets take it from there:

  | Meaning | severity | Container |
  |---|---|---|
  | main state («Запланировано», «Выдано») | `primary` | primary-container |
  | neutral («В архиве», «Отключён», «Не отмечено») | `secondary` | secondary-container |
  | success («Проведено», «Принято», «Оплачено») | `success` | success-container |
  | waits for action / warning («Пропуск», «На проверке», «Ждёт ответа») | `warn` | warning-container |
  | error, debt, cancellation («На доработке», «Отменено учеником») | `danger` | error-container |
  | info, hint | `info` | tertiary-container |

- **Messages and badges:** `p-message` — role container, no border or shadow, Body Medium.
  `p-badge` — error by default, `warn`, calm counter `secondary`; a badge on an icon has no outline
  and sits inside the 40 px button, its start at the icon's middle, 4 px from the top (**M3**). The
  **M3** large badge (`tb-nav-badge`: error / on-error, 16 dp pill, «999+» at most) counts things to
  do on a navigation item.
- **Surfaces** (*ours* unless marked): window and navigation — surface-container; page content —
  `surface`, in panes (dark: panes surface-container-low); cards, menus, dropdowns —
  surface-container-lowest (light) / surface-container (dark), `--tb-card` in component styles; list
  tile `--tb-list-item` — surface-container (light) / surface-container-high (dark). **Dialogs**
  (**M3**, ADR-0044) — surface-container-high in both themes: inside a dialog `--tb-card` is the
  dialog's colour and list tiles are surface-container-lowest (`color-scheme.spec.ts`);
  surface-container-highest is used only by fields. The top bar keeps its tone when the page
  scrolls. Scrim 32 % in both themes.
- **Colours of students and groups** (`core/theme/label-colors.ts`): **M3** static colours — ten
  reference colours (Tailwind 500, red 600; hues about 30° apart), each giving `label-<c>`,
  `on-label-<c>`, `label-<c>-container`, `on-label-<c>-container` of both themes from its Fidelity
  scheme (2025 spec), plus its surface containers lowest / low / high and on-surface(-variant)
  (`--tb-label-surface-container-*`, `--tb-on-label-surface*`). *Ours:* not harmonized with the
  portal colour; on-roles moved along the hue to 4.5:1; containers at least ΔE×100 10 apart and the
  colour role 3:1 on list and dialog surfaces (`label-colors.spec.ts`). `data-tb-label="<c>"` (or
  `tb-label--<c>`) brings `--tb-label`, `--tb-on-label`, `--tb-label-container`,
  `--tb-on-label-container`. Teacher only, looked up by id (`TeacherColors`): avatars and group
  icons take the label container and its on-role, a photo keeps its image with a 2 px colour ring;
  chips of member multiselects take the container (`tbChipColors`); rows keep the neutral surface.
  Dialogs pick the colour in a select «Цвет» with a 20 px swatch («Без цвета» — an outlined empty
  circle). The calendar use is in [`screens.md`](screens.md#schedule-teacher).
- **System bars** (`core/theme/system-bars.ts`): `<meta name="theme-color">` and the manifest carry
  the top bar's colour — light surface-container, dark surface (on a phone page of panes:
  `surface`); the manifest's `background_color` is the page. The web cannot colour the Android
  navigation (gesture) bar apart, so the app is **edge-to-edge** (*ours*, stage 327.3):
  `viewport-fit=cover` lets Chrome 135+ on Android draw the page under the gesture bar (older
  versions and other browsers keep the inset at 0 and nothing changes); the bottom bar's
  surface-container fills that area. Everything fixed at the bottom adds
  `env(safe-area-inset-bottom)`, the shell adds the left and right insets (landscape cutout).
- **Themes:** «Светлая», «Тёмная», «Как в системе», stored on the device; a class on `<html>`.
  Chosen in «Мой аккаунт» → «Оформление» as a connected button group with `light_mode` /
  `dark_mode` / `brightness_auto`.

## 3. Typography

- Google Sans variable (400–700), bundled from `@fontsource-variable/google-sans` (no CDN);
  monospace `var(--tb-font-mono)`.
- Roles with the shorthand `font: var(--tb-type-<role>)` plus
  `letter-spacing: var(--tb-tracking-<role>)` (display, headline and title large have none; an
  emphasized role takes its baseline's tracking). Page text is Body Large. The scale has Display S
  (36/44) and Headline L (32/40) besides the roles below.
- Page title — Headline Medium emphasized (phone: Headline Small emphasized); card and pane section
  title — Title Large emphasized (on a pane Title Medium emphasized, §7); dialog title — Headline
  Small emphasized; subtitles — Title Medium; field labels, buttons, menu items, options — Label
  Large; tooltip, `small`, details — Body Small.
- **Emphasized roles** (**M3E**, ADR-0044) — `--tb-type-<role>-emphasized`: same size and line,
  heavier. Display S, Headline L/M/S, Title L — 500; Title M/S, Label L/M/S — Bold 700. Weights are
  400 and 500, and 700 only through those tokens (never a bare `font-weight: 600/700`). Emphasized
  marks the exception (titles, the hero time, the active navigation label, selected items).
- Wrap between words (`overflow-wrap: break-word`); `anywhere` only for codes, URLs, paths, env
  names and table cells. Empty-state titles have no trailing full stop.
- Dates, plurals and numbers — glossary (`CountPipe`, non-breaking space between number and unit).

## 4. Icons

Material Symbols Rounded (ADR-0046), weight 400, outlined (`'FILL' 0`); filled (`tb-i--filled`) only
for the active navigation item and checked states.

- **Markup:** `<i class="tb-i tb-i-<name>" aria-hidden="true"></i>`; `icon="tb-i tb-i-<name>"` on
  `p-button`; `icon="tb-i-<name>"` on `tb-empty-state`. The class names the symbol
  (`tb-i-calendar_month`) and is always written whole: `npm run icons` finds the classes in `src/`
  and builds the subset font `core/theme/symbols.woff2` with the map `core/theme/icons.scss`. In
  generated content — `@include icon-font; @include glyph('tb-i-<name>')`.
- **Sizes:** 24 px (lists, navigation, icon buttons — **M3**), 20 px in labelled buttons (**M3E**
  small), 18 px in chips; `--tb-icon-opsz` follows the size. Dark theme: grade −25, icons only.
- A glyph is a private code point with an empty alternative text: nothing shows before the font
  loads and screen readers skip it; the meaning is in the label or the tooltip.
- **PrimeNG's own icons** are SVG components: `npm run icons` also writes our symbols as masks
  (`core/theme/prime-icons.scss`, map `PRIME` in the script) and `styles.scss` masks the box —
  select `arrow_drop_down` / `_up`, «×» of dialogs, drawers, toasts and chips `close`, date picker
  `calendar_month`, `chevron_left` / `_right`, number steps and time `keyboard_arrow_up` / `_down`,
  checkbox `check` / `remove`, paginator `first_page` / `chevron_*` / `last_page`, sorting
  `unfold_more` / `arrow_upward` / `arrow_downward`, toast and message `info` / `warning` / `error`
  / `check`, busy `progress_activity`, filters `search`. 24 px; 20 in number steps, 18 in the
  checkbox and the sort mark. A new component showing another PrimeNG icon adds it to `PRIME`.
- **One meaning — one symbol:**

  | Meaning | Symbol |
  |---|---|
  | Home | `home` |
  | Schedule, lesson date | `calendar_month` |
  | New lesson | `calendar_add_on` |
  | Lesson request waiting | `event_upcoming` |
  | Time, deadline soon | `schedule` |
  | Repetition, retry, return for rework, re-invite | `replay` |
  | Off time; dark theme | `dark_mode` |
  | Homework, assignment | `assignment` |
  | Review | `rate_review` |
  | Textbook / workbook | `menu_book` / `stylus_note` |
  | Board | `co_present` |
  | External board, external link | `open_in_new` |
  | Open (go to the page) | `arrow_outward` |
  | Students / add a student / remove from the lesson | `group` / `person_add` / `person_remove` |
  | Me (user button without a photo) | `account_circle` |
  | Account | `badge` |
  | Calls, camera | `videocam` / `videocam_off` |
  | Microphone | `mic` / `mic_off` |
  | End the call / share the screen | `call_end` / `present_to_all` |
  | Full window / minimise the call | `open_in_full` / `close_fullscreen` |
  | Weak connection | `network_wifi_1_bar` |
  | Statistics, reports | `bar_chart` |
  | Billing / receipt | `account_balance_wallet` / `receipt_long` |
  | Notifications / inbox, nothing new | `notifications` / `inbox` |
  | Send, broadcast, Telegram | `send` |
  | VK, messengers, answers / MAX | `forum` / `chat` |
  | AI assistant / AI draft / prompt library | `auto_awesome` / `edit_document` / `bookmark` |
  | Settings / help / language | `settings` / `help` / `translate` |
  | Theme light / dark / system | `light_mode` / `dark_mode` / `brightness_auto` |
  | Palette | `palette` |
  | Photo / picture / PDF / other file | `photo_camera` / `image` / `picture_as_pdf` / `draft` |
  | Attach / upload / download | `attach_file` / `upload` / `download` |
  | Copy / link, connect Google | `content_copy` / `link` |
  | Backups, database | `database` |
  | Google Drive / upload to Drive | `cloud` / `cloud_upload` |
  | Restore, history | `history` |
  | Admin: status / log / events | `dns` / `list_alt` / `sync` |
  | Set in Docker / set in .env, locked | `deployed_code` / `lock` |
  | Archive / block | `inventory_2` / `block` |
  | Not found | `explore` |
  | Add / edit / delete | `add` / `edit` / `delete` |
  | Close, remove, unbind | `close` |
  | Cancel a lesson / stop following repeats | `cancel` / `stop_circle` |
  | Undo, withdraw / save | `undo` / `save` |
  | Done, chosen / accepted, completed | `check` / `check_circle` |
  | Not done yet (checklist) | `radio_button_unchecked` |
  | Error / warning | `error` / `warning` |
  | Search / filter / refresh | `search` / `filter_list` / `refresh` |
  | Sign in / out | `login` / `logout` |
  | Show / hide the password; preview as the student | `visibility` / `visibility_off` |
  | More: menu / navigation | `more_vert` / `more_horiz` |
  | Back / forward | `arrow_back` / `arrow_forward` |
  | Expand / collapse / go into | `expand_more` / `expand_less` / `chevron_right` |
  | Lesson outcome «Итог» | `fact_check` |
  | Busy | `progress_activity` + `tb-i--spin` |

## Part B — Frame and pages

## 5. Window sizes

**M3** breakpoints (600 / 840 / 1200 / 1600 px, ADR-0048) as em ranges, the same in CSS and
`mobile.ts` (`BREAKPOINT_QUERIES`, `injectWindowSize()`, `injectMobile()`), no gaps, no others:

| Window | Query | Navigation | Panes | «Создать» (teacher) |
|---|---|---|---|---|
| compact (phone) | `width < 37.5em` | bottom bar, ☰ → modal rail | 1 | extended FAB above the bar |
| medium | `37.5em <= width < 52.5em` | collapsed rail 96 px | 1 | FAB atop the rail |
| expanded | `52.5em <= width < 75em` | collapsed rail 96 px | 2: fixed 360 + flexible | FAB atop the rail |
| large | `75em <= width < 100em` | collapsed rail 96 px (*ours*) | 2: fixed 412 + flexible | FAB atop the rail |
| extra-large | `width >= 100em` | expanded rail 280 px | 2–3: 412 + flexible + sheet ≤ 400 | small extended FAB atop the rail |

- Below 30em height the top bar is not sticky. At 200 % font the layout moves to rail / phone
  without horizontal scroll.
- Narrow table cells next to the rail on medium and expanded (`37.5em <= width < 75em`); the main
  list column keeps 13rem from large.

## 6. Navigation

- **Regions** (**M3**): the window and the navigation (rail, top bar, bottom bar) are
  surface-container; page content lives on `surface` in panes. Region roles are the same at every
  width.
- **Rail** (`side-nav.ts`): brand · «Создать» (teacher) · destinations · spacer · bottom group
  (teacher «Настройки», everyone «Справка»). From medium it runs the full window height (sticky,
  `z-index` 1001 so the «Создать» list paints over the page); its brand stands in the row of the top
  strip, which starts where the rail ends (`--tb-rail-width`, *ours*).
  - Brand: the portal logo (`tb-portal-logo round`) and name, plain text, not a link (**M3**: a logo
    in the rail must not look like an action); expanded rail 28 px logo + name in Title Large
    emphasized, wrapping; collapsed rail the 40 px logo, name `tb-sr-only` (*ours*).
  - Collapsed item (**M3E**): 56×32 pill indicator, secondary-container, moving on
    `--tb-spring-fast-spatial`, label under the icon. Expanded item: the target spans the rail,
    the 56 px pill hugs icon + label (16 dp before and after, 8 dp between), items 56 px, 4 px gap,
    on-secondary-container, Label Large.
  - Active item (**M3E**): label in secondary and Label Medium emphasized, icon
    on-secondary-container and filled (`'FILL' 1` on `--tb-spring-fast-effects`); inactive labels
    on-surface-variant, Label Medium. Icons 24 px. Labels are never truncated: a larger font wraps
    them with hyphens.
- **«Создать»** (`core/layout/create-menu.ts`, ADR-0048): the teacher's one create action, under the
  brand (none for student and admin, none in the rail on compact). Small extended FAB in the
  expanded rail (56 px, corner large, 16/8/16, Title Medium), FAB 56 px in the collapsed rail
  (**M3**: collapsed rail → FAB, expanded → extended FAB); elevation 0 inside the rail,
  primary-container; 16 px to the destinations (*ours*). It opens `tb-fab-menu` (§7) with seven
  items — Занятие, Задание, Оплата, Ученик, Доска, Учебник, Сообщение — the current section's item
  first. *Ours, against M3:* seven items (M3: up to six — «Доска» and «Учебник» are two kinds of one
  section) and one global entry point on a rail (M3 keeps FAB menus off rails). An item opens
  `/teacher/<section>?create=<kind>`; the section opens its form via `openOnCreate()`
  (`core/routing/create-param.ts`) and drops the parameter with `replaceUrl`. «Сообщение» is a
  `button` item that opens the broadcast dialog over the current page (`NewMessageState`,
  `NEW_MESSAGE_DIALOG`, focus back on the FAB). From 600 px it is the screen's only FAB: a section
  renders its `tb-page-fab` only on compact. Actions «Создать» does not make keep their header
  button at every width.
- **Bottom bar** (compact, **M3E** flexible navigation bar): five destinations of the role
  (`BAR_ITEMS` in `shell.ts`, **M3**: 3–5), no «Ещё»; 64 px surface-container, no top border, item
  padding 4 px, 4 px icon → label; indicator and active item as the rail. Its background extends
  under the gesture bar: the content keeps 64 px, `padding-bottom: env(safe-area-inset-bottom)`
  grows the bar (*ours*, see «System bars»). The other destinations
  and the rail's bottom group are in the **modal expanded rail** under ☰ (**M3E**: more than five
  destinations): `p-drawer` + `tbModalDrawer` on the start edge, scrim 32 %, closed by Esc, the
  scrim, a destination or its `menu_open` button «Закрыть»; focus back to ☰; surface-container,
  elevation 2, 16 dp trailing corners (**M3E**), 280 px wide (*ours*; **M3** 220–360); items as
  wide as their label, ≥ 64 px (`minmax(64px, auto)`). Destinations per role:
  [`screens.md`](screens.md#frame-by-role).
- **Top bar** (sticky, no divider): from medium the **top strip** — 80 px (*ours*), the global
  search in the middle (teacher), the bell at the end; on compact the **M3 small top
  app bar** — 64 dp: ☰ («Разделы», `aria-haspopup="dialog"`), the section title in Title Large on
  one line (not a heading: the h1 stays in `tb-page-header`), search icon (teacher), bell. There
  is no user button (330.1): the account is a navigation item.
- **«Аккаунт»** — the last item of the rail's bottom group (after «Настройки», «Справка») and of
  the ☰ drawer, for every role: a 24 px `tb-avatar` (photo or initials) in place of the icon, the
  label «Аккаунт», accessible name «Аккаунт: <имя>» (starts with the visible label). It leads to
  `/teacher/settings/account`, `/cabinet/account` or `/admin/account`; active as any item
  (`NavItem.account`; `except` keeps the teacher's «Настройки» from lighting up with it). Theme,
  language and «Выйти» live in «Мой аккаунт» (section «Оформление», `tb-segment-group`).
- **Global search** (`core/search/global-search-view.ts`, teacher): in the top strip the **M3**
  docked search bar (as `tb-search-field`, §9, with the hint chip «Ctrl K» / «⌘ K») and under it the
  search view — a surface-container dropdown, 28 px corners (*ours*), results grouped «Ученики ·
  Группы · Задания · Доски · Учебники» (up to 5 each, «Ещё N»); states: hint, loading, no results,
  group failed. ARIA combobox + listbox (`aria-activedescendant`); ↑ ↓, Enter, Esc. **Ctrl K / ⌘ K**
  focuses the bar. Compact: the top bar's search icon opens a **full-screen search view** with
  «back»; focus returns to the icon.
- **Tabs** `tb-tabs` (**M3** primary fixed tabs, every tab bar): no container, 48 dp, Title Small,
  label primary when active, a 3 dp primary indicator with 3 dp rounded top corners as wide as the
  label (`::after` of `tb-tab-label`), one 1 dp outline-variant divider under the bar; tabs share
  the width equally (on a phone they keep their label width and scroll, unless the bar has the
  modifier `tb-tabs--fixed`: two or three short labels that share the width on every width, as
  the bell's «Входящие · Отправленные»). The tab is in the address
  (`?tab=`), the default one left out.

## 7. Panes and page anatomy

- **Panes** (`shared/ui/panes.ts`, **M3** canonical layouts): `tb-panes` holds `tb-pane`s of kind
  `fixed` (360 dp on expanded, 412 dp from large — **M3**), `flexible` (the rest, at least one) or
  `sheet` (standard side sheet ≤ 400 dp, surface-container-low — **M3**). A pane is a `surface`
  sheet with 28 dp corners on the window, 24 dp inner padding (16 on compact) (*ours*); 24 dp
  between panes, 24 dp at the trailing edge and bottom, 16 dp at the sides on compact (**M3**). From
  expanded panes stand side by side and each scrolls on its own; below they follow one another and
  the window scrolls. Focus order = template order = visual order; `label` makes a pane a named
  region. The shell drops its content padding for a page of panes.
- **List-detail:** `injectListDetail(() => routeHasDetail)` — from expanded both panes; on compact
  and medium the list or the detail by the route, the detail with «back» (`tb-page-header [back]`).
  `tb-panes medium="two"` with `injectListDetail(open, 'two')` keeps both panes on medium at 50 %
  (Settings only, *ours*).
- **Pane scrolling** (*ours*, **M3** publishes no scrollbars): a pane is a clipped rounded shell
  (`overflow: clip`) with `tb-pane__scroll` inside, so the bar never sticks out past a corner; the
  bar is thin, its track keeps 16 px from the corners, the thumb is a rounded outline-variant bar
  (Firefox `scrollbar-width: thin`); dialogs, sheets and the search results the same.
  **Persistent heading** `[tbPaneHeader]` / `<ng-template tbPaneHeader>` (`PaneHeader`, registers
  with the enclosing `Pane`): the title, search, filters and save actions stay above the scroll with
  a fixed 16 px gap; no nested scroll list; without a pane it renders in place; compact keeps the
  window's scroll.
- **Phone page of panes** (*ours*): the pane has no surface and corners, the window and the top bar
  take `surface` (`SystemBars` the same), the pane's own 16 px are the side room; the bottom bar
  keeps surface-container.
- **One column inside a pane** (ADR-0021, ADR-0048): a pane is never narrower than 360 dp; inside it
  sections are stacked (`tb-stack`) by importance (what needs action first); running text at most
  66 ch; no card grids except the feeds named in [`screens.md`](screens.md), with a fixed column
  order that is also the reading order. Columns only inside one row of data (name — value, table
  columns, row buttons, filter fields).
- **No wrapping cards in a pane** (*ours*): inside `tb-pane` a `p-card` has no surface, corner or
  padding — the section title stands on the pane (Title Medium emphasized), its rows or blocks
  (`tb-list`, `tb-figures`) lie under it, 12 px apart; the list group's outer corner is 16 px. The
  one container left is the filled `tb-hero`.
- **Header** `tb-page-header`: «Назад» icon button on nested pages (tooltip = destination); h1; «?»
  help if the section has an article; a detail line; actions on the title line (56 px), the main one
  last. On a phone a section page hides its title (kept for screen readers; the top bar names the
  section) and «?»; nested pages keep «Назад» + title on one line; actions go under it, equal width.
- **Sections** — a titled block (`p-card` h2, Title Large; Title Medium emphasized on a pane);
  section actions tonal in the title row (`tb-card-title__actions`). A section holding the page's
  only list gets a hidden `h2.tb-sr-only`. `tb-fold-card` exists but no page uses it.
- **Main action** — one per page: on compact the extended FAB `tb-page-fab` (icon + label,
  primary-container, shadow, always visible); from 600 px «Создать» or, when «Создать» does not make
  it, the last header action, filled. FAB only for create / record.
- **FAB menu** `tb-fab-menu` (**M3E**): the FAB «+» (56 px, primary-container) opens up to six pills
  (56 px, full corners, primary-container, Title Medium, 24 px icon, 24 px padding, 4 px apart,
  end-aligned) and turns into the round «Закрыть» (primary). Motion: state layers; pressed, the
  corner morphs large → medium and the FAB shrinks to 96 % on `--tb-spring-fast-spatial` (hover:
  elevation 4); the icon turns 90°; items enter one after another and leave on an effects spring.
  Esc, a tap outside, focus leaving or an item close it; focus goes to the first item and back; ↓ ↑
  Home End move. In the rail (`variant` `rail` / `extended`) the list opens 8 px under the FAB,
  start-aligned (*ours*).
- **Key figures** `tb-figures`: one tonal block (`--tb-list-item`, corner 16), two columns, each a
  `tb-figure__label` overline (Label Small, upper case) over `tb-figure__value` (Headline Small);
  `tb-figure--wide` spans both (*ours*). Name — value pairs: `tb-stats` / `tb-stat` (name left,
  number right, details below).
- **Hero** `tb-hero` — the filled primary-container card of the nearest lesson, the portal's one
  hero moment (*ours*); it carries only on-primary-container (links underlined). Layout:
  [`screens.md`](screens.md#nearest-lesson-hero).
- **Forms on a page** — buttons in `tb-form-actions` bottom right, full width on a phone; a form
  keeps a readable width (`tb-form--narrow`) unless it is a review or editor form.
- **Toolbar above a list** `tb-toolbar`: search first, filters and period after; it wraps.

## Part C — Components

## 8. Buttons

Variant = **weight**, colour = **one accent** (ADR-0045): filled is primary (the portal colour),
tonal is neutral secondary, red only destroys; green and amber are statuses, never buttons.
40 px pill (icon button 40×40, 48 px target), Label Large, 16 px sides, 20 px icon (**M3E** small);
icon buttons 24 px icon; shape morphs to 8 px while pressed. Never `outlined` (outline is for
inputs), `size="small"`, `success`, `warn`, `info`, `help`, `contrast`.

| Role | Variant | PrimeNG |
|---|---|---|
| Main page action / dialog confirm / login | filled primary | no severity |
| Secondary page or section action, section save | tonal | `severity="secondary"` |
| «Отмена», «Скрыть», «Понятно», labelled row action | text | `[text]="true"` (+ `severity="secondary"` for «Отмена») |
| Icon action (edit, link) | text, round, neutral, tooltip | `[text]="true" [rounded]="true" severity="secondary"` + `pTooltip` |
| Delete or unbind in a row (bin / «×», «Удалить» with a bin) | text red | `[text]="true" severity="danger"` |
| Confirm an irreversible action (in a dialog) | filled red | `severity="danger"` |

- **Red means destruction only.** «Пропуск», «Вернуть на доработку», «Отменить занятие…», «Отозвать
  запрос», «Вернуть как в .env» are tonal or text: the status they produce shows the meaning.
- **At most one filled button per page** outside dialogs — the FAB, or the page's main decision
  («Принять», «Сохранить и перезапустить», «Далее», «Войти»), always primary. «Подключиться» is
  tonal in rows, filled only in the hero.
- **«Отмена» means only "close without consequences"** — neutral text, never red. «Назад» is
  navigation. A window that only informs closes with «Закрыть».
- **Row actions:** at most three; labelled — text; icons — neutral round, red for delete.
- **Loading:** an action that sends a request shows `[loading]` (`shared/ui/busy.ts`); a submit is
  never disabled for invalid fields — only while the request runs. A button whose label changes
  («Отменить» / «Не приду») keeps its width (`tb-button-steady`).
- **Size M** `tb-button-m` (ADR-0045, **M3E** ButtonMedium): 56 px, full corners, 12 px pressed, 24
  px icon, 24 px sides, 8 px gap, Title Medium label (*ours*); split `tb-split--m` (trailing 56 px,
  26 px chevron, inner corners 4 px, 12 px pressed — *ours*). Only in the hero.
- **Connected button group** `tb-button-group--connected`, `p-selectbutton`, `tb-segment-group`, the
  calendar views `tb-fc-segments` — **toggles only** (a value, a view, a filter; **M3**: never when
  no button can be toggled): 40 dp, 2 dp gap (**M3** ConnectedButtonGroupSmall), inner corners 8 dp
  (4 dp pressed), outer full; unselected tonal (secondary-container), selected primary and fully
  round; no outline. `tb-segment-group` (`@shared/ui/segment-group`) is the list-view variant:
  `role="group"` with a name, `aria-pressed`, a count after the label, takes the whole width
  (*ours*). Examples: «Итог» of a lesson, a member's attendance, «На проверку · Активные · Готовые»,
  «Доски · Учебники», «Ученик · Группа», the calendar views, «Согласовать | Отклонить».
- **Standard button group** `tb-button-group` — actions side by side: an invisible container with
  separate buttons, 12 dp gap (**M3** ButtonGroupSmall.BetweenSpace); a pressed button morphs its
  shape; the neighbours' width change is not done (*ours*). Never a primary button in a connected
  group: it reads as «already selected». A dialog footer keeps its own 8 dp (§11).
- **Split button** `tb-split` («Начать урок» | «Открыть в браузере»): 2 px gap, inner corners 4 px
  (8 px pressed, *ours*), trailing part 48 px with a 22 px chevron (**M3E** small); while its menu
  is open the trailing part is round and the chevron turns 180° on the standard fast spring. The
  arrow has only an `aria-label`, no tooltip (*ours*).
- **Icon buttons:** tooltip = accessible name, with row context («Отменить занятие: Анна, 14:00»);
  help «?» names the article («Справка: Портал»); menu buttons have `aria-haspopup` +
  `aria-expanded` (`tbAttributes`).
- **Tooltip** = M3 plain tooltip: Inverse surface / Inverse on surface, Body Small, 4 dp corners,
  8 dp side padding, at least 24 dp high, no caret (**M3**). Placed centred **below** the element
  (M3: below in an app bar and on desktop) and flipped above by PrimeNG when there is no room,
  never to the side, kept inside the window (*ours*: one rule for the whole app). The default is
  set once in `@shared/ui/tooltip-defaults` (PrimeNG `Tooltip` has no global default; applied in
  `app.config.ts`), so `pTooltip` needs nothing extra. Max width 240 px (*ours*; M3 gives none).
  Shown on hover and focus, on a phone by long press.

## 9. Fields

- **M3 filled text field, 56 px, is the only field style** (ADR-0050) for every control of a
  `.tb-field`: native `input` / `textarea` (`pInputText`, `pTextarea`), `p-select`, `p-multiselect`,
  `p-datepicker`, `p-inputnumber`, `p-password`, `p-autocomplete`, `tb-member-picker`. The rules are
  the global `.tb-field` block of `styles.scss`; no feature picks a variant (**M3**: variants are
  never mixed in one area). Not `.tb-field`, so not filled: the search field, `p-selectbutton`,
  chips, checkboxes, toolbar controls outside forms.
- **Markup:** the `label` first, then the control (or a `tb-copy-row` / `tb-inline` row whose first
  child is the control), then the optional supporting text. Every field has a visible label (filters
  too); a field with its own header (`tb-field__header`) keeps the label above.

  ```html
  <div class="tb-field">
    <label for="field-id">Label from the dictionary</label>
    <input pInputText id="field-id" formControlName="field" />
    <small class="tb-hint">Optional supporting text</small>
  </div>
  ```

- **M3:** container surface-container-highest, 4 px top corners, square bottom, 16 px sides; empty
  and unfocused — the label in Body Large 16 px from the top; focused or populated — Body Small 8 px
  from the top (textareas too); active indicator 1 px, 2 px primary on focus; error — label,
  indicator and caret in error, supporting text in error 4 px below; disabled — container 4 %, the
  rest 38 % on-surface; hover 8 % state layer.
- *Ours:* the indicator is on-surface (M3: on-surface-variant, too weak on a dialog) and drawn as an
  inset shadow so nothing shifts; the fill differs from dialog, card or pane by only 1.05–1.4:1, so
  the indicator (11–17:1) tells the field apart; the placeholder shows only while the label is
  small; "populated" comes from PrimeNG state classes (`p-filled`, `p-inputwrapper-filled`, a select
  label that is not `p-placeholder`); a native control shows the 24 px error icon at its end when
  `aria-invalid` / `p-invalid`, a composite one keeps its arrow; a textarea's label has the fill, so
  scrolled text never runs under it; PrimeNG form tokens are overridden on `.tb-field`, the global
  `inputVariant: 'filled'` is not used (it would also fill search and toolbar controls).
- **Required:** `*` after the label + `aria-required` (`tb-field--required`); optional unmarked.
- **Errors:** `<form tbFieldErrors>` (`shared/ui/field-errors.ts`) shows the text under the field
  (Body Small, error, replacing the hint), sets `aria-invalid` / `aria-describedby`, maps server
  codes (`login.taken`) to their field; a submit with errors shows all and focuses the first.
- **Search field** `tb-search-field` (`@shared/ui`, a form control) — the **M3** docked search bar:
  56 px filled pill without outline (focus is the state layer), the magnifier and «×» «Очистить
  поиск» (while there is text; Esc clears) centred in round ends (4 + 48 + 4), text from 56 px; the
  browser's own clear button is hidden; it takes the full width of its pane or card and «×» never
  resizes it (*ours*). A dropdown filter is the same pill, 48 px, named «Поиск».
- **Date** — one field with a trailing calendar icon. **Password** — `tb-password-toggle`, a 40×40
  icon button inside the field, «Показать пароль» / «Скрыть пароль», `aria-pressed`.
- A 40 px button next to a 56 px field is centred on it (`tb-copy-row`).
- **Textarea** resizes only vertically and never wider than its field.
- **Member field** `tb-member-picker` (`identity/parts`): a grouped multiselect with one search,
  Students / Groups sections, removable typed chips and clearing (**M3**: checkboxes for related
  choices, input chips for chosen entities). *Ours:* both kinds in one dropdown, the type before the
  chip label, an optional limit. Callers wrap it in `.tb-field` with a label for its `inputId` and
  use a reactive control. Unavailable options cannot be newly chosen; prefilled unavailable or
  missing ids stay visible (missing names fall back to ids) and removable. It stores `{ kind, id }`;
  the caller resolves groups (`memberRecipients` deduplicates against available students); an empty
  group choice never becomes a broadcast to everyone.

## 10. Lists, tables, chips, cards

- **Every list of data in a card, pane or dialog is a segmented list** `ul.tb-list` (CSS subgrid:
  lead, text and trail columns shared by all rows, so buttons line up): tiles `--tb-list-item`, 2 px
  gap, inner corners 4 px, outer `--tb-list-outer` (§1; a single tile has it on all corners), height
  ≥ 56 px, padding 12 / 16 px. No custom row markup for data.
  - `tb-list__lead` — 40 px secondary-container circle: people `tb-avatar` (`@shared/ui/avatar`:
    photo cut to a circle, otherwise initials; `size` for bigger), an icon for things. A list whose
    icon only decorates takes `tb-list--no-phone-lead` (on a phone the icon goes); lists of people
    keep avatars; `tb-list--no-lead` has no icon at all.
  - `tb-list__text` — `tb-list__title` (Body Large) + `tb-list__supporting` (Body Medium,
    on-surface-variant). The list panes of «Ученики» and «Задания» take `tb-list--clamp`: at most
    two lines of each, cut with an ellipsis (**M3**: label and supporting text can be truncated,
    supporting text one to three lines; *ours*: two lines, the full text in the detail beside).
  - `tb-list__trail` — an amount (Title Medium, `tb-list__trail--amount`), a status or ≤ 3 actions;
    `tb-list__trail--icons` keeps a status and icon buttons on the right on a phone. Rows share
    the trailing column (subgrid); a list whose rows differ much in it (the students: a debt, a
    tag or nothing) takes `tb-list--own-trail`: each row has its own columns, the column is as wide
    as its row's trail, and a row without `tb-list__trail` gives the width to the text.
  - On a phone (list < 26 rem) row buttons go under the text, full tile width; an amount goes under
    the text while its icon button stays on the right.
- **Row interaction:** only rows that open or select as a whole have the hover state layer
  (`tb-list__link` — a title link whose `::before` covers the row, `tb-list__stretched` — a button
  over the row, `tb-list__item--link`); their extra controls (`⋮`) stay above it; static rows have
  none. The row of the open detail is `tb-list__item--current`: secondary-container, title weight
  500 (**M3** selected list item), also over a student's colour.
- **Swipe** `tbSwipe` (`@shared/ui/swipe`, phone): follows the finger and fades, ≥ 30 % of the width
  acts, otherwise it comes back; vertical moves stay the scroll.
- **Tables** — `p-table styleClass="tb-cards"`: rows are the same tiles (no cell lines, 2 px gaps);
  on a phone each row becomes a card «column: value» (`data-label`); main column `tb-col-main`,
  amounts `tb-amount`; row typing `tbRowType`.
- **Tags** `p-tag` — one shape, no wrapping, colour by §2.
- Not data lists — wizard steps, help items, checklists, bot capabilities, files before upload —
  are plain text lists.
- **Filter chips** `tb-filter-chips` (`@shared/ui/filter-chips`, **M3**: an alternative to segmented
  buttons when viewing a list): single-select, `role="group"` with a name, each chip a button with
  `aria-pressed`; **M3** 32 dp, 8 dp corners, Label Large; unselected 1 dp outline-variant,
  on-surface-variant; selected secondary-container without outline, a leading 18 dp check. *Ours:*
  the set wraps, 8 dp gaps, a 48 dp target, a count after the label (Label Large emphasized) when
  not zero. A long set (`[oneRow]="true"`, the students of the schedule): one row, the chips that
  do not fit are measured (`ResizeObserver`) and go to a «Ещё N» chip (trailing drop-down arrow,
  at least 88 dp wide) that opens a menu of them; the first chip and the chosen one always stay in
  the row, so the filter in force is never hidden.
- **Material card** `tb-material-card` (`@shared/ui`): corner 20, surface-container-low, a preview
  on top (8:5; fetched as a blob by `tb-blob-image`, the kind icon while there is none; an external
  board shows a tonal tile with the service tag), the title (Title Medium) and «кому · дата» under
  it, «⋮» at the end only when it has an actions label. The title link covers the card. Grid
  `tb-material-grid`: 2 shrinkable columns on compact, auto-fill from medium with 192–240 px tracks;
  12 px gaps on a phone, 16 px wider. *Ours:* cards cap at 240 px (15 rem) even when sparse.

## 11. Dialogs, sheets, menus

**One dialog model** (ADR-0050). The author picks the **kind** by content; the window width only
changes the container; content and markup are the same at every width. Every dialog goes through
`<tb-dialog>` (`shared/ui/dialog`); no feature sets `p-dialog` attributes, widths or phone rules.

| Kind | For | Compact (< 600 dp) | Medium and wider |
|---|---|---|---|
| `alert` | confirmations, one decision, ≤ 1 field (password, link, language) | basic dialog | basic dialog |
| `form` | ≥ 2 fields, wizards, pickers | full-screen dialog | basic dialog |
| `sheet` | an object and its actions (lesson, link code, backups) | modal bottom sheet | basic dialog |

- **API:** `kind` (required); `width` `normal | wide`; `[(visible)]`, `headline`, `confirmLabel` /
  `confirmSeverity`, `cancelLabel` (default «Отмена», `null` = none), `pending`, `error`, `dirty`,
  `closable`; `formId` ties the confirm button to the `<form id>` in the content (Enter submits),
  without it `(confirm)` fires. Slots: `<ng-template tbDialogHeaderActions>` (✎, ⋮),
  `<ng-template tbDialogFooter>` (a custom footer, rare). `dialogSubmit({ visible, form, failed,
  request, done })` returns `pending`, `error`, `dirty` and `run()`: reset on open, `revealErrors`,
  one request at a time, close on success. `<tb-dialog-confirm-step>` is the inline question.
- **Basic dialog** (**M3**): 280–560 dp, 28 dp corners, 24 dp padding, 16 dp headline → body, 24 dp
  body → actions, 8 dp between buttons, surface-container-high, scrim; buttons at the trailing edge,
  the confirming one closest to it; with scrolling content the headline and buttons stay pinned.
  *Ours:* `normal` 32 rem, `wide` 40 rem (= 560 dp), `alert` 32 rem (a confirmation ≤ 35 rem);
  never closer than 1 rem to the screen edge.
- **Full-screen dialog** (`form` on compact only, **M3**): 56 dp header, 24 dp sides, 8 dp between
  elements; «✕» first and the only navigation, the headline (one line, truncated), the confirming
  button at the end with a clear verb («Создать», «Отправить», not «Готово»), never disabled for
  invalid fields. Field errors inline. *Ours (M3 has 0 dp corners and a text button):* 28 dp top
  corners and the notifications sheet's inset (8 px + `safe-area-inset-top`, transparent scrim, so
  the page shows above it); the confirming button is **filled**, small (40 dp). No swipe to close
  (a form may hold unsaved data): «✕», Esc and «Отменить изменения?».
- **Bottom sheet** (`sheet` on compact only): modal, handle with a 48 dp target, 28 dp top corners,
  surface-container-low (**M3**), height by content up to 50 % of the screen, then scrolling
  (**M3**). *Ours:* compact only (**M3** allows medium); no swipe — Esc, the scrim and an action
  inside close it; no «✕».
- **Footer:** at most **two** actions — dismiss («Отмена», neutral text) and confirm, the confirm
  one last; a dialog that only informs has one, «Закрыть». Extra and dangerous actions («Сбросить»,
  «Удалить…», «Снять отметку») go to «⋮» in the header (`tb-menu-item--danger`); at most **one red
  button** — the confirmation of a dangerous action.
- **Closing** (*ours*): from medium `alert` and `form` have no «✕» (exit «Отмена», Esc); `sheet`
  keeps «✕». The scrim closes `alert` and `sheet`, never a `form`. Stages that must not be
  interrupted (restart) set `[closable]="false"`.
- **Dirty form:** closing a `form` with changes asks «Отменить изменения?» (Esc = «Отмена»): on
  compact a basic dialog over the full-screen one (the only dialog over a dialog, **M3**; the
  discard button red, *ours*); from medium and inside `alert` / `sheet` the inline
  `<tb-dialog-confirm-step>` — its text and two buttons replace the footer.
- **Inline form not saved** (settings cards, *ours*): a card with a form calls
  `guardUnsaved(() => dirty)` (`core/routing/unsaved-changes.ts`); the page (`SettingsPage.canLeave`
  + `canLeaveGuard`) asks the shared `Confirm` «Отменить изменения?» on a route or category change,
  the browser's `beforeunload` prompt stops a reload.
- **Initial focus** (*ours*): `form` — the first field (**M3**); `alert` and `sheet` — the headline
  (`tabindex="-1"`), so Enter never confirms a dangerous action. Focus returns to the opener.
- **Errors:** a server error of a `form` stands above the form (the dialog scrolls to it); in an
  `alert` under the text; a failed action in a `sheet` — an error snackbar, the card stays clean.
- **Confirmations:** `Confirm` (`@shared/ui/confirm`) over the one `<p-confirmdialog>` in `app.ts`:
  `confirm.danger({ header, message, acceptLabel, icon? })` — filled red; `confirm.safe(…)` — filled
  primary; both return `Promise<boolean>` with the fixed neutral «Отмена». Features declare no
  `ConfirmationService` and no host. Inside a dialog use `<tb-dialog-confirm-step>`. The header is a
  clear statement, never «Вы уверены?» (**M3**).
- **Single choice:** a `tb-list` with `p-radiobutton` in the lead and a `label` covering the tile
  (hover state layer); the checked tile secondary-container / on-secondary-container (*ours*: **M3**
  publishes no selected-tile role); the default option is checked, so the action is never disabled;
  a note the choice needs goes above the list. A choice of two with one verdict is a connected group
  (§8) and one submit button whose label follows the choice.
- **Side sheets.** Modal `tb-side-sheet` (help; the bell below extra-large as
  `tb-side-sheet--narrow`): a right drawer with `tbModalDrawer` (`role="dialog"`, `aria-modal`,
  named by its title, focus trap, Esc, scroll lock, focus back), surface-container-low, scrim 32 %;
  help 42 rem wide, 1 rem from the window edges, large corners; header «←» (only when there is a way
  back), the headline (Title Large) and «×»; on a phone the whole screen. Standard (non-modal) side
  sheet — `tb-pane kind="sheet"` (§7), e.g. the bell on extra-large and the review sheet.
- **Menus and dropdowns:** 16 px container, 4 px padding, elevation 2; items are tiles with 2 px gap
  — 4 px corners, 12 px on the outer side of the first and last item and of the selected one;
  *ours:* items next to a separator get the outer 12 px too, so each group reads as one segment (the
  divider stays, as **M3** separates groups on the web); hover 8 %; selected item
  secondary-container / on-secondary-container with a check at its end (`menuitemradio` +
  `aria-checked`); destructive item red. Overlays inside panes append to `body`, so the pane does
  not clip them.

## 12. States and feedback

- **Loading states:** every section that loads data has three states via `LoadState`
  (`shared/ui/load-state.ts`, `track()`) and `tb-load-state`:
  - loading — the **M3E** loading indicator centred in the section's place (a 38 px shape in
    on-primary-container inside a 48 px primary-container circle; a pulsing circle under reduced
    motion), min height, «Загрузка…» `role="status"`;
  - error — icon, «Не удалось загрузить …», the error with its code, «Повторить»;
  - ready — data or the empty state (only after a successful load; a bad link is an error).
- Load requests are quiet (`quietContext()` / `SKIP_ERROR_TOAST`): the error shows in the section.
- **Empty state** — only `tb-empty-state`: icon, what is empty, what will appear, a first-action
  button (omitted if the same action is the FAB or a section button); `compact` for home widgets and
  the calendar.
- **Snackbar** (`core/snackbar`): bottom centre, inverse-surface, above the bottom bar and FAB on a
  phone; never takes focus; success / info `role="status"`, error `role="alert"`; 5 s, error 8 s,
  paused on hover / focus; «Закрыть» 40×40; an identical message is not repeated while visible.
  A result that can be taken back (`Snackbar.undoable`, e.g. «Отмечено: пропуск») has a text button
  «Отменить» before «Закрыть» (*ours:* `inverse-primary`, `label large`) and stays 6 s.
  A new version of the installed app (`Snackbar.action`, «Доступна новая версия» + «Обновить»,
  `core/pwa`) is the same snackbar with its own button label that stays until closed.
  Actions toast their result only if it is not visible in place.

## Part D — Across the portal

## 13. Accessibility (WCAG 2.2 AA)

- **Focus ring** — only after keyboard interaction (`KeyboardFocus`, also on autofocus and focus
  return; pointer input hides it, *ours*): 3 px secondary, 2 px offset; fields show focus by their
  2 px primary indicator (§9). In navigation the ring goes around the item and state layers lie over
  the active indicator.
- Rail and bottom bar are `<nav>` with links, active `aria-current="page"`; ☰
  `aria-haspopup="dialog"` + `aria-expanded`; the account item's name starts with the visible
  label.
- **Headings:** one h1 (the page title; «Вход», «Приглашение»); h2 sections (`p-card` title via the
  global pass-through `core/a11y/pass-through.ts`); Markdown headings one level below their
  container.
- **Modal surfaces** — dialogs (§11) and side sheets trap focus, close on Esc, lock scroll, are
  named by their title; focus **returns** to the opener after a dialog, sheet or menu
  (`core/a11y/focus-return.ts`, `shared/ui/dialog/focus-return.ts`); after a failed login to the
  password field.
- «×» of dialogs, sheets and toasts — a 40×40 button «Закрыть». PrimeNG and FullCalendar service
  labels in Russian. Progress bars — `tbProgressLabel`.
- Links inside text are underlined; navigation, button-links, row title links (`tb-link`) and menu
  items are not.
- Media queries in `em` ranges (§5).
- E2E runs axe (no critical / serious) on the main screens and checks button height (40 px), the
  number of filled buttons per page, no red «Отмена», no `outlined` / `size="small"` / `success` /
  `warn` / `info` buttons, red buttons only for danger confirmations and deletion.

## 14. Texts and languages (ADR-0035)

- **No text in templates or code:** every word the user reads comes from a dictionary —
  `core/i18n/{ru,en}.ts` (the frame), `shared/i18n/{ru,en}.ts` (common words:
  `SHARED_T.common.cancel`, `.save`, `.close`…) or the feature's `i18n/{ru,en}.ts` (`T`). A
  component keeps its part as `protected readonly t = T.<part>` (and `c = SHARED_T.common`) and
  binds it. Texts with numbers or names are functions (`t.saved(name)`, `countOf` for plurals); a
  date or an amount is formatted before it goes in.
- Russian is the source dictionary; another language has the same keys (`Translation<typeof ru>`),
  checked by `expectComplete`. Wording follows [`glossary.md`](glossary.md).
- **Language switch** — in «Мой аккаунт» → «Оформление» under the theme: a connected button
  group, each language in its own name, the chosen one `aria-pressed`; on the sign-in and
  invitation pages the `tb-language-picker` row under the card. Switching reloads the page.
- Numbers, money and dates use the language's locale (`locale()`: `ru-RU`, `en-GB`); fixed formats
  `dd.MM.yyyy` / `HH:mm` in both languages.
- **Server texts** ([ADR-0036](adr/0036-server-texts-in-the-users-language.md)): every `/api`
  request carries `Accept-Language` (`core/i18n/language.interceptor.ts`); a language chosen on the
  device is saved to the account after sign-in, and notifications, bot messages and calendars use
  it.

## 15. Portal branding

- **Appearance** — the source colour, the scheme and the named contrast (§2), stored in `platform`
  settings and applied at start; the settings screen is in
  [`screens.md`](screens.md#settings-teacher).
- **Base colours** (`core/theme/appearance.ts`) — the original indigo and screen approximations
  inspired by Pantone Colours of the Year: Classic Blue (2020), Very Peri (2022), Emerald (2013),
  Viva Magenta (2023), Peach Fuzz (2024), Mocha Mousse (2025), Illuminating (2021), Cloud Dancer
  (2026) — screen colours, not exact Pantone reproductions or a ranking
  ([2022](https://www.pantone.com/color-of-the-year-2022),
  [2026](https://www.pantone.com/na/en-us/color-of-the-year/2026)).
- **Custom colour** — the PrimeNG picker as a popup from its swatch (appended to `body`), with a
  labelled HEX input beside it.
- **Logo** — PNG, JPEG, WebP or SVG ≤ 1 MB in `platform` storage (backed up, removed by full reset),
  served without login at `/api/public/portal/logo`, SVG with `Content-Security-Policy: sandbox`. In
  the rail and its preview it is cut to a circle (`object-fit: cover`); on the sign-in page it keeps
  its shape.
- **Browser icon** — `favicon.svg` (graduation cap on indigo, rounded square) with `favicon.ico`
  (16/32/48) and `apple-touch-icon.png` (180 px); the portal logo, when set, replaces them.
