# Аудит отступов Teacher Box против Material 3 (2026-11-18)

Только чтение, ветка `release/0.57.0`. Источники M3 — скилл `m3-expressive`
(`references/layout.md`, `foundations.md`, `components/containment.md`, `buttons.md`, `input.md`,
`component-tokens.md`). Пути кода — от `frontend/src/`.

**Главный вывод.** Литералов почти нет (≈50 строк на ≈900 строк с токенами), и «off-grid» почти
всё — допустимые в M3 вложенные единицы (2/6/10 dp). Ощущение «нет системы» дают не числа, а
**разные правила для одних и тех же мест**: поле экрана на телефоне 12 или 16 px в зависимости от
того, есть ли на странице панели; промежутки между секциями 12 / 16 / 20 / 24 / 32 px по
страницам; внутренний отступ карточки 0 / 12 / 16 / 20 / 24 px в зависимости от контекста; пресет
PrimeNG целиком на литералах, вопреки `docs/design-system.md` §1.

---

## (a) Целевая система M3

Метки: **M3** — опубликованное правило M3; **M3E** — из M3 Expressive; *наше* — решение портала,
в M3 его нет (оставить, но зафиксировать токеном).

**Приоритет: M3E → M3 → наше.** Где у M3E есть своё значение (токены `List` v29, button groups,
toolbars, small button 16 dp), оно заменяет базовое M3; базовое M3 действует, только где M3E
молчит (поля окна, диалоги, карточки); *наше* — только где молчат оба. Отсюда новое отклонение
b0 (строка списка).

### Шкала

| Что | M3 | Токен портала |
|---|---|---|
| Базовая единица | **M3**: шкала 8 dp, `space100 = 8dp`; отступы кратны 4 dp | `--tb-space-N` = N × 4 px ✔ |
| Вложенные единицы | **M3**: 2, 4, 6, 10 dp (0.25×/0.5×/0.75×/1.25×); расширение по множителю (`space225` = 18 dp) | нет `--tb-space-half` (2 px), 6, 10 — пишутся литералами |
| Где задавать | **M3**: padding и gap на родителе; margin на дочерних — избегать | частично (см. b4) |
| Хардкод | **M3**: «replace any hardcoded values» системными токенами | пресет — литералы (b3) |

### Окно и панели

| Контекст | Значение | Токен |
|---|---|---|
| Поле экрана, compact (< 600) | **M3** 16 dp | `--tb-space-4` |
| Поле экрана, medium и шире | **M3** 24 dp | `--tb-space-6` |
| Промежуток между панелями | **M3** 24 dp | `--tb-panes-spacer` = `--tb-space-6` ✔ |
| Фиксированная панель | **M3** 360 (expanded) / 412 (large+) dp | ✔ |
| Внутренний отступ панели | *наше* 24 / 16 (compact) | `--tb-space-6` / `--tb-space-4` ✔ |
| Верхняя панель → контент | **M3 не публикует** (только картинки); *наше* 8 px на телефоне (434.1), на десктопе панели — 0 | нужен один токен `--tb-top-gap` |
| Строка текста | **M3** 40–60 символов (до 120 на больших) | *наше* 66 ch |

### Компоненты

