# Design system

The **current** UI rules: Material 3 Expressive (M3E) on PrimeNG 21. This page brings together ADR-0015,
ADR-0017–0027 and the call window of ADR-0030, which are the history (*why*); if they disagree with this page, this page is right. A change to
a rule updates this page in the same commit, and a new decision also gets an ADR. UI wording follows
[`glossary.md`](glossary.md) (Russian).

Where it lives: preset `core/theme/teacher-box-preset.ts`, colour scheme `core/theme/color-scheme.ts`,
tokens and shared classes `src/styles.scss`, components `shared/ui/*`, breakpoints `core/layout/mobile.ts`.
No other UI kits (Angular Material, Material Web), no Material Symbols: icons are `primeicons` 7.

## 1. Tokens

- **Spacing** — 4 px grid, `--tb-space-N` = N × 4 px. Component styles take spacing only from tokens.
- **Shape** (radius):

  | Token | px | Use |
  |---|---|---|
  | `--tb-shape-xs` | 4 | tooltips, inputs, inner corners of split button and list tiles |
  | `--tb-shape-sm` | 8 | chips, tags, inner corners of connected button groups |
  | `--tb-shape-md` | 12 | pressed button, selected toggle, menu items |
  | `--tb-shape-lg` | 16 | FAB, menus and dropdowns, outer corners of list tiles |
  | `--tb-shape-lg-plus` | 20 | cards |
  | `--tb-shape-xl` | 28 | dialogs, top of the bottom sheet |
  | `--tb-shape-xl-plus` | 32 | login and invite card |
  | `--tb-shape-2xl` | 48 | loading indicator |
  | `--tb-shape-full` | — | buttons, search fields, navigation indicator |

  Radii come only from this scale. `--tb-shape-button` (20 px) is half a 40 px button.
- **Elevation** — surfaces differ by tone, not shadow. Shadows `--tb-elevation-1..3` only on floating
  elements: FAB, menus, dropdowns, date picker (level 2), dialogs (3), bottom sheet (1).
- **State layers** — content colour over the element: hover `--tb-state-hover` 8 %, focus and pressed 10 %;
  disabled — container 12 %, content 38 % (`--tb-state-disabled*`). Hover only on things that act: rows that
  open as a whole (`tb-list__item--link`), not on static rows. Ripple is on.
- **Motion** — M3E springs, precomputed as `linear()` with a duration: `transition: border-radius
  var(--tb-spring-fast-spatial)`. Spatial (overshoot; position, size, shape): `--tb-spring-fast-spatial`,
  `--tb-spring-default-spatial`; effects (no overshoot; colour, opacity): `--tb-spring-fast-effects`. Used for
  button shape, nav indicator, section folding, FAB appearance; dialogs and snackbar keep PrimeNG animations.
  `prefers-reduced-motion: reduce` disables transitions (the loading indicator stays a circle).
- **Layout** — content up to `--tb-content-max` (1440 px); forms in `--tb-content-narrow` (56 rem); top bar
  64 px, bottom bar 80 px, rail 88 / 280 px — chrome sizes in **px** so a large font grows text, not frames.
- Preset tokens reference `--tb-*`; no literal values in component styles.

## 2. Colour

- **Only roles `--p-md-*`** in styles. Never `--p-surface-N`, `--p-<colour>-N` palettes, or opacity for
  dimming: muted text is on-surface-variant; 38 % only for disabled controls.
- **Scheme from the portal colour** (seed): a preset palette or custom `#rrggbb` → shades 50–950
  (`updatePrimaryPalette`, `palette()`); all M3 roles (primary, secondary, tertiary, neutrals, containers) are
  computed in the app (`color-scheme.ts`, OKLCH tones mapped to sRGB) and pushed via `updatePreset`. No
  `oklch(from …)` in CSS. Recomputed on load and when the portal colour is saved.
- **Contrast is guaranteed by tone:** primary ≥ 4.5:1 against on-primary, page, card, list tile and
  primary-container (start from shade 600 / dark 200, shift lightness until it passes); the same for
  on-*-container pairs and inverse-primary / inverse-surface; primary-container ↔ its text ≥ 7:1. All preset
  palettes are tested in both themes. The custom-colour check reports darkening and warns when primary is
  close (OKLab ΔE×100 < 12) to success or error.
- **Custom roles:** success (light green 700 / white, container green 100 / 900; dark green 300 / 950,
  container 800 / 100), warning (amber 700 / white, container amber 100 / 900; dark amber 300 / 950,
  container 800 / 100), error (light red 700). No info role — info uses tertiary.
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
  calm counter `secondary`; the bell badge sits on the icon's corner. Calendar events: conducted —
  success-container, missed — warning-container, cancelled — surface-container-highest + on-surface-variant +
  strikethrough; student request — 2 px warning outline; busy / off-time — outline / outline-variant.
- **Surfaces:** page — surface-container (light) / surface (dark); cards, dialogs, «Ещё» panel, dropdowns —
  surface-container-lowest (light) / surface-container (dark); list tile `--tb-list-item` —
  surface-container-low / surface-container-high. Top bar on scroll — surface-container. Scrim 32 % in both
  themes.
- **Themes:** «Светлая», «Тёмная», «Как в системе», stored on the device; switched by a class on `<html>`.
- Text contrast ≥ 4.5:1, outlines and focus rings ≥ 3:1.

## 3. Typography

- Roboto variable, bundled from `@fontsource-variable/roboto` (no CDN). Monospace — `var(--tb-font-mono)`.
- Set roles with the shorthand `font: var(--tb-type-<role>)` (size, line height, weight) plus
  `letter-spacing: var(--tb-tracking-<role>)`; page text is Body Large.
- Page title — Headline Medium emphasized (phone: Headline Small emphasized); card title — Title Large
  emphasized; dialog title — Headline Small emphasized; section subtitles — Title Medium; field labels,
  buttons, menu items, dropdown options — Label Large; tooltip, `small`, stat details — Body Small.
- Weights 400 and 500 only (no 600/700): emphasis is weight 500 and colour.
- Wrap text between words (`overflow-wrap: break-word`); `anywhere` only for codes, URLs, paths, env names
  and table cells with columns. Empty-state titles have no trailing full stop.
- Dates, plurals and numbers — glossary (`CountPipe`, non-breaking space between number and unit).

## 4. Layout and navigation

- **Breakpoints** (em ranges, same in CSS and `mobile.ts`, no gaps):

  | Window | Query | Navigation | Main action |
  |---|---|---|---|
  | compact (phone) | `width <= 48em` | bottom bar: four sections + «Ещё» | extended FAB above the bar |
  | medium | `48em < width < 75em` | navigation rail 88 px (icon + label) | button in page header |
  | expanded | `width >= 75em` | expanded rail 280 px, items 56 px, 4 px gap | button in page header |

  No other breakpoints (480 px is gone). Below 30em height the top bar is not sticky.
- **Bottom bar:** the first four sections of the role (sections are ordered by frequency of use; `NAV_ITEMS` in `shell.ts`), then «Ещё» (other sections,
  help, settings, account, sign out); five sections fit without «Ещё» — the student has five (with «Мои доски»). Item ≥ 64 px, Label Medium, never
  truncated; «Ещё» is active when its section is open. Indicator — 64×32 pill, secondary-container, moves on
  `--tb-spring-fast-spatial`; same in the rail.
- **Top bar** (64 px, sticky): logo and portal name, bell, user menu (settings, help, account, theme, sign
  out). No cabinet name.
- **One column:** cards stacked (`tb-stack`) on every screen, ordered by importance (what needs action
  first). No card grids. Full width, except forms (`tb-stack--narrow`). Columns only inside one row of data
  (name — value, table columns, row buttons, filter fields).
- **Long settings pages** use foldable sections `tb-fold-card` (not tabs): header is a button with chevron and
  a line of explanation; content loads on first open; open sections in the URL (`?open=`).

## 5. Page anatomy

- **Header** `tb-page-header` (`@shared/ui`): «Назад» icon button on nested pages (tooltip = destination,
  e.g. «Все задания»); h1; «?» help if the section has an article; detail line (due date, status); actions on
  the title line (56 px), main one last (right). On the phone actions go under the title, equal width.
- **Main action** — filled `tb-page-fab`, last header action; on the phone an extended FAB (icon + label,
  primary-container, shadow), always visible. FAB only for create/record (student, lesson, task, payment);
  at most one per page.
- **Sections** — `p-card` with a title (h2, Title Large); help as «?» next to the title; section actions —
  tonal, in the title row (`tb-card-title__actions`). In a `tb-fold-card` (its header is a button) the action
  goes in the first body row, right. A card holding the page's only list gets a hidden `h2.tb-sr-only`.
- **Forms on a page** — buttons in `tb-form-actions` bottom right; full width on the phone.
- **Toolbar above a list** (`tb-toolbar`): search left, filters (labelled switch) and period right.

## 6. States and feedback

- Every section that loads data has three states via `LoadState` (`shared/ui/load-state.ts`, `track()`)
  and `tb-load-state`: **loading** (M3E indicator centred in the section's place, min height, «Загрузка…»
  `role="status"`), **error** (icon, «Не удалось загрузить …», error text with code, «Повторить»), **ready**
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