| Контекст | Значение | Источник |
|---|---|---|
| Карточка: отступ слева/справа | 16 dp | **M3** cards |
| Между карточками | ≤ 8 dp | **M3** cards («8dp max») |
| Карточка в панели | без поверхности и отступов, секции через 12 px | *наше* (ADR-0020) |
| Outlined section card | 20 px внутри, 16 px между карточками формы | *наше* |
| Строка списка | **16 dp** по бокам, **10 dp** сверху/снизу, **12 dp** между lead / text / trail; 56 / 72 / 88 dp высота в 1 / 2 / 3 строки | **M3E** `List` v29 (`ItemLeading/TrailingSpace`, `ItemTop/BottomSpace`, `ItemBetweenSpace`) — заменяет базовое M3 (8 сверху, 24 у trailing) |
| Segmented list (gap между плитками) | 2 dp; разделители — только у неконтейнерных списков | **M3E** `SegmentedGap` |
| Small button | 16 dp по бокам (24 — «не рекомендуется») | **M3E** |
| Важный контент | «ample space» + самая яркая поверхность | **M3E** тактика containment (без числа) |
| Диалог basic | 24 dp со всех сторон, 16 headline→body, 24 body→actions, 8 между кнопками | **M3** |
| Bottom sheet | на всю ширину до 640 dp; шире — 56 dp сверху и по бокам | **M3** |
| Side sheet | 24 dp по бокам (16 с иконкой), 12 между верхними элементами | **M3** |
| Segmented buttons | ≥ 12 dp по бокам, 8 dp между иконкой и текстом, 40 dp высота | **M3** |
| Connected button group | 2 dp между кнопками на всех размерах | **M3E** |
| Standard button group | XS 18 / S 12 / M–XL 8 dp | **M3E** |
| Чипы | ≥ 8 dp между чипами, цель 48 dp | **M3** |
| Toolbar | ≥ 16 dp снаружи; floating — 16 dp от края (24 вертикальный) | **M3E** |
| Секция → секция в столбце | **M3 не публикует**; принцип «группировка близостью» | *наше*: выбрать одно значение |
| Заголовок секции → контент | **M3 не публикует** | *наше* 12 px (уже в `design-system.md` §7) |

**Предлагаемая шкала ритма страницы (наше, на основе M3):**

| Уровень | Значение | Токен (предложение) |
|---|---|---|
| Внутри элемента (строки заголовка/подзаголовка) | 2–4 px | `--tb-space-half`, `--tb-space-1` |
| Заголовок секции → её контент | 12 px | `--tb-gap-title` = `space-3` |
| Блок → блок внутри секции | 12 px | `space-3` |
| Секция → секция (страница и панель) | 24 px | `--tb-gap-section` = `space-6` |
| Шапка страницы → первый контент | 16 px | `--tb-gap-header` = `space-4` |
| Поле экрана | 16 / 24 px | `--tb-margin` (compact / шире) |

---

## (b) Отклонения, худшие сначала

### b0. Строка списка не по токенам M3E `List` — **высокая** (самый массовый элемент)

`styles/_lists.scss:130` `gap: 2px var(--tb-space-4)` — между lead, текстом и trail **16 px**,
M3E `ItemBetweenSpace` — **12 dp**; `_lists.scss:145` (и `:21`) `padding: space-3 space-4` —
сверху/снизу **12 px**, M3E `ItemTop/BottomSpace` — **10 dp** (вложенная единица 1.25×). Бока
16 ✔, высота ≥ 56 ✔, gap 2 ✔. Касается всех `tb-list` и `tb-cards`-таблиц портала. Пресет:
пункты меню/select `0.625rem 1rem` (10/16) и gap `0.75rem` (12) — уже по M3E, т. е. меню и списки
сейчас расходятся между собой.

### b1. Поле экрана на телефоне: 12 px против 16 px — **высокая**

- `app/core/layout/shell.scss:112` — контент без панелей: `padding: space-2 space-3 space-4` → по
  бокам **12 px**. В `docs/design-system.md` §7 написано «16 px at the sides», M3 compact — 16 dp.
- `app/shared/ui/panes.ts:249` — страницы с панелями: **16 px** (`space-4`).
- `styles/_tables.scss:99-101` — на телефоне карточка в `.tb-stack` получает ещё `padding-inline:
  space-4` → текст карточки на **28 px** от края; карточка со списком/поиском
  (`_tables.scss:107-111`) — `space-3` → **24 px**.
- Затронуто: страницы без панелей — `homework/student/my-task-page.ts`,
  `homework/teacher/assignment-page.ts`, `homework/teacher/editor/*`,
  `homework/teacher/task-review-page.ts`. Переход «список заданий (панели) → задание (без)»
  сдвигает край контента на 4–12 px.

### b2. Промежуток между секциями страницы — пять значений — **высокая**