Variant = **weight**, colour = **meaning**. Size is one: 40 px pill (icon button 40×40, 48 px touch target),
Label Large; shape morphs to 12 px while pressed. Never `outlined` (outline is for inputs only),
`size="small"`, `warn`, `info`, `help`, `contrast` on buttons.

| Role | Variant | PrimeNG |
|---|---|---|
| Main page action / dialog submit / login form | filled | no variant (+ `severity="success"` in dialogs) |
| Secondary page or section action, section save | tonal | `severity="secondary"`; coloured tonal: `styleClass="tb-tonal"` + severity |
| «Отмена», «Скрыть», «Понятно», labelled row action | text | `[text]="true"` |
| Icon action (edit, delete, link) | text, round, neutral, tooltip | `[text]="true" [rounded]="true" severity="secondary"` + `pTooltip` |
| Confirm an irreversible action (in a dialog) | filled red | `severity="danger"` |

| Meaning | Colour | Examples |
|---|---|---|
| Confirm: save, create, send, accept, assign, mark conducted | green `success` | «Сохранить», «Создать», «Отправить», «Принять», «Проведено», «Напомнить», «Загрузить» |
| Consequence: delete, cancel a lesson, refuse, finish, roll back | red `danger` | «Удалить…», «Отменить занятие…», «Вернуть на доработку», «Пропуск», «Вернуть как в .env», bin icon |
| Navigate, edit, refresh, filter, FAB | portal colour or neutral | «Далее», «Войти», «Открыть», pencil, «Обновить» |

- **Page:** at most one filled button outside dialogs — the FAB; without a FAB, the single filled button is the
  page's main decision (green «Принять», «Сохранить и перезапустить», or portal-coloured «Далее»/«Войти»).
  Everything else tonal; «Подключиться» is tonal in rows, filled only in the home hero and the bottom sheet.
- **«Отмена» means only "close without consequences":** neutral text button
  (`severity="secondary" [text]="true"`), never red. «Назад» is navigation (page, wizard step), not closing.
  Window that only informs closes with «Закрыть».
- **Row actions:** at most three; labelled — text; icons — neutral round, red for delete.
- **Steady widths:** a button whose label changes («Отменить» / «Не приду») uses `tb-button-steady`.
- Every action that sends a request shows `[loading]` while it runs (`shared/ui/busy.ts`); the submit button is
  never disabled for invalid fields — only while the request runs.
- **Connected button group** `tb-button-group` (also `p-selectbutton`): 2 px gap, inner corners 8 px, outer
  full; unselected tonal, selected primary and fully round; no outline.
- **Split button** `tb-split` (e.g. «Начать урок» | «Открыть в браузере»): 2 px gap, inner corners 4 px,
  arrow part becomes round while its menu is open.
- Icon buttons: tooltip = accessible name, with row context («Отменить занятие: Анна, 14:00»); help «?»
  includes the article («Справка: Портал»); menu buttons have `aria-haspopup` + `aria-expanded`
  (`tbAttributes`).

## 8. Dialogs, sheets, menus

- **Width by class**, never inline: `tb-dialog` 32 rem, `tb-dialog--wide` 40 rem, confirmations ≤ 35 rem;
  never closer than 1 rem to the screen edge.
- **Phone:** full screen only for dialogs with ≥ 2 fields or long content; one field or none —
  `tb-dialog--short`, centred.
- **Form dialog:** `<form [id]>` in the body, submit in the footer with `type="submit" [attr.form]`
  (`tbSubmitFor`) so Enter submits; order «Отмена», then the action.
- **At most one red button per dialog** — the confirmation of the dangerous action. Other dangerous actions go
  to the «⋮» menu in the dialog header (`tb-menu-item--danger`) or a confirmation step inside.
- Initial focus on the dialog title (`[focusOnShow]="false"`, `tabindex="-1"`), not on a button. A dialog
  never opens another dialog on top.
- **Confirmations** only via `dangerConfirmation` / `safeConfirmation` (`@shared/ui/confirmation`): danger —
  filled red action; safe — green; both get neutral «Отмена»; the reject label/props cannot be overridden.
- **Lesson dialog:** footer — the main action for the lesson state («Проведено | Пропуск» group,
  «Восстановить», «Отметить посещаемость»); «Изменить» — pencil in the header; «Отменить занятие…»,
  «Удалить…», «Снять отметку» — «⋮» menu; «Начать урок» — tonal.