| Значение | Где |
|---|---|
| 12 px | `identity/account/account-panel.ts:~343` (сетка medium) |
| 16 px | `.tb-stack` `styles/_page-header.scss:109`; `schedule/teacher/schedule-page.ts:430`, `schedule/student/my-schedule-page.ts:435` |
| 20 px | `homework/teacher/assignment-page.ts:336`, `homework/student/quiz-player.ts:311` |
| 24 px | `settings/settings-page.ts:256`, `homework/student/my-task-page.ts:345`, `homework/teacher/assignment-page.ts:343`, `editor-task.ts:195,229`, `question-editor.ts:540`, `question-section.ts:427`, `video-list.ts:55`, `my-deadlines-widget.ts:103` |
| 24 / 32 px (ряд/колонка) | `home/teacher-home.ts:115`, `home/student-home.ts:89`, `admin/status/status-page.ts:274` |
| 32 px | `homework/student/quiz-player.ts:303` |

Общий примитив `.tb-stack` (16) используется не везде, страницы задают свой `gap`. Это главный
источник «разного ритма».

### b3. Пресет PrimeNG — литералы, вопреки design-system §1 — **средняя**

`app/core/theme/teacher-box-preset.ts`: ни одной ссылки на `--tb-space-*` (0 вхождений), хотя §1
требует «preset tokens reference `--tb-*`».

| Строка | Компонент | Значение | Замечание |
|---|---|---|---|
| 513 | card body | `1.25rem 1.5rem` (20/24), gap `0.75rem` | M3 cards — 16 dp по бокам; на телефоне перебивается до 16/12 (b1) |
| 519–522 | dialog header/content/footer | 24/24/16, 0 24, 24, gap 8 | соответствует M3 ✔, но литералы |
| 455 / 454 | overlay modal / popover | 24 / 16 | ✔ M3, литералы |
| 440–450, 535–536 | list/menu option | 4, gap 2, item `0.625rem 1rem` (10/16), gap 12 | 10 = вложенная единица M3 ✔ |
| 569 | toast content | `0.875rem 1rem` (**14**/16) | вне сетки и вне вложенных единиц |
| 560–561, 584 | tag / message | 0 8, gap **6** | 6 — вложенная единица M3 ✔ |
| 425–428 | formField | 16/15, sm 12/6, lg 16/14 | 15/14 — расчёт под 56 dp высоты ✔ (комментарий есть) |
| 467, 619 | button / togglebutton | 9 по вертикали | под высоту 40 dp ✔ |

### b4. Внутренний отступ карточки — пять значений по контексту — **средняя**

| Значение | Где |
|---|---|
| 0 | карточка в панели `styles/_panes.scss:155`; `--flow` на телефоне `_panes.scss:306` |
| 12 px | телефон, карточка со списком/поиском `styles/_tables.scss:109` |
| 16 px | телефон, карточка в `.tb-stack` `styles/_tables.scss:100` |
| 20 px | `tb-section-card` `styles/_panes.scss:183`; `settings/setup/steps/done-step.ts:92`, `portal-step.ts:104`, `settings/portal-settings-card.ts:446` |
| 20 / 24 px | p-card по умолчанию, пресет `:513` |

Правила каждое по отдельности обоснованы (ADR-0020, outlined card), но значения нигде не сведены:
нет токена «отступ поверхности» (M3 сам предлагает `surface-content.padding.horizontal` как
пример расширения для outlined cards и sheets).

### b5. Шапка страницы → первый контент — **средняя**

- Десктоп: `styles/_page-header.scss:13` `margin-bottom: space-4` (16) — margin на дочернем, M3
  советует gap на родителе.
- Телефон: `styles/_phone.scss:33` обнуляет `margin-bottom`, `:42` `padding: 0`, `:46` gap 12 —
  отдельная логика.
- Верх контента: `shell.scss:108` 8 px на десктопе без панелей; панели на десктопе — 0
  (`shell.scss:119`, `panes.ts:87`), на телефоне 8 (`panes.ts:244,249`). Три правила для одного
  места «под верхней панелью».

### b6. Отступ «подсказки под полем» (indent) — три значения — **низкая**

20 px: `admin/status/status-page.ts:307`, `admin/settings/settings-page.ts:501`,
`student-welcome-card.ts:52`, `bot-wizard-dialog.ts:287`, `google-calendar-panel.ts:251`,
`calendar-feed-panel.ts:83`, `drive-panel.ts:303`; 24 px: `homework-ai-panel.ts:562,813`;
40 px литерал: `homework/teacher/assignments-page.ts:343`.

### b7. Литералы и вне сетки — **низкая**

| Файл:строка | Значение | Оценка |
|---|---|---|
| `features/schedule/ui/schedule-calendar.scss:288` | gap `1.125rem` (18) | вне шкалы; M3 допускает `space225`, но токена нет |
| `features/schedule/ui/schedule-calendar.scss:496` | margin-block 1px | вне сетки |
| `shared/ui/steps.ts:162` | `calc(space-4 + 0.875rem)` (14) | выравнивание под иконку, лучше от размера иконки |
| `shared/ui/material-card.ts:124` | padding `2px … 2px …` | вложенная 2 dp |
| `shared/ui/filter-chips.ts:206-207` | ±6 px | вложенная 6 dp, литерал |
| `features/settings/portal-settings-card.ts:387,497` | gap 6px | литерал |
| `features/settings/portal-settings-card.ts:554,570` | gap 10px | литерал |
| `features/homework/student/quiz-player.ts:483` | gap 6px | литерал |
| `styles/_lists.scss:500` | gap `0.75rem` | = `space-3`, просто литерал |
| `features/boards/editor/board-page.ts:203` | `var(--tb-space-6, 2rem)` | запасное значение 32 ≠ токену 24 |
| `core/layout/shell.scss:159`, `side-nav.scss:175`, `nav-badge.ts:26` | бейдж: `4 2`, `0 2`, `0 4` | три варианта одного бейджа |
| 2 px gap ×≈15 (`_lists.scss:10,130,188,528`, `_buttons.scss:8,159`, `segment-group.ts:56`, `pane-nav.ts:57`, `section-nav.ts:89`, …) | 2px | **M3E** segmented/connected gap — значение верное, не хватает токена |

Не нарушения: инсеты touch target (`-0.5rem`) в чипах и кнопках, геометрия `time-picker.ts`.

### Что уже соответствует M3

Шкала 4 px; 24 dp spacer и поля панелей; 360/412 dp; диалоги 24/16/24/8; segmented list 2 dp
(M3E); connected button group 2 dp (M3E); button group 12 dp (M3E); кнопки 16 dp по бокам (M3E
small, пресет `:465`); пункты меню 10/16, gap 12 (M3E); чипы 8 dp; side sheet ≤ 400; текстовые поля
56 dp; global `styles/_phone.scss`, `_panes.scss`, `_sheets.scss`, `_page-header.scss` — только
токены.

---

## (c) План исправлений (стиль `docs/PLAN.md`, без правки PLAN)

Сначала общее, потом экраны. Каждый пункт — с `m3-expressive`, проверка в браузере на compact /
medium / expanded.

- [ ] **S.1 Ритм-токены и правило в design-system** — *simple*. `styles/_tokens.scss`: добавить
  `--tb-space-half` (2 px), `--tb-space-1-5` (6), `--tb-space-2-5` (10) как вложенные единицы M3;
  семантические `--tb-margin` (16 / 24 по окну), `--tb-gap-section` (24), `--tb-gap-title` (12),
  `--tb-gap-header` (16), `--tb-top-gap` (8 compact). `docs/design-system.md` §1 и §7 — таблица
  ритма из (a). Галерея `/gallery/tokens`. ADR: «ритм страницы».
- [ ] **S.1a Строка списка по M3E `List`** — *simple*. `styles/_lists.scss:21,130,145`: padding
  `--tb-space-2-5` (10) / `space-4`, column-gap `space-3` (12); проверить выравнивание subgrid,
  `tb-cards` (`_tables.scss` `row-cards`), галерею `/gallery/lists`, design-system §10
  («padding 10 / 16 px, 12 между колонками, **M3E**»). Зависит от S.1 (токен 10 px).