- **Bottom sheet** (phone row actions that don't fit): `p-drawer` bottom, `styleClass="tb-sheet"`,
  `tbModalDrawer`; handle, 28 px top corners, height by content, full-width buttons. Closes by Esc, scrim and
  «Закрыть» (no swipe). Example: upcoming lesson row on the phone = icon, time and details, chevron
  (`tb-list__stretched` button); sheet holds «Подключиться» and «Перенести | Отменить» group.
- **Menus and dropdowns:** 16 px container, 4 px padding, elevation 2; items are tiles with 2 px gap — 4 px
  corners, 12 px on the outer side of the first and the last item and on the selected one (dropdown lists —
  global rules in `styles.scss`, the select's own style would override the preset), hover 8 %; selected item — tertiary-container (selected theme also says «(выбрана)»); destructive item red.

## 9. Lists and tables

- **Every list of data inside a card or dialog is a segmented list** `ul.tb-list` (CSS subgrid: lead, text,
  trail columns shared by all rows, so buttons line up): tiles `--tb-list-item`, 2 px gap, inner corners 4 px,
  outer 16 px (a single tile fully round), height ≥ 56 px, padding 12 / 16 px.
  - `tb-list__lead` — 40 px secondary-container circle: initials (`tb-avatar` + pipe `initials` from
    `@shared/ui/initials`) for people, an icon for things;
  - `tb-list__text` — `tb-list__title` (Body Large) + `tb-list__supporting` (Body Medium, on-surface-variant);
  - `tb-list__trail` — amount (Title Medium), status or ≤ 3 actions.
  - On the phone (list < 26 rem) row buttons go under the text, full tile width, from the left;
    `tb-list__trail--icons` keeps a status and icon buttons on the right.
  - Students and groups (1.7.3) — a `tb-list`, not a table: initials / icon; name + one supporting line (a
    student's phone, a group's members); trail — status `p-tag` and «⋮» (one popup `p-menu` per list, items
    for the clicked row, `aria-haspopup` + `aria-expanded`). Everything else lives in the edit dialog
    (login read-only, the room — `tb-room-panel`); a student's login and note — tooltip on the name
    (`tb-tooltip-lines`, focusable).
- **Name — value pairs and key figures** — `tb-stats` / `tb-stat` (tiles one under another: name left, number
  right, details below).
- **Tables** — `p-table` with `styleClass="tb-cards"`: rows are the same tiles (no cell lines, 2 px gaps); on
  the phone each row becomes a card «column: value» (`data-label`). Main column
  `tb-col-main`, amounts `tb-amount`. Statuses — `p-tag`, one shape, no wrapping. Row typing — `tbRowType`.
- Not data lists: wizard steps, help items, checklists, bot capability lists, task files — plain text lists.
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
- Date field — one field with a trailing calendar icon. Search — `p-iconfield` with `pi-search`: filled pill
  (surface-container-high), no outline; dropdown filter — the same pill, 48 px, named «Поиск».
- Password: `tb-password-toggle` — 40×40 icon button inside the field, «Показать пароль» / «Скрыть пароль»,
  `aria-pressed`.
- A 40 px button next to a 56 px field is centred on it (`tb-copy-row`).

## 11. Accessibility (WCAG 2.2 AA)

- Keyboard focus ring: 3 px secondary, 2 px offset (fields: 2 px primary outline). In navigation the ring
  goes around the item and state layers lie over the active indicator, not instead of it.
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
  filled buttons per page, no red «Отмена», no `outlined` / `size="small"` / `warn` / `info` buttons.

## 12. Portal branding

- Portal colour — preset palette or custom `#rrggbb`, stored in `platform` settings, applied at start.
- Logo — PNG, JPEG, WebP or SVG ≤ 1 MB, stored in `platform` storage (backed up, removed by full reset),
  served without login at `/api/public/portal/logo`; SVG with `Content-Security-Policy: sandbox`.
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
  toggles; a switched-off microphone or camera stays round and turns error-container with a crossing line
  (primeicons have no «slash» icons); `aria-pressed` on every toggle. «Выйти из звонка» — a wider red button with
  the hang-up phone. No tooltips on call buttons (they cover the video); the labels are for screen readers. The
  devices menu lies above the window (`baseZIndex`). Phones have no screen sharing.
- **Mini window** — on a computer 20 rem, surface-container-high, `--tb-shape-xl`, elevation 3, in a corner
  (dragged by its top line and snapped to the nearest corner, or «Переместить окно звонка»; remembered on the
  device); shows a shared screen, the speaker or a camera; compact toolbar. On a phone — a full-width pill above
  the bottom navigation; the FAB moves above it.
- **States** — «Подключение…» (spinner, `role="status"`), «Связь прервалась, переподключаемся…» (warning
  container), the end of a call with its reason (`role="alert"`), «Закрыть» and «Войти снова»; blocked sound —
  an info message with «Включить звук». Joins and leaves are announced in a polite live region.