- [ ] **S.2 Одно поле экрана на телефоне** — *simple*. `core/layout/shell.scss:112` → 16 px по
  бокам (`--tb-margin`); `styles/_tables.scss:99-111` пересмотреть: карточка на телефоне без
  своей боковой рамки или с `space-4`, чтобы текст стоял на 16 px, как в панелях. Проверить
  страницы homework без панелей.
- [ ] **S.3 «Под верхней панелью» одним правилом** — *complex*. `shell.scss:108,119`,
  `shared/ui/panes.ts:87,214,244,249`, `styles/_page-header.scss:13`, `styles/_phone.scss:33-46`:
  один `--tb-top-gap`, шапка → контент — gap родителя (`--tb-gap-header`), а не margin шапки.
  Решить для десктопа: панели вплотную (0) или те же 8 px — отметить как *наше*.
- [ ] **S.4 `.tb-stack` как единственный ритм секций** — *complex*. `styles/_page-header.scss:106`
  → `gap: var(--tb-gap-section)`; в панели — тот же токен через `tb-pane__scroll`
  (`schedule-page.ts:430`, `my-schedule-page.ts:435` убрать свои gap). Решить 16 или 24 (M3 не
  задаёт; рекомендую 24 между секциями, 12 внутри).
- [ ] **S.5 Пресет на токенах** — *simple*. `core/theme/teacher-box-preset.ts`: литералы →
  `var(--tb-space-*)` / `{…}`; toast `0.875rem` → 12 или 16; card body → `--tb-surface-padding`.
- [ ] **S.6 Отступ поверхности карточки** — *simple*. Токен `--tb-surface-padding` (20 section
  card / 16 compact) для `_panes.scss:183`, `done-step.ts:92`, `portal-step.ts:104`,
  `portal-settings-card.ts:446`, пресет card.
- [ ] **E.1 Homework-экраны на общий ритм** — *simple*. `assignment-page.ts:336,343`,
  `my-task-page.ts:345`, `quiz-player.ts:303,311,483`, `editor-task.ts:195,229`,
  `question-editor.ts:540`, `question-section.ts:427,585`, `video-list.ts:55`,
  `video-section.ts:417`, `assignments-page.ts:343` — свои gap → `.tb-stack` / токены.
- [ ] **E.2 Главные и статус** — *simple*. `home/teacher-home.ts:115`, `home/student-home.ts:89`,
  `admin/status/status-page.ts:274,307`, `my-deadlines-widget.ts:103`.
- [ ] **E.3 Настройки и интеграции** — *simple*. `settings/settings-page.ts:256,293`,
  `portal-settings-card.ts:387,446,497,522,554,570`, `admin/settings/settings-page.ts:501`,
  панели интеграций (`google-calendar-panel.ts:251`, `calendar-feed-panel.ts:83`,
  `drive-panel.ts:303`, `bot-wizard-dialog.ts:287`), `identity/account/account-panel.ts:~343`;
  один indent подсказки (токен).
- [ ] **E.4 Мелочи общих компонентов** — *simple*. `schedule-calendar.scss:288,496`,
  `shared/ui/steps.ts:162`, `filter-chips.ts:206`, `material-card.ts:124`, `_lists.scss:500`,
  `board-page.ts:203` (fallback), бейджи `shell.scss:159` / `side-nav.scss:175` /
  `nav-badge.ts:26` к одному значению; 2 px → `--tb-space-half`.
- [ ] **E.5 Lint-страж** — *simple*. Stylelint: запрет литералов px/rem в
  `padding|margin|gap|inset` вне `_tokens.scss` и пресета (исключение — touch target), чтобы
  разнобой не вернулся.

---

Не проверено: шаблоны с `style=""` и многострочные шорткаты (поиск grep-ом по одной строке);
визуально в браузере ничего не смотрел (браузер занят другой сессией); строки с `~` взяты из
отчёта поиска без точной сверки.
