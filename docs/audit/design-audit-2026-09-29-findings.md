# Аудит интерфейса 2026-09-29. Раздел 4: находки

Часть отчёта [design-audit-2026-09-29.md](design-audit-2026-09-29.md). Здесь — все находки: 82 системные карточки
`DA-001…DA-082`, по убыванию серьёзности, внутри уровня — по разделам.

## Как читать карточку

**Пути.**
- Пути в коде — от `frontend/src/app/`.
- `styles.scss` — это `frontend/src/styles.scss`.
- «пресет» — это `core/theme/teacher-box-preset.ts`.
- Номера строк — версия 1.6.10, ветка `claude/teacher-box-ui-audit-2huqzl`.

**Скриншоты** названы `<участок>/<файл>.png`. Лежат в рабочем каталоге сессии аудита, в репозиторий не
добавлены (так требует задание). 1 143 снимка, каталоги по участкам — раздел 2 главного файла.

**Числа M3.** Сайт m3.material.io из окружения закрыт прокси, поэтому числа сверены по токенам Material 3:
- «сверено: MW `<файл>`» — токены Material Web 2.5.0 (Material 3 v34.0.21), `tokens/versions/latest/sass/`;
- «сверено: CMP `<файл>`» — исходники Compose Material3 (androidx-main);
- «по памяти, требует сверки» — значение из общих знаний о M3, источником не подтверждено.

**Серьёзность.**
- **Blocker** — срывает сценарий или важный текст нечитаем.
- **Blocker·WCAG** — формальное нарушение WCAG 2.2 A/AA, при котором у пользователя есть обходной путь. По
  определению задания это тоже Blocker; помечено отдельно, чтобы было проще расставить приоритеты.
- **Major** — заметное нарушение M3E или ADR, разнобой между экранами, лишние шаги в частом сценарии.
- **Minor** — шероховатость. **Nit** — полировка.

**Уровни.** A — нарушение правил проекта, B — расхождение с M3 Expressive, C — дефект UI/UX независимо от M3.

**Источники** — строка в конце карточки. Коды участков и что в них проверялось:

| Код | Участок |
|---|---|
| ST1 | кнопки и действия |
| ST2 | стили в компонентах и общие стили |
| ST3 | структура страниц |
| ST4 | тема PrimeNG против M3E |
| ST5 | справка и тексты |
| LV1 | каркас, темы, цвет портала, доступность |
| LV2 | кабинет учителя |
| LV3 | кабинет ученика |
| LV4 | администратор, вход, приглашение, первый запуск, пустые состояния |

## Оглавление

**Blocker — срывает сценарий или нечитаемо:**
[001](#da-001) · [002](#da-002) · [003](#da-003) · [004](#da-004) · [005](#da-005) · [006](#da-006) · [007](#da-007) ·
[008](#da-008)

**Blocker·WCAG:**
[009](#da-009) · [010](#da-010) · [011](#da-011) · [012](#da-012) · [013](#da-013) · [014](#da-014) · [015](#da-015) ·
[016](#da-016) · [017](#da-017) · [018](#da-018) · [019](#da-019)

**Major:**
[020](#da-020) … [051](#da-051)

**Minor:**
[052](#da-052) … [080](#da-080)

**Nit:**
[081](#da-081) · [082](#da-082)

---

## Blocker — срывает сценарий или нечитаемо

<a id="da-001"></a>
### DA-001. Окна в раскрытых секциях «Уведомлений» заперты внутри секции и уходят за край экрана

- **Серьёзность:** Blocker · **Уровень:** A · **Раздел:** компоненты, адаптивность
- **Где:** учитель, `/teacher/notifications?open=messengers`. Затронуты три окна:
  - «Мессенджеры» → «Подключить» (мастер бота);
  - окно кода «Мои мессенджеры»;
  - подтверждение «Отключить бота».

  Проверено на 390 и 1440 px, светлая тема.
- **Что сейчас:**
  - Затемнение (`.p-dialog-mask`) закрывает только тело секции, а не экран. На 1440×900 это прямоугольник
    304,299 размером 1112×1121.
  - Окно стоит в прямоугольнике 540,615 размером 640×490, его нижние 205 px — за краем экрана.
  - На 390×844 «полноэкранное» окно начинается с y = 544: видна только верхушка под нижней панелью.
  - Снимки: `LV2/dlg-bot-wizard-direct-1440.png` (проверен при сведении), `LV2/dlg-bot-wizard-direct-390.png`.
- **Причина:**
  - У тела раскрываемой секции анимация с `transform` и заполнением `both`:
    `shared/ui/fold-card.ts:168` — `animation: tb-fold-in var(--tb-spring-default-spatial) both`, кадры в `:171-176`.
  - Пока заполняющая анимация действует, элемент — containing block для потомков с `position: fixed`.
  - Окна PrimeNG рендерятся на месте, без `appendTo="body"`.
- **Как должно быть:**
  - модальное окно — по центру экрана, scrim на всё окно (ADR-0019 §Поверхности);
  - на телефоне — окно на весь экран (ADR-0015 §Мобильный интерфейс).
- **Почему важно:** подключение мессенджера — четвёртый шаг «С чего начать». На телефоне мастер практически
  недоступен, на компьютере его кнопки ниже края экрана.
- **Предложение:**
  - уровень общего компонента: в `fold-card.ts` заменить `both` на `backwards` (этого хватает для появления) или
    анимировать без `transform`;
  - дополнительно — `appendTo="body"` у окон внутри секций;
  - объём 1–4 строки, риск низкий;
  - добавить E2E «окно в раскрытой секции — по центру экрана».
- **Все вхождения:**
  - причина — `shared/ui/fold-card.ts:168-176`;
  - окна — `features/notifications/teacher/bot-wizard-dialog.ts:67`, `features/notifications/channels/channels-panel.ts:97`,
    `features/notifications/teacher/bots-panel.ts:96` (`p-confirmdialog`);
  - любое будущее окно внутри сворачиваемых `tb-fold-card` (`features/notifications/notifications-page.ts:69-107`).
- **Источники:** LV2-01.

<a id="da-002"></a>
### DA-002. Ошибка загрузки выглядит как «у вас ничего нет», сверху — стопка одинаковых тостов, повтора нет

- **Серьёзность:** Blocker · **Уровень:** C · **Раздел:** состояния, UX
- **Где:** все роли, страницы со списками и виджеты главных. Проверено при ответе 500 и при оборванной сети
  (abort), на 390 и 1440 px.
- **Что сейчас:**
  - **Ученик.** Главная без «Ближайшего занятия», заданий и баланса. В расписании — «На этой неделе занятий
    больше нет» и «Занятий нет». В заданиях — «Заданий пока нет. Здесь появятся задания от преподавателя».
    В оплатах — только заголовок. Снимки: `LV3/err-500-schedule-390-light.png`, `LV3/err-500-home-390-light.png`,
    `LV3/err-abort-homework-390-light.png`.
  - **Учитель.** «Ученики» — «Учеников пока нет. Добавьте первого ученика…» с кнопкой «Добавить ученика». Причина:
    `error: () => loading.set(false)` оставляет пустой массив. Снимок: `LV1/snackbar-error-students-390-light.png`.
  - **Администратор.** «Всё обработано.», «Все сообщения доставлены.», «Копий пока нет» видны и до загрузки, и
    после ошибки (`LV4/state-events-error-390.png`, `LV4/state-backups-error-390.png`).
  - **Тосты.** Интерцептор показывает тост на каждый запрос. На главной учителя пять одинаковых тостов
    «Внутренняя ошибка сервера. Код ошибки: …» закрывают экран телефона целиком. Снимок
    `LV1/error-500-teacher_teacher-390.png` проверен при сведении.
  - Кнопки «Повторить» нет нигде.
  - Неверный id задания открывает пустую страницу с одним тостом «Задание не найдено».
- **Как должно быть:**
  - ошибка — это отдельное состояние раздела с объяснением и «Повторить», а не пустое состояние;
  - одна причина — одно сообщение;
  - Нильсен №1 (видимость состояния системы) и №9 (помощь в распознавании ошибок и восстановлении после них);
  - M3: snackbar показывается по одному (по памяти, требует сверки).
- **Почему важно:**
  - ученик решит, что урока нет, и пропустит его;
  - учитель решит, что данные пропали, и заведёт учеников заново;
  - администратор при сбое видит «всё хорошо» — ровно на тех экранах, которые существуют, чтобы найти сбой.
- **Предложение:**
  - `shared/ui`: компонент `tb-load-error` — значок, «Не удалось загрузить», код, «Повторить»;
  - единое состояние страницы `loading | error | ready` (готовый образец — `features/identity/invite/invite-page.ts:28-31`);
  - интерцептор не показывает одинаковый тост второй раз;
  - для загрузок страниц ставить `SKIP_ERROR_TOAST` — страница сама показывает ошибку;
  - объём — около 20 компонентов, риск низкий, ADR не нужен (правило «ошибка загрузки — не пустое состояние»
    дописать в ADR-0018 §Секции).
- **Все вхождения:**
  - интерцептор: `core/http/api-error.interceptor.ts:16-30`, хост тостов `app.ts:10`;
  - кабинет ученика:
    - `features/home/student-home.ts:64, 67, 74`;
    - `features/schedule/student/my-schedule-page.ts:250, 327, 330, 342, 346` (пусто — `:77-82`);
    - `features/homework/student/my-homework-page.ts:107-109` (`#emptymessage` — `:72-81`);
    - `features/billing/student/my-billing-page.ts:58`;
  - виджеты и панели:
    - `features/schedule/home/next-lesson-widget.ts:100`;
    - `features/boards/student/my-boards-card.ts:55`;
    - `features/notifications/inbox/inbox-panel.ts:176-178`;
    - `features/notifications/home/latest-notifications-widget.ts:97`;
    - `features/schedule/ui/calendar-feed-panel.ts:107`;
  - кабинет учителя:
    - `features/identity/students/students-page.ts:240-246, 343-355`;
    - `features/homework/teacher/assignments-page.ts:98`;
    - `features/billing/teacher/billing-overview-page.ts:167`;
    - `features/notifications/teacher/student-messengers-panel.ts:29`;
    - `features/schedule/teacher/schedule-page.ts:208`;
  - администратор:
    - `features/admin/events/events-page.ts:31, 70, 129-130`;
    - `features/settings/backups/backups-card.ts:82, 166`;
    - `features/admin/status/status-page.ts:31`;
    - `features/admin/settings/settings-page.ts:103, 285`;
    - `features/admin/integrations/integrations-page.ts:73, 86`;
  - пустая страница с тостом: `features/homework/student/my-task-page.ts:42, 131-133`.
- **Источники:** LV3-01, LV1-05, LV4-06, LV3-20.

<a id="da-003"></a>
### DA-003. Код подключения мессенджера в тёмной теме нечитаем — 1,09 : 1

- **Серьёзность:** Blocker · **Уровень:** A · **Раздел:** цвет, доступность
- **Где:** тёмная тема, любая ширина. Затронуты:
  - ученик — «Уведомления» → «Подключить»;
  - учитель — мастер бота, шаг 3 и «Мои мессенджеры».
- **Что сейчас:**
  - `.tb-link-code__value { background: var(--p-surface-100) }`.
  - Палитра `surface` в пресете одна на обе темы (`scheme()` кладёт `surface: NEUTRAL` и в light, и в dark). Поэтому
    `--p-surface-100` и в тёмной теме светлый: #eef0f6.
  - Текст наследует on-surface тёмной темы: #e4e6ee.
  - Контраст 1,09 : 1. Код «3Z9G-TA9Z» на снимке `LV3/msg-code-dialog-390-dark.png` (проверен при сведении)
    почти не виден.
- **Как должно быть:** только роли `--p-md-*` (ADR-0017 §Цвет); WCAG 1.4.3 — не меньше 4,5 : 1.
- **Почему важно:** код — единственный способ подключить ВКонтакте и запасной для Telegram и MAX. Без него
  уведомления не подключить.
- **Предложение:**
  - страница, одна строка: `background: var(--p-md-surface-container-highest); color: var(--p-md-on-surface)`;
  - радиус — `var(--tb-shape-sm)`;
  - системно: запретить `--p-surface-N` и `--p-<палитра>-N` в стилях компонентов (правило stylelint или пункт ревью,
    см. DA-058).
- **Все вхождения:** `features/notifications/channels/link-code-view.ts:58-59`; компонент используется в
  `features/notifications/channels/channels-panel.ts:106` и `features/notifications/teacher/bot-wizard-dialog.ts:253`.
- **Источники:** ST2-01, ST3-02, ST4-03, LV3-02 (вживую — на временном инстансе с ботом).

<a id="da-004"></a>
### DA-004. Цвета статусов и сообщений остались от Aura: контраст 2,76–4,43 : 1, роли warning нет, один статус — разными цветами

- **Серьёзность:** Blocker · **Уровень:** A (ADR-0017: «весь интерфейс перекрашивается одним пресетом», семантика —
  через роли) + B · **Раздел:** цвет, компоненты
- **Где:**
  - все `p-message` (54 вхождения в 33 файлах);
  - `p-tag` с severity `info` и `warn`;
  - `p-badge` с severity `warn` и без severity;
  - индикатор силы пароля.

  Светлая тема — все провалы контраста, тёмная — часть.
- **Что сейчас:**
  - В пресете переопределены только:
    - `tag` primary, secondary, success, danger (`TAG_SCHEME`, `пресет:307-312`);
    - `badge` danger (`:683-696`);
    - у `message` — только радиус (`:564-566`).
  - Всё остальное — палитры Aura (blue, sky, yellow, orange, green, red). Они не следуют ни ролям M3, ни цвету портала.
  - Замеры контраста:

    | Элемент | Светлая | Тёмная |
    |---|---|---|
    | `p-message warn` — yellow-600 #ca8a04 на #fefce9, 16 px/500 | **2,84 : 1** | проходит |
    | `p-message success` — «Работа принята» | **3,13–3,16 : 1** | — |
    | `p-message error` — «Неверный логин или пароль» | **4,43 : 1** | **3,94 : 1** |
    | `p-message info` | — | **3,91 : 1** |
    | `p-badge warn` «66» — белый 11 px на orange-500 | **2,76–2,80 : 1** | — |
    | `p-tag info` — sky-700 на sky-100 | 5,17 : 1 (читается) | 16 % заливки |
    | `p-tag warn` — orange-700 на orange-100 | 4,52 : 1 (читается) | 16 % заливки |

    Теги info и warn читаются, но они голубые и оранжевые при любом цвете портала. В тёмной теме у них заливка
    16 %, а у success и danger — непрозрачные контейнеры M3.
  - Где предупреждения на 2,84 : 1 видны постоянно:
    - в «Настройках» учителя: адрес портала, совет по своему цвету;
    - в мастере первого запуска, шаг «Адрес»;
    - в «Состоянии» администратора.
  - В окнах занятия — только при событии: «Время пересекается…».
  - У возвращённой работы ученика комментарий учителя стоит в жёлтом блоке «Нужно доработать» — 2,83 : 1
    (`LV3/lv3-task-returned-390-light.png`).
  - **Разнобой одного статуса:**
    - `warn` жёлтый в `p-message`, оранжевый в `p-tag` и `p-badge`;
    - «Запланировано» в тегах голубое (info), а в календаре — primary-container;
    - «На доработке» красное на странице задания, «На доработку» оранжевое в виджете главной;
    - счётчики `p-badge` трёх цветов: danger у колокольчика, warn у «На проверку», primary у секций уведомлений.
- **Как должно быть:**
  - ADR-0017 §Цвет — семантические токены ссылаются на роли; ADR-0019 §Цвет — success как custom color M3;
  - WCAG 1.4.3;
  - в M3 роли warning нет, её заводят как custom color — так же, как в проекте сделан success;
  - M3 badge — цвет error / on-error (сверено: MW `_md-comp-badge.scss`).
- **Почему важно:**
  - предупреждения о пересечении занятий, адресе портала и восстановлении копии, ошибки форм и комментарий учителя
    — самый важный текст на экране, а читается он хуже всего;
  - половина статусов выглядит как чужая дизайн-система и не меняется с цветом портала.
- **Предложение** (уровень пресета, около 40 строк, риск низкий):
  - роли warning / on-warning / warning-container / on-warning-container, например amber.700 / белый / amber.100 /
    amber.900 в светлой теме. Нужна строка в ADR-0019 §Цвет;
  - `tag`, `message`, `badge` для info, warn, success, error, secondary — на контейнеры ролей;
  - сообщения — без обводки;
  - `badge` по умолчанию — error; для «спокойного» счётчика — secondary-container;
  - info → secondary-container или tertiary-container;
  - индикатор пароля — на ролях;
  - одна таблица «статус → severity» для тегов, календаря и виджетов (`schedule-labels.ts`, `homework-labels.ts`).
- **Все вхождения:**
  - пресет: `:307-312, 564-566, 683-696`;
  - теги info и warn:
    - `features/schedule/schedule-labels.ts:18, 20, 32, 34, 41`;
    - `features/homework/homework-labels.ts:13-14`;
    - `features/identity/students/student-status.ts:12`;
    - `features/admin/admin-labels.ts:13, 15`;
    - `features/ai/ai-usage-page.ts:45`;
    - `features/admin/settings/settings-page.ts:112, 115`;
    - `features/notifications/notification-labels.ts:87`;
    - `features/settings/settings-page.ts:72`;
    - `features/settings/backups/backups-card.ts:102`;
    - `features/billing/ledger/ledger-table.ts:56`;
    - `features/billing/teacher/monthly-report-page.ts:157`;
    - `features/schedule/teacher/schedule-page.ts:126`;
    - `features/homework/home/my-deadlines-widget.ts:45`;
    - `features/homework/student/my-task-page.ts:62`;
    - `features/meetings/settings/meetings-settings-panel.ts:40-42`;
    - `features/schedule/teacher/google-calendar-panel.ts:43-45`;
  - бейджи: `features/homework/teacher/assignments-page.ts:50` (warn), `shared/ui/fold-card.ts:61` (primary),
    `core/notifications/notification-bell.ts:22-23` (danger);
  - `p-message` warn:
    - `core/portal/portal-address-warnings.ts:13`;
    - `features/settings/setup/setup-page.ts:155`;
    - `features/admin/settings/settings-page.ts:99`;
    - `features/admin/logs/log-page.ts:107`;
    - `features/settings/backups/restore-dialog.ts:116`;
    - `features/settings/portal-settings-card.ts:137, 141`;
    - `features/meetings/settings/meetings-settings-panel.ts:102`;
    - `features/schedule/teacher/lesson-details-dialog.ts:119, 127`;
    - `features/schedule/teacher/google-calendar-panel.ts:125`;
    - `features/schedule/teacher/series-dialog.ts:175`;
    - `features/schedule/teacher/lesson-dialog.ts:132`;
    - `features/schedule/teacher/request-answer-dialog.ts:86`;
    - `features/schedule/student/change-request-dialog.ts:72, 77`;
  - остальные 38 `p-message` (error 28, success 4, info 3, динамические 3) и чем каждый должен быть в M3 — в
    [m3e-ux.md §3.1](design-audit-2026-09-29-m3e-ux.md#p-message).
- **Источники:** ST2-02, ST3-04, ST4-01, ST4-06, ST4-08, LV1-12, LV2-02, LV3-04, LV3-11, LV4-02.

<a id="da-005"></a>
### DA-005. События календаря — захардкоженные зелёный и оранжевый с белым текстом: 3,30 и 2,80 : 1

- **Серьёзность:** Blocker · **Уровень:** A + C · **Раздел:** цвет, доступность
- **Где:** «Расписание» учителя и ученика, виды «Неделя», «Месяц», «Список», обе темы.
- **Что сейчас:**

  | Статус | Цвета | Контраст |
  |---|---|---|
  | «Проведено» | `#fff` на `--p-green-600` | **3,30 : 1**, одинаково в обеих темах |
  | «Пропуск» | `#fff` на `--p-orange-500` | **2,80 : 1** |
  | «Отменено» | `opacity: 0.7` на surface-container-highest | **2,6–2,97 : 1** |
  | Запрос ученика | пунктир `2px dashed var(--p-orange-500)` | **2,76 : 1** к карточке (WCAG 1.4.11 требует 3 : 1) |

  - Текст событий FullCalendar мелкий — 11–12 px/400.
  - Фоновые события не зависят от темы: `--p-green-500`, `.tb-busy` на `--p-surface-500`, `.tb-off-time` на `--p-surface-400`.
  - Роли success и success-container есть (ADR-0019), но календарь их не использует.
  - При этом запланированное занятие на primary-container читается хорошо: 9,27 : 1.
  - Снимки: `ST4/calendar-week-light.png`, `ST4/calendar-week-dark.png`, `ST2/event-conducted-light.png`.
- **Как должно быть:** ADR-0017 §Цвет — цвета только из ролей; ADR-0019 — роль success; WCAG 1.4.3 и 1.4.11.
- **Почему важно:** неделя — главный рабочий экран учителя. Проведённые и пропущенные занятия — самые частые
  метки, и читаются они хуже всего.
- **Предложение** (`styles.scss`, около 15 строк, ADR не нужен):
  - «Проведено» → `--p-md-success-container` / `--p-md-on-success-container` (8,30 : 1);
  - «Пропуск» → warning-container из DA-004 или error-container;
  - «Отменено» → on-surface-variant на surface-container-highest без `opacity` (≈ 5,6 : 1), зачёркивание оставить;
  - запрос → обводка ролью, не меньше 3 : 1;
  - занятость и нерабочее время → `--p-md-outline` и `--p-md-outline-variant`.
- **Все вхождения:**
  - `styles.scss:1129` (green-500);
  - `styles.scss:1236-1239` (conducted), `:1241-1244` (missed), `:1246-1251` (cancelled), `:1253-1256` (request);
  - `styles.scss:1258-1275` (busy, off-time);
  - на главной — `features/schedule/home/today-lessons-widget.ts:117-120` (отменённое с `opacity: 0.7`).
- **Источники:** ST2-03, ST4-04, LV1-12, LV2-02.

<a id="da-006"></a>
### DA-006. Нижний лист занятия и панель справки не модальны: с клавиатуры действия занятия недостижимы

- **Серьёзность:** Blocker (клавиатура и скринридер) · **Уровень:** A (ADR-0022: лист — M3 bottom sheet) + C ·
  **Раздел:** доступность, компоненты
- **Где:**
  - ученик, 360 и 390 px, «Расписание» → строка занятия → нижний лист;
  - «?» справки на любой странице, все ширины.
- **Что сейчас:**
  - После Enter лист открыт, но фокус остаётся на шевроне строки — под scrim, кольцо видно сквозь затемнение.
  - 14 нажатий Tab проходят по странице под листом: следующие занятия, «Пред», «След», события, «Список», «День»,
    «Месяц», доски. В лист Tab не попадает ни разу.
  - Лист: `role="complementary"`, нет `aria-modal` и `aria-labelledby`, прокрутка страницы не заблокирована.
  - После Esc фокус уходит в календарь, а не на строку.
  - Панель «?» ведёт себя так же.
  - Для сравнения: `p-dialog` удерживает фокус правильно — 14 Tab циклически внутри окна.
  - Снимок `LV1/sheet-anna-390-light.png`; данные `LV3/sheet-390-light.json` (поле `tabsInSheet`).
- **Как должно быть:**
  - модальный нижний лист M3 ведёт себя как диалог: фокус внутри, ловушка фокуса, Esc, возврат на вызвавший элемент
    (по памяти, требует сверки);
  - WCAG 2.4.3 (Focus Order), 1.3.1, 4.1.2.
- **Почему важно:** «Подключиться», «Перенести», «Отменить» с клавиатуры недоступны, пока не пройдёшь всю страницу.
  Скринридер не сообщает, что открылось окно. Для ученика это главный способ войти в урок из расписания на телефоне.
- **Предложение:**
  - общий компонент `tb-sheet` в `shared/ui` вместо ручной сборки `p-drawer`;
  - в нём `[modal]="true"`, `[blockScroll]="true"`, `role="dialog"`, `aria-modal="true"`, `ariaLabelledBy` на заголовок;
  - фокус на первую кнопку при открытии, возврат на строку при закрытии (API PrimeNG 21 сверить);
  - два места, риск низкий.
- **Все вхождения:** `features/schedule/student/my-schedule-page.ts:176-207`; `features/help/help-button.ts:34-48`; стили
  `styles.scss:1778-1810`.
- **Источники:** LV1-04, LV3-06.

<a id="da-007"></a>
### DA-007. Фокус клавиатуры в навигации почти не виден, а на активном разделе не виден совсем

- **Серьёзность:** Blocker (WCAG 2.4.7 — фокус теряется в главной навигации) · **Уровень:** A (ADR-0017 §Состояния:
  «Фокус с клавиатуры — кольцо 2 px primary») · **Раздел:** доступность, навигация, состояния
- **Где:** все роли, обе темы, три вида навигации: развёрнутый rail (от 1200 px), rail (769–1199 px), нижняя панель
  (до 768 px).
- **Что сейчас:**
  - У пунктов навигации нет кольца фокуса.
  - Развёрнутый rail:
    - фокус — слой on-surface 8 % на `.p-menu-item-content`;
    - таблетка активного раздела — `::before` с `z-index: -1` внутри `isolation: isolate` — рисуется поверх этого слоя;
    - поэтому активный пункт с фокусом не отличается от активного без фокуса. Снимок
      `LV1/focus-sidenav-active-focused-1440-light.png` проверен при сведении: фокус стоит на «Расписании», а
      визуально фокуса нет;
    - на соседнем пункте фокус — серая таблетка примерно 1,1 : 1 к фону.
  - Rail и нижняя панель:
    - у активного пункта с фокусом индикатор secondary-container заменяется серым 8 %;
    - активный раздел «гаснет», а сам фокус почти не виден.
  - У нижней панели `outline` снят явно: `&:focus-visible { outline: none }`.
- **Как должно быть:**
  - ADR-0017 §Состояния; WCAG 2.4.7;
  - M3: индикатор фокуса 3 px, отступ 2 px, у навигации — цвета secondary (сверено: MW
    `_md-sys-state-focus-indicator.scss`, `_md-comp-navigation-bar.scss`).
- **Почему важно:** без мыши не понять, где находишься, особенно на своём разделе. Навигация — первое, по чему
  идёт Tab.
- **Предложение:**
  - общий стиль, около 20 строк, риск низкий;
  - кольцо `outline: 2px solid var(--p-md-primary); outline-offset: 2px` у `.p-menu-item.p-focus > .p-menu-item-content`
    в rail и у `.tb-bottom-nav__item:focus-visible .tb-bottom-nav__icon`;
  - слой 8 % класть поверх индикатора активного раздела, а не вместо него:
    `color-mix(… 8 %, var(--p-md-secondary-container))`.
- **Все вхождения:**
  - `core/layout/side-nav.scss:28-47` (слой и `::before` индикатора), `:66-76` (активный пункт);
  - `core/layout/side-nav.scss:89-99` (rail: при `p-focus` индикатор снимается), `:120-128`;
  - `core/layout/shell.scss:121-128` (нижняя панель, `outline: none`), `:159-167`;
  - пресет `navigation.item.focusBackground` — `:184-196`.
- **Источники:** LV1-01.

<a id="da-008"></a>
### DA-008. «Уведомления» на 360 px шире экрана: адрес встречи в тексте не переносится

- **Серьёзность:** Blocker (WCAG 1.4.10 Reflow — страница прокручивается вбок) · **Уровень:** A (ADR-0021 §Переносы:
  `anywhere` — для адресов) · **Раздел:** адаптивность
- **Где:** ученик, `/cabinet/notifications`, у anna, kon и yan:
  - 360 px — страница шириной 385 px;
  - 390 px — текст вылезает из плитки (385 > 366).

  Раздел «Входящие» общий с учителем, у него то же самое.
- **Что сейчас:**
  - Текст «Ссылка на урок: https://telemost.yandex.ru/j/98765432109876» — одно «слово».
  - У `.tb-list__text` стоит `align-items: flex-start`, у `.tb-list__supporting` — `overflow-wrap: break-word`, а он не
    уменьшает min-content.
  - В итоге плитка растёт, страница едет вбок, заголовок и логотип срезаны слева.
  - Снимки: `LV3/notif-url-overflow-360-light.png`, `LV3/notif-url-overflow-390-light.png`.
  - Штатный замер `L.audit` этого не видит: с `isMobile` окно само расширяется до 385 px.
- **Как должно быть:** ADR-0021 §Переносы; WCAG 1.4.10.
- **Почему важно:** на самом частом телефоне Android (360 px) весь раздел «ездит» вбок.
- **Предложение:**
  - `overflow-wrap: anywhere` для тела уведомления — там адреса;
  - либо `min-width: 0; max-width: 100%` у потомков `.tb-list__text`;
  - общий класс, риск низкий.
- **Все вхождения:** `features/notifications/inbox/inbox-panel.ts:54, 113-115`; `styles.scss:667-675` (`.tb-list__text`),
  `:687-691` (`.tb-list__supporting`).
- **Источники:** LV3-03.

---

## Blocker·WCAG — формальное нарушение WCAG 2.2 A/AA с обходным путём

<a id="da-009"></a>
### DA-009. Красный текст ролью error и приглушённое прозрачностью ниже 4,5 : 1

- **Серьёзность:** Blocker·WCAG (1.4.3) · **Уровень:** B + C · **Раздел:** цвет
- **Где:** светлая тема. Затронуты:
  - плитки списков `--tb-list-item`, карточка «Ближайшее занятие» (primary-container), фон страницы;
  - «Оплаты», «Отчёт», «Задания».
- **Что сейчас:**
  - **Роль error = `{red.600}` #dc2626** (`пресет:51`). Живые замеры:

    | Где | Контраст |
    |---|---|
    | на плитке списка | **4,36 : 1** |
    | на плитке при наведении | **4,02 : 1** |
    | на фоне страницы | **4,24 : 1** |
    | на карточке «Ближайшее занятие» | **3,91–3,92 : 1** |
    | на белой карточке | 4,75 : 1 (проходит) |

    Затронуты:
    - суммы долга на главной, в «Оплатах» и в истории оплат («−1 500 ₽»);
    - кнопки ученика «Отменить», «Не приду», «Отозвать»;
    - просроченный срок;
    - `tb-negative` в строке подробностей заголовка.

    axe `color-contrast` сработал на главной, в «Оплатах», расписании и заданиях ученика.
  - `.tb-integration-error { color: var(--p-red-500) }` — 3,70–3,76 : 1 на карточке.
  - Роль success (green.700) на плитке — 4,53 : 1, впритык.
  - **Приглушение `opacity` вместо роли:**
    - `.tb-inactive td { opacity: .55 }` — строка «Ошибочный платёж» в отчёте: 3,72 : 1, приглушённый текст 2,19 : 1
      (`ST2/report-inactive-row-1440.png`);
    - отменённые занятия — `opacity: .7`;
    - старые ответы — `.tb-submission--old { opacity: .75 }`.

    Исключение WCAG касается только неактивных элементов управления, а это данные.
- **Как должно быть:** WCAG 1.4.3; в M3 error — тон 40 (сверено: MW `_md-sys-color.scss`: error = error40), он темнее
  red.600; приглушают ролью on-surface-variant, а 38 % — только для отключённых элементов управления.
- **Почему важно:** долг и «Отменить» — главные красные надписи, и они читаются хуже соседнего текста. Отменённый
  платёж — тоже данные: учитель сверяет по нему суммы.
- **Предложение:**
  - пресет, одна строка: `error: '{red.700}'`. Даст 5,84 : 1 на плитке и 5,25 : 1 на hero; белый на red.700 — 6,47 : 1,
    лучше, чем сейчас;
  - `.tb-integration-error` → `var(--p-md-error)`;
  - `.tb-inactive td`, отменённые, старые ответы → `color: var(--p-md-on-surface-variant)` без `opacity`,
    зачёркивание оставить;
  - нового ADR не нужно (уточнение ADR-0017 §Цвет).
- **Все вхождения:**
  - пресет: `:51`;
  - `styles.scss:919-921` (`.tb-negative`), `:537` (`.tb-error`), `:931-934` (`.tb-inactive`), `:1032-1034`
    (`.tb-submission--old`), `:1246-1251`;
  - `features/settings/settings-page.ts:198`;
  - `features/schedule/home/today-lessons-widget.ts:117-120`;
  - `features/schedule/ui/lesson-actions.ts:33-40`;
  - `features/schedule/student/my-schedule-page.ts:118-124`;
  - `features/billing/ledger/ledger-table.ts:66`;
  - `features/billing/ledger/balance-amount.ts:28`;
  - `features/billing/home/finance-widget.ts:25, 46`;
  - `features/homework/student/my-homework-page.ts:60`;
  - `features/homework/student/my-task-page.ts:49`;
  - `features/admin/integrations/integrations-page.ts:107`;
  - `features/admin/status/status-page.ts:76`;
  - `features/notifications/teacher/bots-panel.ts:104`.
- **Источники:** ST2-04, ST2-05, ST4-05, LV1-12, LV2-02, LV3-05.

<a id="da-010"></a>
### DA-010. Цвет портала: «Бирюзовый», «Изумрудный» и свои светлые цвета не дают 4,5 : 1; проверка смотрит одну пару с порогом 3 : 1; красный портал не отличить от «Удалить»

- **Серьёзность:** Blocker·WCAG (1.4.3, 1.4.11 — при этих цветах) · **Уровень:** A (ADR-0015: «Готовые палитры
  гарантируют контраст в обеих темах») + C · **Раздел:** цвет
- **Где:** светлая тема, все экраны. Код:
  - `core/theme/portal-accent.ts`: `:7-14` (ACCENTS), `:24` (`MIN_CONTRAST = 3`), `:55-61` (`ownColorContrast`),
    `:67-87` (`isGreenAccent`);
  - роли в пресете — `:41-44, 76-79`.
- **Что сейчас:** замер по живым ролям, 5 готовых и 6 своих цветов × 2 темы (полная таблица — в
  [m3e-ux.md §2](design-audit-2026-09-29-m3e-ux.md#portal-colors)).

  | Цвет | Белый на primary | Ссылка на карточке | Ссылка на плитке | Ссылка на hero | Кольцо фокуса |
  |---|---|---|---|---|---|
  | teal | **3,74** | **3,70** | **3,39** | **3,32** | — |
  | emerald | **3,77** | **3,72** | **3,41** | **3,32** | — |
  | pink | 4,60 | 4,54 | **4,16** | **3,91** | — |
  | blue | — | — | — | **4,24** | — |
  | свой #fbc02d | **2,31** | **2,27** | **2,09** | **2,04** | **2,03 < 3 : 1** |
  | свой #ff9800 | **2,96** | — | — | — | — |

  - У #fbc02d в тёмной теме FAB и hero — **4,47**, ссылка на hero — **4,05**, inverse-primary — **1,85**.
  - Проверка сравнивает только «белый на 600» и «900 на 200» с порогом **3 : 1**. Подпись кнопки — Label Large
    14 px/500, это не крупный текст: нужен порог 4,5 : 1.
  - Готовые палитры не проверяются вовсе.
  - Различимость с кнопками-смыслами — предупреждение только для зелёного (`isGreenAccent`, оттенки 75–165°):
    - свой #e53935: разница primary↔error ΔE **4,8** в светлой и **1,6** в тёмной — главная кнопка выглядит как
      «Удалить», предупреждения нет;
    - teal: ΔE primary↔success 10,7 / 7,7 — ближе к зелёному, чем тёмная emerald, но оттенок 175° не попадает
      в проверку.

    ΔE — разница цветов в OKLab × 100: около 2 — порог заметности, меньше 10 — «похожие».
  - При протанопии и дейтеранопии success и error различаются слабо: ΔE 9,6 и 8,6, в тёмной теме при
    дейтеранопии — 5,7. Кнопки при этом различимы формой и подписью: filled «Сохранить» против text «Отмена».
  - Снимки: `LV1/color-emerald-schedule-1440-light.png`, `LV1/color-xfbc02d-schedule-1440-light.png`,
    `LV1/color-x2e7d32-dialog-student-1440-light.png`.
- **Как должно быть:** WCAG 1.4.3 (4,5 : 1), 1.4.11 (3 : 1 для кольца фокуса); в M3 primary = тон 40, контраст с белым
  гарантирован тоном, а не номером оттенка палитры (сверено: MW `_md-sys-color.scss`: primary = primary40).
- **Почему важно:** учитель выбирает готовый «Изумрудный», а бледные кнопки и ссылки получают все ученики — без
  всякого предупреждения. При красном портале каждая главная кнопка выглядит опасной.
- **Предложение:**
  - пресет и `portal-accent.ts`, средний риск;
  - primary светлой темы строить из тона: `oklch(from {primary.500} ~0.5 C h)`, как уже построены нейтрали. Или брать
    700 для teal и emerald: 5,47 : 1;
  - `ownColorContrast` — порог 4,5 : 1 и пары primary / карточка, primary / плитка, primary / фон,
    on-primary-container / primary-container, inverse-primary в обеих темах. Готовые палитры проверять так же;
  - вместо `isGreenAccent` — расстояние ΔE до success и error обеих тем, например «предупредить при ΔE < 12»;
  - правка ADR-0015 и ADR-0017: порог 3 : 1 → 4,5 : 1.
- **Все вхождения:**
  - `core/theme/portal-accent.ts:7-14, 24, 55-61, 67-87`;
  - `features/settings/portal-settings-card.ts:136-145, 284-297`;
  - пресет `:41-44, 71, 76-79, 106`;
  - `styles.scss:802-815` (ссылки primary).
- **Источники:** ST4-02, LV1-02, LV1-13.

<a id="da-011"></a>
### DA-011. Заголовки секций — не заголовки: на 33 из 36 страниц единственный заголовок — h1

- **Серьёзность:** Blocker·WCAG (1.3.1, 2.4.6) · **Уровень:** A + C · **Раздел:** доступность, структура
- **Где:** все роли, все страницы с `p-card`, любая ширина и тема.
- **Что сейчас:**
  - PrimeNG 21.1.10 выводит `header="…"` и шаблон `#title` в `<div class="p-card-title">`
    (`primeng/fesm2022/primeng-card.mjs:203`).
  - Обход 36 маршрутов: кроме h1 заголовков нет. Исключения:
    - «Уведомления» учителя — h2 из `tb-fold-card`;
    - справка — h2 статьи;
    - мастер настройки;
    - заголовок FullCalendar `div[role=heading][aria-level=2]` «сент. 2026 г. – окт. 2026 г.».
  - На «Расписании» единственный h2 — диапазон дат календаря. «Запросы учеников», «Регулярные занятия» — просто
    текст 22 px/500.
  - Ещё:
    - на «Входе» и «Приглашении» заголовков нет совсем: «Вход в Teacher Box» — `div.p-card-title`;
    - 404 — `<h1>404</h1>` без `main`;
    - h3 «Материалы» идёт сразу после h1;
    - разделы статей справки (`##` в Markdown) — h2 того же уровня, что и заголовок статьи.
- **Как должно быть:** WCAG 1.3.1 (техника H42, провал F2), 2.4.6; иерархия h1 → h2 (секция) → h3 (подсекция).
- **Почему важно:** навигация по заголовкам (H в NVDA и VoiceOver) не находит ни одной секции: «Требует внимания»
  или «Оплаты» за одно нажатие не найти.
- **Предложение:**
  - один раз для всех: глобальный pass-through PrimeNG
    `providePrimeNG({ pt: { card: { title: { role: 'heading', 'aria-level': '2' } } } })` (API pt в PrimeNG 21 сверить)
    или `h2` внутри `tb-card-title`;
  - карточки внутри `tb-fold-card` — уровень 3;
  - вход и приглашение — `#title` с `h1`;
  - в `renderMarkdown` для статей сдвигать уровни на 1 (`##` → h3);
  - риск низкий, уточнение ADR-0018 §Секции.
- **Все вхождения** — около 65 карточек с видимым заголовком без семантики:
  - identity:
    - `features/identity/account/account-page.ts:29, 73`;
    - `features/identity/login/login-page.ts:22`;
    - `features/identity/invite/invite-page.ts:56, 65`;
    - `features/identity/groups/groups-panel.ts:66`;
  - ai: `features/ai/ai-usage-page.ts:87, 108`;
  - admin:
    - `features/admin/events/events-page.ts:25, 69`;
    - `features/admin/settings/settings-page.ts:104` (12 групп);
    - `features/admin/logs/logger-levels-panel.ts:28`;
    - `features/admin/integrations/integrations-page.ts:39, 72`;
    - `features/admin/status/portal-address-card.ts:19`;
    - `features/admin/diagnostics/diagnostics-page.ts:21, 35`;
  - meetings: `features/meetings/settings/meetings-settings-panel.ts:71`;
  - notifications:
    - `features/notifications/channels/channels-panel.ts:35`;
    - `features/notifications/home/latest-notifications-widget.ts:19`;
    - `features/notifications/teacher/bot-abilities-panel.ts:14`;
    - `features/notifications/teacher/student-messengers-panel.ts:26`;
    - `features/notifications/teacher/bots-panel.ts:21`;
    - `features/notifications/preferences/preferences-panel.ts:43`;
    - `features/notifications/student/connect-messenger-card.ts:27`;
  - settings:
    - `features/settings/backups/backups-card.ts:59`;
    - `features/settings/reset-card.ts:26`;
    - `features/settings/portal-settings-card.ts:55`;
    - `features/settings/settings-page.ts:61, 125, 155`;
  - billing:
    - `features/billing/home/my-balance-widget.ts:16`;
    - `features/billing/home/finance-widget.ts:17`;
    - `features/billing/teacher/student-ledger-page.ts:132`;
    - `features/billing/teacher/monthly-report-page.ts:90, 129, 175`;
    - `features/billing/student/my-billing-page.ts:46`;
  - home:
    - `features/home/student-welcome-card.ts:18`;
    - `features/home/attention-card.ts:22`;
    - `features/home/first-run-checklist.ts:36`;
  - boards: `features/boards/student/my-boards-card.ts:14`;
  - schedule:
    - `features/schedule/ui/calendar-feed-panel.ts:29`;
    - `features/schedule/home/today-lessons-widget.ts:29`;
    - `features/schedule/home/next-lesson-widget.ts:30`;
    - `features/schedule/home/upcoming-lesson-widget.ts:15`;
    - `features/schedule/teacher/google-calendar-panel.ts:74`;
    - `features/schedule/teacher/schedule-page.ts:116, 148, 206, 244`;
    - `features/schedule/student/my-schedule-page.ts:76, 135`;
  - homework:
    - `features/homework/home/my-deadlines-widget.ts:15`;
    - `features/homework/teacher/assignment-page.ts:91, 97, 118`;
    - `features/homework/teacher/task-review-page.ts:64, 69, 139, 145`;
    - `features/homework/student/my-task-page.ts:74, 83, 106`;
  - прочее:
    - `features/notifications/teacher/bot-abilities-panel.ts:23, 35` (h3 без h2);
    - `features/help/help-page.ts:79` и `shared/ui/markdown-view.ts:5-7` (уровни статьи);
    - `core/pages/not-found.ts:11-17`.
- **Источники:** ST3-01, ST3-10, ST3-14, ST5-18, LV4-15, LV1-24.

<a id="da-012"></a>
### DA-012. Кнопка «×» всех окон и листов без доступного имени; служебные подписи PrimeNG и FullCalendar — по-английски

- **Серьёзность:** Blocker·WCAG (4.1.2, 3.1.2) · **Уровень:** C · **Раздел:** доступность, тексты
- **Где:** все роли, все `p-dialog` (22), `p-confirmdialog` (7), `p-drawer` (2), тосты, `p-select`, календарь.
- **Что сейчас:**
  - `button.p-dialog-close-button` 40×40 без `aria-label` и без текста. В обходе Tab он пустой; axe `button-name`
    (critical) — `LV4/a11y-restore-1440-light.png`, `LV4/a11y-confirm-delete-1440-light.png`.
  - PrimeNG берёт имя только из входа `closeAriaLabel` (`primeng-dialog.mjs:1083`), в проекте его нигде не задают.
  - Где PrimeNG берёт подпись из перевода, она английская: в `core/i18n/primeng-ru.ts:4-102` нет блока `aria`.
    Примеры: «Close» у тоста, «dropdown trigger» у `p-select`, «Events» и «Timed» у FullCalendar.
- **Как должно быть:** WCAG 4.1.2 (у каждой кнопки есть имя), 3.1.2 (язык частей); ADR-0018 — кнопка-значок с подсказкой.
- **Почему важно:** в каждом окне, в том числе опасном, скринридер читает «кнопка» или «Close». Закрыть окно голосом
  нельзя.
- **Предложение:**
  - дополнить `PRIMENG_RU` блоком `aria` по `TranslationKeys.ARIA`: close «Закрыть», previous, next, navigation и другие;
  - `closeAriaLabel="Закрыть"` у `p-dialog` и `ariaCloseLabel` у `p-drawer` — через директиву в `shared/ui`;
  - FullCalendar — `buttonHints`, `viewHint`, `eventHint` на русском;
  - один файл и около 30 мест, проверка axe в E2E.
- **Все вхождения:**
  - `core/i18n/primeng-ru.ts:4-102`;
  - `p-dialog`:
    - identity: `features/identity/students/invite-link-dialog.ts:24`, `features/identity/students/student-form-dialog.ts:28`,
      `features/identity/groups/group-form-dialog.ts:38`;
    - ai и admin: `features/ai/homework-draft-dialog.ts:28`, `features/admin/settings/settings-page.ts:171`;
    - meetings: `features/meetings/rooms/room-dialog.ts:37`;
    - notifications: `features/notifications/channels/channels-panel.ts:97`,
      `features/notifications/teacher/broadcast-dialog.ts:43`, `features/notifications/teacher/bot-wizard-dialog.ts:67`;
    - settings: `features/settings/backups/restore-dialog.ts:33`, `features/settings/reset-card.ts:50`;
    - billing и boards: `features/billing/teacher/payment-dialog.ts:42`, `features/boards/manage/boards-dialog.ts:32`,
      `features/boards/to-board/to-board-dialog.ts:38`;
    - schedule: `features/schedule/teacher/lesson-details-dialog.ts:58`, `features/schedule/teacher/series-dialog.ts:57`,
      `features/schedule/teacher/off-time-dialog.ts:47`, `features/schedule/teacher/lesson-dialog.ts:60`,
      `features/schedule/teacher/attendance-dialog.ts:43`, `features/schedule/teacher/request-answer-dialog.ts:34`,
      `features/schedule/student/change-request-dialog.ts:32`;
    - homework: `features/homework/teacher/assignment-dialog.ts:56`;
  - `p-confirmdialog`:
    - `features/homework/teacher/assignment-page.ts:195`;
    - `features/schedule/teacher/schedule-page.ts:325`;
    - `features/settings/backups/backups-card.ts:145`;
    - `features/billing/teacher/student-ledger-page.ts:149`;
    - `features/notifications/teacher/bots-panel.ts:96`;
    - `features/identity/groups/groups-panel.ts:229`;
    - `features/identity/students/students-page.ts:289`;
  - `p-drawer`: `features/schedule/student/my-schedule-page.ts:176`, `features/help/help-button.ts:34`;
  - тосты `app.ts:10`; календарь `features/schedule/ui/schedule-calendar.ts:112` и рядом.
- **Источники:** ST1-01, LV1-03, LV3-06, LV4-01.

<a id="da-013"></a>
### DA-013. «Показать пароль» недоступно с клавиатуры, без имени, 16×16

- **Серьёзность:** Blocker·WCAG (2.1.1, 4.1.2, 2.5.8) · **Уровень:** C · **Раздел:** доступность, компоненты
- **Где:** 10 полей `p-password`:
  - вход, приглашение, шаг «Пароль» мастера, «Мой аккаунт» всех ролей;
  - окна восстановления и сброса;
  - мастер бота, Google и Телемост.
- **Что сейчас:**
  - В PrimeNG 21 значок показа — голый `<svg (click)>` 16×16 без `tabindex`, `role` и `aria-label`
    (`primeng-password.mjs:944-955`).
  - Tab с поля пароля уходит сразу на «Войти».
  - В окне настроек администратора пароль — обычный `input type=password`, глазка нет вовсе: разнобой.
- **Как должно быть:**
  - WCAG 2.1.1 и 4.1.2; 2.5.8 — цель не меньше 24×24;
  - M3: trailing icon 24 px (сверено: MW `_md-comp-outlined-text-field.scss`) в кнопке-значке с областью касания
    40–48 px (по памяти, требует сверки).
- **Почему важно:** ученики задают пароль при регистрации с телефона и хотят проверить, что набрали. Сейчас это
  можно сделать только пальцем по 16 px и никогда — с клавиатуры.
- **Предложение:**
  - общий компонент поля пароля в `shared/ui` — `tb-password-field`, или шаблоны `#showicon` / `#hideicon` с
    `<button type="button">` 40×40;
  - у кнопки имя «Показать пароль» / «Скрыть пароль» и `aria-pressed`;
  - 11 мест, средний объём, риск низкий.
- **Все вхождения:**
  - `features/identity/login/login-page.ts:35`;
  - `features/identity/invite/invite-page.ts:90, 102`;
  - `features/identity/account/change-password-form.ts:33, 44, 56`;
  - `features/settings/backups/restore-dialog.ts:58`;
  - `features/settings/reset-card.ts:64`;
  - `features/meetings/settings/meetings-settings-panel.ts:167`;
  - `features/notifications/teacher/bot-wizard-dialog.ts:183`;
  - `features/schedule/teacher/google-calendar-panel.ts:210`;
  - без глазка: `features/admin/settings/settings-page.ts:188-194`.
- **Источники:** ST4-10, LV4-03.

<a id="da-014"></a>
### DA-014. Ошибки полей показаны только красной рамкой; кнопка неактивна без объяснения; обязательные поля не отмечены

- **Серьёзность:** Blocker·WCAG (3.3.1, 3.3.2, 1.3.1) · **Уровень:** B + C · **Раздел:** состояния, доступность
- **Где:** все формы. Проверены «Новый ученик», «Новая группа», «Оплата», «Новое занятие», «Приглашение», мастер
  настройки, «Смена пароля», «Сбросить все данные?»; 390 и 1440 px.
- **Что сейчас:**
  - При пустом имени, «abc@», сумме 0 или коротком пароле рамка и подпись на рамке красные (ADR-0022 ✓), но:
    - текста ошибки под полем нет;
    - `aria-invalid` и `aria-describedby` не ставятся;
    - «Сохранить», «Далее», «Создать аккаунт», «Сбросить» просто неактивны.
  - Снимки: `LV2/dlg-student-invalid-1440.png`, `LV2/dlg-payment-zero-1440.png`, `LV4/invite-390-light-invalid.png`.
  - Сервер присылает `errors` по полям (`core/http/problem-detail.ts:10-11`), но фронтенд их нигде не показывает.
    Ошибки сервера («Логин: 3–50 символов…», «Этот логин уже занят») выводятся внизу формы, а не у поля.
  - Подсказка «Не короче 8 символов» при ошибке остаётся серой.
  - Около 45 контролов с `Validators.required`: ни звёздочки, ни `required` / `aria-required`. «(необязательно)» — только
    в двух местах.
  - Исключения с текстом ошибки: ссылка на урок, «Пароли не совпадают».
- **Как должно быть:**
  - M3 text field: error supporting text под полем (сверено: MW `_md-comp-outlined-text-field.scss`:
    `error.supporting-text.color = error`);
  - WCAG 3.3.1, 3.3.2; Нильсен №9.
- **Почему важно:** неактивная кнопка без объяснения — частая причина обращений «портал не сохраняет». Родитель
  ученика не понимает, почему «Создать аккаунт» серая.
- **Предложение:**
  - `shared/ui`: директива или компонент ошибки для `.tb-field` — текст по валидатору («Обязательное поле»,
    «Неверный e-mail», «Сумма больше 0»), `aria-invalid`, `aria-describedby`;
  - показ серверных `errors` у полей;
  - подсказка при ошибке — цвета error;
  - правило «отмечать обязательные или необязательные» записать в ADR-0022;
  - около 20 форм.
- **Все вхождения:**
  - `features/identity/students/student-form-dialog.ts:36-50, 85-91`;
  - `features/identity/groups/group-form-dialog.ts:46-83, 130`;
  - `features/billing/teacher/payment-dialog.ts:50-95, 127-131`;
  - `features/schedule/teacher/lesson-dialog.ts:68-128, 179-182`;
  - `features/schedule/teacher/series-dialog.ts:150, 228-240`;
  - `features/schedule/teacher/off-time-dialog.ts:127, 223-231`;
  - `features/homework/teacher/assignment-dialog.ts:64-145, 202`;
  - `features/notifications/teacher/broadcast-dialog.ts:53-77, 111`;
  - `features/boards/manage/boards-dialog.ts:154`;
  - `features/schedule/teacher/google-calendar-panel.ts:299, 303`;
  - `features/meetings/settings/meetings-settings-panel.ts:275, 279`;
  - `features/notifications/teacher/bot-wizard-dialog.ts:421`;
  - `features/identity/account/change-password-form.ts:52`;
  - `features/identity/invite/invite-page.ts:80-99, 117-124, 152-162`;
  - `features/identity/login/login-page.ts:44-46`;
  - `features/settings/setup/setup-page.ts:243-251`;
  - `features/settings/reset-card.ts:73-76, 91, 121-123`;
  - `core/http/problem-detail.ts:10-11`.
- **Источники:** LV2-10, ST3-07, ST5-14, LV3-30, LV4-15, LV4-16, LV4-33.

<a id="da-015"></a>
### DA-015. Snackbar забирает фокус, объявляется как тревога, исчезает через 3 с, закрывает FAB и складывается стопкой

- **Серьёзность:** Blocker·WCAG (2.4.3, 4.1.3, 2.2.1) · **Уровень:** B + C · **Раздел:** компоненты, доступность
- **Где:** все роли, все тосты: около 35 вызовов `messages.add` и интерцептор ошибок.
- **Что сейчас:**
  - При появлении тоста фокус переходит на его «×»: `document.activeElement` = `.p-toast-close-button`, видно кольцо.
    PrimeNG ставит `autofocus` (`primeng-toast.mjs:271-272, 355-356`).
  - Через 3 с тост исчезает, фокус падает на `body`.
  - Каждый тост, в том числе «Сохранено», — `role="alert"`, `aria-live="assertive"`.
  - `life` не задан: 3000 мс, измерено 2,86 с, в том числе у ошибок с кодом.
  - Вид: 384×84 px — заголовок «Ошибка» или «Готово» плюс текст и значок важности. Действий нет ни в одном тосте.
    «×» — 28×28 с подписью «Close».
  - На телефоне тост (y 612–696) ложится поверх FAB (y 648–704): `LV1/snackbar-error-students-390-light.png`.
  - Несколько ошибок дают стопку, см. DA-002.
- **Как должно быть:**
  - появление сообщения не переносит фокус (WCAG 2.4.3, 3.2);
  - `role=status` для успеха, alert — только для ошибок (4.1.3);
  - время на чтение (2.2.1);
  - M3 snackbar:
    - Body Medium, одна строка 48 px или две — 68 px;
    - без значка важности, действие цвета inverse-primary;
    - 4–10 с (сверено: MW `_md-comp-snackbar.scss`; CMP `SnackbarHost.kt`: Short 4000, Long 10000 мс);
    - над FAB и по одному (по памяти, требует сверки).
- **Почему важно:**
  - сохранил форму с клавиатуры — фокус улетел в тост, а через 3 с на начало страницы;
  - ошибку с кодом не успевают прочитать и продиктовать администратору;
  - главное действие страницы закрыто тостом.
- **Предложение:**
  - одно место в `app.ts` плюс хелпер `notify(text, action?)` без summary;
  - шаблон `#message`: своя кнопка закрытия без autofocus, 40×40, «Закрыть»; text-кнопка действия («Отменить»,
    «Открыть») цвета inverse-primary;
  - `life` 5000, у ошибок 8000 или `sticky`;
  - `role=status` для success и info;
  - на телефоне на страницах с FAB поднимать тост над FAB;
  - не повторять одинаковый тост;
  - риск низкий.
- **Все вхождения:**
  - `app.ts:10`;
  - `core/http/api-error.interceptor.ts:25`;
  - пресет `:282-304, 557-563`;
  - `styles.scss:1564-1609` (FAB), `:1612-1617` (тост);
  - вызовы:
    - identity: `features/identity/account/account-page.ts:111, 120`, `features/identity/students/students-page.ts:431`;
    - admin: `features/admin/events/events-page.ts:143, 154`, `features/admin/logs/logger-levels-panel.ts:149`,
      `features/admin/status/portal-address-card.ts:77`;
    - meetings: `features/meetings/rooms/room-dialog.ts:197, 209`,
      `features/meetings/settings/meetings-settings-panel.ts:340`;
    - notifications: `features/notifications/channels/channels-panel.ts:176, 202`,
      `features/notifications/teacher/broadcasts-panel.ts:115`,
      `features/notifications/teacher/student-messengers-panel.ts:155`,
      `features/notifications/teacher/bots-panel.ts:156`, `features/notifications/preferences/preferences-panel.ts:214`;
    - settings: `features/settings/backups/backups-card.ts:188`, `features/settings/reset-card.ts:135, 141`,
      `features/settings/portal-settings-card.ts:333, 352`;
    - billing: `features/billing/teacher/student-ledger-page.ts:201`, `features/billing/teacher/default-price-card.ts:102`,
      `features/billing/teacher/billing-overview-page.ts:223`;
    - schedule: `features/schedule/ui/calendar-feed-panel.ts:133`,
      `features/schedule/teacher/google-calendar-panel.ts:350, 372`,
      `features/schedule/teacher/schedule-page.ts:462, 494, 529`, `features/schedule/student/my-schedule-page.ts:302`;
    - homework: `features/homework/teacher/assignment-page.ts:304`, `features/homework/teacher/task-review-page.ts:222`,
      `features/homework/student/my-task-page.ts:153`.
- **Источники:** ST4-09, LV1-07, LV1-08.

<a id="da-016"></a>
### DA-016. Навигация и меню без состояний ARIA; видимое имя меню пользователя не входит в его доступное имя

- **Серьёзность:** Blocker·WCAG (1.3.1, 4.1.2, 2.5.3) · **Уровень:** C · **Раздел:** доступность, навигация
- **Где:** все роли и ширины: каркас, меню пользователя, «Ещё», переключатель вида календаря.
- **Что сейчас:**
  - **aria-current.** У пунктов нижней панели и rail `aria-current = null`: активный раздел выделен только цветом.
  - **Rail — меню, а не навигация.** Rail и развёрнутый rail — `<ul role="menu" tabindex="0">`, пункты `menuitem`,
    ссылки `tabindex="-1"`. Tab попадает в меню одним шагом, дальше — стрелки. Скринридер объявляет «меню»,
    а не ссылки навигации.
  - **«Ещё»** — `button` без `aria-haspopup` и `aria-expanded`.
  - **Меню пользователя.** На ≥ 769 px на кнопке видно имя («Елена Викторовна»), а `ariaLabel="Меню пользователя"`
    его заменяет (WCAG 2.5.3 Label in Name). Голосовая команда «нажми Елена Викторовна» не сработает.
  - **Тема.** Выбранная тема отмечена только заменой значка на ✓: без `aria-checked` и без tertiary-container,
    которого требует ADR-0022 для выбранного пункта.
  - **Вид календаря.** «Неделя / Месяц / Список» — выбранный вид виден только цветом, `aria-pressed` нет.
  - Работает правильно: меню пользователя открывается с Enter, стрелки и Esc работают, фокус возвращается.
- **Как должно быть:**
  - WAI-ARIA APG: навигация сайта — список ссылок с `aria-current="page"`, `role=menu` — для меню действий
    (по памяти, требует сверки);
  - WCAG 1.3.1, 4.1.2, 2.5.3;
  - ADR-0022 §Меню — выбранный пункт tertiary-container.
- **Почему важно:** слепой пользователь не узнаёт текущий раздел и не может пройти навигацию привычным Tab.
- **Предложение** (`core/layout`, средний риск, ADR не нужен):
  - `ariaCurrentWhenActive="page"` у `routerLinkActive`;
  - side-nav — свой `<nav>` со ссылками вместо `p-menu` (стили `side-nav.scss` почти те же);
  - «Ещё» и меню пользователя — `aria-haspopup="menu"` и `[attr.aria-expanded]`;
  - меню пользователя — `ariaLabel` = «{имя}: меню» на ≥ 769 px;
  - тема — `menuitemradio` + `aria-checked`, выбранная — tertiary-container, значок темы остаётся;
  - FullCalendar — `aria-pressed` через `viewDidMount` или свою группу кнопок.
- **Все вхождения:**
  - `core/layout/shell.ts:51-58` (меню пользователя), `:72-83` (нижняя панель), `:84-96` («Ещё»), `:134-141` (темы);
  - `core/layout/side-nav.ts:19` (`p-menu`), `core/layout/side-nav.scss` (селекторы `.p-menu-*`);
  - `features/schedule/ui/schedule-calendar.ts` (кнопки видов).
- **Источники:** LV1-09, LV1-18, ST5-01, ST1-15, LV2-33.

<a id="da-017"></a>
### DA-017. Поля без видимой подписи: фильтры журнала, «Выдать ещё ученикам», цена, цвет, «с/до», фильтр выпадающих списков

- **Серьёзность:** Blocker·WCAG (3.3.2, 1.3.1, 4.1.2) · **Уровень:** A (ADR-0022 §Поля: `.tb-field`, `label` первым) ·
  **Раздел:** компоненты, доступность
- **Где:** учитель, администратор, ученик; все ширины.
- **Что сейчас:**
  - Из 81 `.tb-field` 75 сделаны по ADR-0022 ✓.
  - **Подпись только в placeholder или `aria-label`:**
    - фильтры журнала «Код ошибки», «Текст», «Раздел (логгер)» — placeholder исчезает при вводе (`LV4/admin-logs-390-light-viewport.png`);
    - «Последние сутки», «Все уровни» и три выбора «Подробного журнала»;
    - «Выдать ещё ученикам» и «Добавить группу» (встроен в три формы);
    - «Цена для новых учеников»;
    - hex своего цвета.
  - **Поле только для чтения без подписи:** ссылка-приглашение, ссылка календаря (`.tb-feed-link`, кнопка
    «Копировать» не по центру поля).
  - **Подпись над полем, а не на рамке:**
    - «Причина» отмены занятия;
    - «с» и «до» тихих часов;
    - поля настроек администратора (`.tb-setting`) — при `access !== EDITABLE` `label for` указывает на `span`;
    - цена в истории оплат — `for` указывает на скрытое поле.
  - **Фильтр выпадающих списков** (`[filter]="true"`) — поле без placeholder и `aria-label`, флажок «выбрать всех» в
    multiselect без подписи.
  - Редактируемый `p-select` «Раздел журнала» на 390 px — 50 px против 56.
- **Как должно быть:** ADR-0022 §Поля; M3 outlined text field — подпись видна всегда; WCAG 3.3.2, 1.3.1, 4.1.2.
- **Почему важно:** после ввода кода администратор не видит, какое поле что фильтрует. Пользователь скринридера
  не знает, что за поле перед ним.
- **Предложение:**
  - страницы — `.tb-field` с `label`; сетка фильтров журнала сохраняется, ADR-0021 её разрешает;
  - у фильтров списков — `filterPlaceholder="Поиск"` и `ariaFilterLabel`;
  - `tb-copy-row` для строк копирования (см. DA-070);
  - около 20 мест.
- **Все вхождения:**
  - `features/admin/logs/log-page.ts:63-100`;
  - `features/admin/logs/logger-levels-panel.ts:33-52`;
  - `features/homework/teacher/assignment-page.ts:159-171`;
  - `features/identity/groups/group-picker.ts:27-35` (в `features/homework/teacher/assignment-dialog.ts:144`,
    `features/notifications/teacher/broadcast-dialog.ts:66`);
  - `features/billing/teacher/default-price-card.ts:23-32`;
  - `features/billing/teacher/student-ledger-page.ts:84-96`;
  - `features/settings/portal-settings-card.ts:115-122`;
  - `features/identity/students/invite-link-dialog.ts:41-48`;
  - `features/schedule/ui/calendar-feed-panel.ts:33-44, 72-80`;
  - `features/schedule/teacher/lesson-details-dialog.ts:143-151`;
  - `features/notifications/preferences/preferences-panel.ts:80-95`;
  - `features/admin/settings/settings-page.ts:107-157` (`:109, 120`);
  - `features/homework/teacher/assignment-dialog.ts:70`;
  - фильтры списков: `features/schedule/teacher/lesson-dialog.ts:70`, `features/schedule/teacher/series-dialog.ts:67, 124`,
    `features/billing/teacher/payment-dialog.ts:52`, `features/identity/groups/group-form-dialog.ts:58`,
    `features/homework/teacher/assignment-dialog.ts:131`, `features/notifications/teacher/broadcast-dialog.ts:53`.
- **Источники:** ST3-07, LV2-29, LV4-23, LV3-28, LV3-29, LV2-23.

<a id="da-018"></a>
### DA-018. Ссылки внутри текста отличаются только цветом — 2,79 : 1 к тексту

- **Серьёзность:** Blocker·WCAG (1.4.1) · **Уровень:** B (осознанное решение ADR-0015 §Токены: «подчёркиваются при
  наведении») · **Раздел:** доступность, типографика
- **Где:**
  - приветствие ученика, 4 ссылки;
  - статьи справки;
  - ссылка на справку в «Настройках»;
  - обе темы; axe `link-in-text-block` (serious).
- **Что сейчас:** indigo #4f46e5 против текста #18191e — 2,79 : 1, это меньше 3 : 1. Подчёркивания нет. При
  зелёном или розовом портале различие ещё меньше.
- **Как должно быть:** WCAG 1.4.1 и техника G183: ссылка в тексте подчёркнута, либо отличается от текста не меньше
  чем на 3 : 1 и получает признак при фокусе и наведении.
- **Почему важно:** в приветствии ученика ссылки выглядят как цветной текст, а при нарушении цветовосприятия — как
  обычный текст.
- **Предложение:**
  - подчёркивать ссылки внутри текста: `p a, li a, .tb-markdown a, .tb-muted a`;
  - навигационные ссылки, ссылки-кнопки и `tb-link` в строках оставить без подчёркивания;
  - одно правило плюс правка ADR-0015.
- **Все вхождения:** `styles.scss:802-815, 936-944`; `features/home/student-welcome-card.ts:22, 26, 30, 34`;
  `features/help/articles/admin.ts:17, 20` и вся справка через `shared/ui/markdown-view.ts`; `features/settings/*`
  (`a[target=_blank]`).
- **Источники:** LV1-16, LV3-31, LV4-04.

<a id="da-019"></a>
### DA-019. При шрифте 200 % и масштабе 400 % каркас съедает экран, появляется горизонтальная прокрутка

- **Серьёзность:** Blocker·WCAG (1.4.4, 1.4.10) · **Уровень:** C · **Раздел:** адаптивность, доступность
- **Где:** все роли. Причина — размеры каркаса в rem, а границы окон в px.
- **Что сейчас:**
  - **Шрифт браузера 200 %** (корень 32 px):
    - 1440 px: шапка 128 px, развёрнутый rail 560 px (39 % окна), быстрые действия обрезаны;
    - 390 px: шапка 128 + панель 160 = 288 из 900 px, горизонтальная прокрутка страницы до 537 px, все подписи панели
      обрезаны, от названия портала видно 62 px. Снимки `LV1/font200-_teacher-1440.png`, `LV1/font200-_teacher-390.png`.
  - **Масштаб 400 %** (окно 1280×1024, то есть 320×256 CSS px):
    - шапка и панель занимают 144 из 256 px, на контент остаётся 112 px, из них 56 — FAB;
    - меню пользователя выше окна, «Выйти» виден только после прокрутки. Снимок `LV1/zoom400-of-1280x1024-usermenu.png`.
  - Работает: масштаб 200 % (720×450) — раскладка телефона, всё доступно.
  - Радиусы при шрифте 200 % расходятся: у `p-card` 40 px (rem), у `tb-fold-card` 20 px (px), у плиток 16 px.
- **Как должно быть:**
  - WCAG 1.4.4 (текст 200 % без потерь), 1.4.10 (320 CSS px без прокрутки в двух направлениях);
  - закреплённые шапка и панель не занимают больше половины окна;
  - в M3 размеры каркаса в dp и со шрифтом не растут (по памяти, требует сверки).
- **Почему важно:** у слабовидящего учителя с крупным шрифтом каркас занимает треть экрана и появляется прокрутка
  вбок.
- **Предложение:**
  1. размеры каркаса — в px (64, 80, 88, 280), а не в rem;
  2. границы окон — в em, в CSS и в `mobile.ts` одинаково: при крупном шрифте раскладка переходит в rail или телефон;
  3. при `max-height: 480px` шапку не закреплять.

  Объём средний, риск средний, правка ADR-0017 (таблица окон).
- **Все вхождения:**
  - `styles.scss:23` (`--tb-header-height`);
  - `core/layout/shell.scss:83, 106`;
  - `core/layout/side-nav.scss:12, 82`;
  - `core/layout/mobile.ts:7, 10`;
  - все `@media` в px: `styles.scss:200, 516, 734, 961, 1463, 1484, 1497, 1564, 1613, 1628, 1668`,
    `core/layout/shell.scss:25, 50, 76`, `shared/ui/fold-card.ts:178`;
  - пресет `:485` (радиус карточки в rem).
- **Источники:** LV1-14, ST2-08.

---

## Major

<a id="da-020"></a>
### DA-020. Загрузка без индикатора: ложное «пусто» и скачки раскладки до CLS 0,73

- **Серьёзность:** Major · **Уровень:** C + A (ADR-0019 §Индикатор загрузки: индикатор M3E сделан, но почти не
  используется) · **Раздел:** состояния, движение
- **Где:** все роли. Проверено с задержкой 1500 мс на каждый `/api/**`.
- **Что сейчас:** что видно в первые 1–3 с (CLS — сумма сдвигов раскладки):

  | Страница | Что видно до ответа | CLS 1440 | CLS 390 |
  |---|---|---|---|
  | `/teacher/schedule` | «Нет регулярных занятий», пустой календарь | 0,29 | 0,65 |
  | `/teacher/notifications` | «Все уведомления прочитаны», неактивная «Прочитать все», бейдж 99+ пропадает | 0,73 | 0,54 |
  | `/cabinet/schedule` | «На этой неделе занятий больше нет», «Занятий нет» | 0,10 | 0,70 |
  | `/cabinet` | приветствие, затем сверху вставляется «Ближайшее занятие» | 0,15 | 0,33 |
  | `/admin/logs` | маска таблицы | 0,51 | — |
  | «Оплаты», «Состояние», «Настройки», страница задания | только заголовок, без индикатора | — | — |

  - `p-progressspinner` в виде индикатора M3E используется только в `features/identity/invite/invite-page.ts`.
    Таблицы показывают маску PrimeNG со значком.
  - Снимки: `LV1/slow-teacher_teacher_notifications-1440-t350.png`, `LV1/slow-anna_cabinet_schedule-1440-t350.png`,
    `LV3/slow-schedule-390-400ms.png`.
- **Как должно быть:**
  - M3 Expressive: loading indicator там, где ждут контент (сверено: MW `_md-comp-loading-indicator.scss`);
  - пустое состояние — только после ответа;
  - CLS не больше 0,1 (Core Web Vitals, по памяти, требует сверки);
  - Нильсен №1.
- **Почему важно:** на мобильном интернете ложное «пусто» держится 1–3 с, а карточки прыгают под пальцем —
  нажимаешь не туда.
- **Предложение:**
  - `shared/ui`: `tb-loading` — индикатор M3E по центру карточки с минимальной высотой или скелет;
  - пустое состояние только при `loaded() && list.length === 0`;
  - резерв высоты у «Ближайшего занятия»;
  - вместе с DA-002 — одно состояние страницы `loading | error | ready`;
  - около 15 компонентов.
- **Все вхождения:**
  - ложное «пусто»:
    - `features/notifications/inbox/inbox-panel.ts:22-28`;
    - `features/schedule/teacher/schedule-page.ts:208`;
    - `features/schedule/student/my-schedule-page.ts:77-82, 226-233`;
    - `features/schedule/ui/schedule-calendar.ts:112` (`noEventsText`);
    - `features/billing/teacher/monthly-report-page.ts:169`;
    - `features/admin/events/events-page.ts:31, 70`;
    - `features/settings/backups/backups-card.ts:82`;
  - без индикатора:
    - `features/billing/teacher/billing-overview-page.ts`;
    - `features/billing/student/my-billing-page.ts:20`;
    - `features/admin/status/status-page.ts:31`;
    - `features/admin/settings/settings-page.ts:103`;
    - `features/home/student-home.ts:37-47`;
    - `features/homework/student/my-task-page.ts:42`.
- **Источники:** LV1-06, LV3-12, LV4-06.

<a id="da-021"></a>
### DA-021. Нижняя навигация: шесть пунктов, «Расписан…» обрезано, раздел из «Ещё» не отмечен

- **Серьёзность:** Major · **Уровень:** B (ADR-0017 выбрал «пять разделов и Ещё») + C · **Раздел:** навигация,
  адаптивность
- **Где:** учитель и администратор, 320–390 px. У ученика 4 пункта — всё помещается.
- **Что сейчас:**
  - **Подписи.** При 6 пунктах подпись — Label Small 11 px, а должна быть Label Medium 12. Поля пункта 2 px.
    Комментарий «Label Small fits» неверен.
  - **Обрезка:**
    - 390 px: учитель «Расписание» — 61,0 из 61,3 px → «Расписан…»;
    - 360 px: «Расписание», у администратора «Интеграции»;
    - 320 px: «Состояние».

    Снимки: `LV1/crop-bottomnav-teacher-390-light.png`, `main/smoke-teacher-home-390.png`.
  - **Индикатор** 61×32 на 390 px и 56×32 на 360 px вместо 64×32.
  - **Раздел из «Ещё».** После «Ещё» → «Уведомления» ни один пункт панели не активен, «Ещё» тоже.
    Снимок `LV1/more-selected-390-light.png`.
  - **Высота панели** 80 px — как у M3 navigation bar; у Expressive — 64 (см. раздел 5, С-3).
- **Как должно быть:**
  - M3 navigation bar: подпись Label Medium, индикатор 64×32 (сверено: MW `_md-comp-navigation-bar.scss`);
  - 3–5 пунктов (по памяти, требует сверки);
  - подписи не обрезаются;
  - всегда отмечен текущий раздел: Нильсен №1.
- **Почему важно:** «Расписан…» — главный раздел учителя на iPhone 12–15 (390 px). На «Уведомлениях», «ИИ» и
  «Диагностике» панель выглядит так, будто раздел вне навигации.
- **Предложение** (по возрастанию объёма):
  1. «Ещё» активна, когда открыт раздел из меню; выбранный пункт меню — tertiary-container (ADR-0022). Одна правка в
     `shell.ts`;
  2. `padding-inline: 0` у пункта — это даёт +4 px и хватает на 390, но не на 360;
  3. `NAV_ITEMS = 4` — четыре раздела и «Ещё», как было в ADR-0015. 78 px на пункт при 390, Label Medium помещается.
     Нужна правка ADR-0017;
  4. короткие подписи для панели (`shortLabel`) — решает учитель.
- **Все вхождения:** `core/layout/shell.ts:21, 72-96, 125-126`; `core/layout/shell.scss:99-167` (`:107` поля,
  `:146-149` Label Small, `:151-156` многоточие).
- **Источники:** ST2-07, LV1-10, LV1-11; противоречие Пр-4.

<a id="da-022"></a>
### DA-022. Выпадающие списки на телефоне шире экрана и раздвигают страницу

- **Серьёзность:** Major · **Уровень:** C · **Раздел:** адаптивность, компоненты
- **Где:** 390×844, касание. Ширина списка:

  | Где | Список | Ширина |
  |---|---|---|
  | «Новое занятие», «Регулярные занятия» | «С кем» | 635 px |
  | «Оплата» | «Ученик» | 496 px |
  | «Новая группа» | «Ученики» | 522 px |
  | страница задания | «Выдать ещё ученикам» | 522 px |
  | страница задания | «Добавить группу» | 635 px |

- **Что сейчас:**
  - На мобильном вьюпорте `innerWidth` становится 635, 522 или 496 px. Полноэкранное окно съезжает, фильтр и длинные
    имена обрезаны.
  - Снимки: `LV2/dlg-lesson-select-390-settled.png`, `LV2/dlg-payment-select-kon-390.png`,
    `LV2/dlg-group-multiselect-390.png`.
- **Как должно быть:** ADR-0022 §Меню и выпадающие списки — список не шире окна, длинный пункт переносится.
- **Почему важно:** выбор ученика — первый шаг записи занятия и оплаты с телефона.
- **Предложение:**
  - `styles.scss`: `.p-select-overlay, .p-multiselect-overlay { max-width: calc(100vw - 2rem) }`;
  - у `.p-select-option`, `.p-multiselect-option` — `white-space: normal; overflow-wrap: break-word`;
  - риск низкий.
- **Все вхождения:**
  - `features/schedule/teacher/lesson-dialog.ts:70`;
  - `features/schedule/teacher/series-dialog.ts:67, 124`;
  - `features/billing/teacher/payment-dialog.ts:52`;
  - `features/identity/groups/group-form-dialog.ts:58`;
  - `features/identity/groups/group-picker.ts:27`;
  - `features/homework/teacher/assignment-dialog.ts:131`;
  - `features/homework/teacher/assignment-page.ts:159`;
  - `features/notifications/teacher/broadcast-dialog.ts:53`.
- **Источники:** LV2-03.

<a id="da-023"></a>
### DA-023. `overflow-wrap: anywhere` в ячейках таблиц рвёт даты и имена посередине; `.tb-pre` рвёт прозу

- **Серьёзность:** Major · **Уровень:** A (ADR-0021 §Переносы) · **Раздел:** типографика, адаптивность
- **Где:** «На проверку», «Отчёт за месяц», история оплат, «Оплаты», задания учителя и ученика. Ширины 769–1440 px.
- **Что сейчас:**
  - **Разрывы внутри слова:**

    | Где | Ширина | Пример |
    |---|---|---|
    | «На проверку» | 769–1440 | «29.09.20\|26 18:30» |
    | «Отчёт» | — | «28.09.20\|26» |
    | история оплат | 769, 1200 | «27.0\|9.20\|26» в три строки |
    | «Оплаты» | 769 | «Константиноп\|ольская», «Приглашё\|нная», «Соловьёв\|а» |
    | «Задания» | 800 | «04.10.2\|026» |

    Снимки: `ST2/billing-table-800.png`, `LV2/review-1024-light.png`, `LV2/billing-769-light.png`.
  - **Причина:**
    - `anywhere` задан всем `td` таблиц и заголовкам строк внутри ячеек;
    - минимальная ширина колонки падает до одного символа, и автораскладка сжимает имя при свободном месте рядом;
    - `.tb-col-main { min-width: 13rem }` действует только от 1200 px.
  - **Проза.** `.tb-pre` с `anywhere` — это ответы учеников и комментарии учителя.
  - **Размер файла.** «17 / Б», «2 / КБ» рвутся по обычному пробелу.
- **Как должно быть:** ADR-0021 §Переносы — слово рвётся, лишь если не помещается целиком. Даты и суммы не рвутся
  (как `.tb-amount`).
- **Почему важно:** разорванная дата читается как ошибка. Ровно этот дефект («Константинополь|ский») ADR-0021 и
  исправлял.
- **Предложение** (`styles.scss`, риск низкий):
  - класс `tb-nowrap` для дат и времени в ячейках;
  - `tb-col-main` — уже с 769 px;
  - `break-word` для `.tb-list__title` в ячейке и для `.tb-pre`;
  - «Оплаты» на 769–1199 px — `tb-cards--wide`;
  - неразрывный пробел в `formatFileSize`.
- **Все вхождения:**
  - `styles.scss:734-738, 987-990, 1388-1391`;
  - `features/homework/teacher/review-queue-page.ts:55-60`;
  - `features/billing/teacher/monthly-report-page.ts` (колонки «Дата»);
  - `features/billing/ledger/ledger-table.ts:41`;
  - `features/billing/teacher/billing-overview-page.ts` (колонка «Ученик»);
  - `features/homework/teacher/assignments-page.ts` (срок);
  - `features/homework/student/my-homework-page.ts:57-69`;
  - `features/homework/ui/submission-list.ts:20`, `features/homework/teacher/task-review-page.ts:140`,
    `features/homework/student/my-task-page.ts:69` (`.tb-pre`);
  - `shared/files/file-size.ts:4, 13`.
- **Источники:** ST2-06, LV2-05, LV3-25, LV3-32.

<a id="da-024"></a>
### DA-024. Пустые состояния четырёх видов, без пояснения и первого действия; дубли с FAB

- **Серьёзность:** Major (разнобой между экранами) · **Уровень:** A (ADR-0018 §Секции: «Пустой список или раздел —
  только `tb-empty-state`») · **Раздел:** состояния, компоненты
- **Где:** все роли. Полностью пустые разделы сняты на чистом инстансе — 0 учеников.
- **Что сейчас:**
  - **Четыре вида, часто на одной странице** (`LV4/empty-cabinet-1440-light.png`, `LV4/scn-setup-5-home-390-full.png`):
    1. `tb-empty-state` с кругом 64 px — «Уведомлений пока нет»;
    2. абзац `p.tb-muted` — «Сегодня занятий нет.», «Срочных дел нет.», «Ближайших занятий нет.», «Открытых заданий
       нет.», «Ничего не найдено.», «Запросов в этом месяце не было.», «Ничего не нашлось…»;
    3. FullCalendar «Занятий нет» — серый прямоугольник с рамкой, в тёмной теме серый блок;
    4. строка `#emptymessage` таблицы — у «Подробного журнала» его нет вовсе, остаётся пустая шапка.
  - **Без действия.** Из 28 компонентных пустых состояний кнопка первого действия есть в трёх: ученики, группы,
    задания. Пояснение — в десяти. Без действия, хотя оно есть:
    - «Нет регулярных занятий» — ни пояснения, ни кнопки;
    - «Задание ещё никому не выдано» — поле выдачи ниже;
    - «Учеников пока нет» в «Оплатах» — отсылает к «Ученикам» без ссылки;
    - «Никого не найдено» — нет «Показать отключённых»;
    - «Все группы в архиве».
  - **Дубли с FAB.** «Добавить ученика» и «Новое задание» — FAB и кнопка пустого состояния на одном экране.
    «Создать группу» — в заголовке карточки и в пустом состоянии.
  - **Тексты:**
    - 6 заголовков с точкой, 22 без неё;
    - «Всё проверено» у учителя, который ничего не выдавал;
    - «На этой неделе занятий больше нет» у ученика без занятий вообще;
    - «Все уведомления прочитаны» над «Уведомлений пока нет»;
    - «от преподавателя» при «учитель» везде.
- **Как должно быть:** ADR-0018 §Секции; пустое состояние объясняет, что здесь будет, и ведёт к первому действию
  (M3 empty states — по памяти, требует сверки).
- **Почему важно:** одинаковое «ничего нет» выглядит по-разному — страница кажется собранной из разных версий.
  Учитель не видит, как начать.
- **Предложение:**
  - `shared/ui`: компактный вариант `tb-empty-state` для виджетов и журнала — значок 40 в строке, без круга 64;
  - FullCalendar — `noEventsContent` через тот же компонент;
  - правило в ADR-0018: пустое состояние без кнопки, если та же кнопка — FAB или в заголовке карточки; иначе с кнопкой;
  - заголовки без точки;
  - около 25 мест.
- **Все вхождения:**
  - **не через компонент:**
    - `features/home/attention-card.ts:24`;
    - `features/homework/home/my-deadlines-widget.ts:17`;
    - `features/schedule/home/next-lesson-widget.ts:57`;
    - `features/schedule/home/today-lessons-widget.ts:32`;
    - `features/notifications/channels/channels-panel.ts:38-45`;
    - `features/notifications/teacher/bot-abilities-panel.ts:25, 37`;
    - `features/boards/manage/boards-dialog.ts:69`;
    - `features/boards/to-board/to-board-dialog.ts:46`;
    - `features/ai/ai-usage-page.ts:110`;
    - `features/admin/logs/log-page.ts:111`;
    - `features/admin/integrations/integrations-page.ts:83`;
    - `features/help/help-page.ts:68`;
    - `features/homework/teacher/assignment-page.ts:95`;
    - `core/pages/not-found.ts:11-17`;
    - `features/admin/logs/logger-levels-panel.ts:62`;
    - `features/schedule/ui/schedule-calendar.ts:112`;
  - **без действия или пояснения:**
    - `features/schedule/teacher/schedule-page.ts:208, 246`;
    - `features/homework/teacher/assignment-page.ts:153`;
    - `features/billing/teacher/billing-overview-page.ts:165`;
    - `features/identity/students/students-page.ts:254`;
    - `features/identity/groups/groups-panel.ts:199`;
    - `features/notifications/teacher/student-messengers-panel.ts:29`;
    - `features/settings/backups/backups-card.ts:83`;
    - `features/notifications/teacher/broadcasts-panel.ts:33`;
    - `features/billing/ledger/ledger-table.ts:123`;
  - **дубли с FAB:**
    - `features/identity/students/students-page.ts:85-86, 247`;
    - `features/homework/teacher/assignments-page.ts:54-55, 102`;
    - `features/identity/groups/groups-panel.ts:71, 192`;
  - **тексты:**
    - `features/admin/events/events-page.ts:32, 71`;
    - `features/admin/integrations/integrations-page.ts:88`;
    - `features/settings/settings-page.ts:127`;
    - `features/homework/teacher/review-queue-page.ts:73`;
    - `features/schedule/student/my-schedule-page.ts:80`;
    - `features/notifications/inbox/inbox-panel.ts:27-31`;
    - `features/homework/student/my-homework-page.ts:78`;
  - **ошибка вёрстки:** `features/billing/teacher/monthly-report-page.ts:197` — `colspan="5"` у таблицы из 4 колонок.
- **Источники:** ST3-03, ST5-15, LV3-23, LV4-11, LV4-13, LV4-30.

<a id="da-025"></a>
### DA-025. Типографика: у заголовков карточек и окон нет своей высоты строки, подсказки 16/24, подписи показателей 11,67/500, вес 600, нет трекинга

- **Серьёзность:** Major (видно на каждом экране) · **Уровень:** A (ADR-0019 §Типографика) + B · **Раздел:** типографика
- **Где:** все роли, все экраны.
- **Что сейчас:**

  | Элемент | Факт | Должно быть |
  |---|---|---|
  | `.p-card-title` | 22/**24** 500 (300 замеров) | Title Large 22/28 |
  | `.p-dialog-title` | 24/**24** 500 | Headline Small 24/32 |
  | Заголовок боковой панели справки | 22/24 **400** | — |
  | Заголовок листа | 22/28 **400** | — |
  | Заголовок шага мастера | 22/28 **400** | emphasized 500 |
  | Заголовок статьи справки | 24/32 **400** | emphasized 500 |
  | Подсказка `pTooltip` (41 вхождение) | **16/24**, высота 32 px | Body Small 12/16, высота 24 |
  | `small` в `.tb-stat` | **11,67/20 500** | Body Small 12/16 400 |
  | Активный пункт rail | **600** | вне шкалы 400/500 |
  | Пункты меню и опции `p-select` | 16/400 | Label Large 14/500 |
  | Дни недели в календаре выбора даты | 16/**700** | Body Large |
  | Текст `p-message` | 16/500 | — |
  | `.tb-calendar-title` | 1.125rem | остаток ADR-0015 |
  | 404 | **64 px / 24 px** | — |
  | Моноширинный текст | `monospace` литералом ×4 | токена нет |

  - Высота строки заголовков наследуется от body, потому что пресет задаёт только размер и вес. Двухстрочные заголовки
    окон слипаются: `LV2/dlg-invite-1-1440.png`, `LV4/fr-invite-link-dialog-390.png`.
  - Подписи показателей — «должников: 3», «Эта сумма пойдёт в счёт…», «сборка …»: `small` наследует Label Large и
    уменьшается браузером.
  - Вес 600 у активного пункта противоречит комментарию `shell.scss` «not by weight».
  - Трекинг: токены `--tb-type-*` — шорткат `font` без `letter-spacing`. Трекинг задан только кнопкам. В M3 у ролей
    есть трекинг (сверено: MW `_md-sys-typescale.scss`): Body Large 0,5 px, Body Medium 0,25, Body Small 0,4,
    Label Medium и Small 0,5, Title Medium 0,15, Label Large и Title Small 0,1. Особенно заметно у Label Small 11 px в
    нижней панели.
  - Размеры и интерлиньяж самой шкалы `--tb-type-*` совпадают с M3 полностью (сверено: MW `_md-sys-typescale.scss`).
- **Как должно быть:** ADR-0017 и ADR-0019 §Типографика: заголовки страниц, карточек и окон — emphasized по шкале;
  подписи — Body Small.
- **Почему важно:** слипшиеся строки и мелкий полужирный текст читаются хуже, особенно на телефоне. Один тип
  заголовка выглядит по-разному на соседних экранах.
- **Предложение** (пресет и `styles.scss`, около 25 правок, риск низкий):
  - `font: var(--tb-type-title-l-emphasized)` у `.p-card-title`, `var(--tb-type-headline-s-emphasized)` у
    `.p-dialog-title`, согласованная роль у `.p-drawer-title`;
  - `.p-tooltip-text { font: var(--tb-type-body-s) }`;
  - `.tb-stat small { font: var(--tb-type-body-s) }`;
  - 600 → 500 плюс цвет;
  - пары `--tb-type-*-tracking` или классы `.tb-type-*`;
  - токены `--tb-font-mono` и `--tb-type-display-*`.
- **Все вхождения:**
  - пресет `:489, 495, 501, 548-549, 560-561, 676-682` (подсказка), `:687-688`;
  - `styles.scss:25-44, 151, 155-159, 889-895, 1556`;
  - `core/layout/side-nav.scss:73-75`;
  - `features/settings/setup/setup-page.ts:309-312`;
  - `features/help/help-page.ts:124-127`;
  - `features/help/help-article-view.ts:14`;
  - `features/notifications/teacher/bot-wizard-dialog.ts:361`;
  - `features/settings/portal-settings-card.ts:242`;
  - `core/pages/not-found.ts:30`;
  - моноширинный текст:
    - `features/admin/events/events-page.ts:111-112`;
    - `features/admin/logs/log-page.ts:181-204`;
    - `features/admin/logs/logger-levels-panel.ts:105`;
    - `features/notifications/channels/link-code-view.ts:60`;
  - показатели с `small`:
    - `features/billing/home/finance-widget.ts`;
    - `features/billing/student/my-billing-page.ts:28-36`;
    - `features/billing/home/my-balance-widget.ts:17-29`;
    - `features/billing/teacher/monthly-report-page.ts:82`;
    - `features/admin/status/status-page.ts:42-86`.
- **Источники:** ST2-10, ST4-11, ST4-16, LV2-15, LV2-20, LV3-16, LV3-21, LV4-26, LV1-24.

<a id="da-026"></a>
### DA-026. Больше одной filled-кнопки на странице; вес зелёной кнопки на странице не определён

- **Серьёзность:** Major · **Уровень:** A (ADR-0018 §Кнопки: «не больше одной filled»; ADR-0019 §Цвет кнопок —
  правило остаётся) · **Раздел:** компоненты, цвет
- **Где и что сейчас:**
  - **«Подключиться» у ученика.** `/cabinet/schedule`, 1024 и 1440 px: по filled «Подключиться» в каждой строке
    ближайших занятий, у anna их 4. `lesson-actions` не передаёт `tonal` в `tb-join-lesson-button`, а у учителя в
    «Сегодня» та же кнопка tonal. Снимок `ST1/student-schedule-upcoming-1440.png`.
  - **«✓ Сохранить цену».** «Оплаты» и история оплат, режим правки цены: `severity="success"` без `text` и
    `tb-tonal` — вторая filled рядом с FAB. К тому же это «капля» 40×42, без подсказки, а на странице ученика — без
    `[loading]`.
  - **Filled зелёные вне диалогов.** «Принять» на проверке работы, «Сохранить и перезапустить» в заголовке
    настроек администратора, «Сохранить и продолжить» на шаге пароля мастера. При этом «Выдать», «Применить» и все
    «Сохранить» секций — tonal зелёные. ADR-0019 разрешает filled зелёную только для отправки формы в диалоге,
    приглашения и сдачи работы, а «Сохранить и перезапустить» по ADR-0018 — «обычная кнопка в заголовке».
- **Как должно быть:** ADR-0018 §Кнопки — на странице не больше одной filled-кнопки, главное действие — FAB или
  кнопка в заголовке; ADR-0019 §Цвет кнопок — filled зелёная только для отправки формы в диалоге, приглашения и
  сдачи работы; остальные решения — tonal.
- **Почему важно:** главное действие теряется, список выглядит «кричащим». Одно и то же решение («принять»,
  «сохранить») выглядит на разных страницах по-разному.
- **Предложение:**
  - `tonal` для «Подключиться» в строках; filled — только в hero главной и в нижнем листе;
  - «✓» — `tb-tonal`, `[rounded]`, `pTooltip`, `[loading]`;
  - дописать в ADR-0019 одно из двух: «главное решение страницы без FAB — filled зелёная» (тогда «Принять» и
    «Сохранить и перезапустить» законны) или «решения на странице — только tonal»;
  - шаг пароля мастера — «Далее» цвета портала.
- **Все вхождения:**
  - `features/schedule/student/my-schedule-page.ts:103-116`, `features/schedule/ui/lesson-actions.ts:23`,
    `features/meetings/ui/join-lesson-button.ts:49-58`;
  - `features/billing/teacher/default-price-card.ts:33`, `features/billing/teacher/student-ledger-page.ts:97`;
  - `features/homework/teacher/task-review-page.ts:110`;
  - `features/admin/settings/settings-page.ts:85-91`;
  - `features/identity/account/change-password-form.ts:71`, `features/settings/setup/setup-page.ts:99`.
- **Источники:** ST1-02, ST1-08, ST1-09, LV3-09, LV4-22.

<a id="da-027"></a>
### DA-027. «Отмена», «Отменить», «Назад»: одна подпись — разные действия и цвета, разные подписи — одно действие

- **Серьёзность:** Major · **Уровень:** A + B · **Раздел:** тексты, цвет, UX
- **Где:** все окна подтверждения, окна форм, окно занятия, история оплат, окно отмены у ученика.
- **Что сейчас:**
  - **«Отмена» в опасных подтверждениях.** `dangerConfirmation` ставит «Назад», но подпись можно перекрыть: сначала
    `rejectLabel`, потом `...confirmation`.
    - Пять вызовов передают `rejectLabel: 'Отмена'`: отключение ученика, архив группы, отключение бота, удаление
      копии, удаление файла.
    - Два собственных опасных окна тоже подписывают «Отмена» нейтральной: восстановление копии, полный сброс.
    - «Назад» стоит только в расписании и истории оплат.
  - **Цвет «Отмены».** В 14 формах «Отмена» красная text (ADR-0019), в опасных окнах — серая.
    `safeConfirmation` подписывает красную кнопку «Отмена», а ADR-0019 называет её «Назад».
  - **Одно слово — три действия:**
    - в окне занятия красные text «Удалить» и «Отменить» (отменить урок и уведомить ученика) стоят рядом;
    - во всех формах красная «Отмена» — закрыть окно;
    - в истории оплат значок «Отменить занятие» снимает начисление — это третье действие (см. DA-035).
  - **Окно отмены у ученика.** Заголовок «Отменить занятие», кнопки красная text «Отмена» и зелёная filled
    «Отправить учителю» — какая отменяет занятие? На 390 px «Отправить учителю» переносится в две строки.
  - **Раскладка опасных окон.** В восстановлении и сбросе кнопки стоят в теле окна слева, на телефоне — посреди
    экрана. В окне настроек — в подвале справа.
  - Снимки: `ST1/confirm-deactivate-student.png`, `LV2/dlg-details-1440.png`, `LV3/lv3-cancel-dialog-1440-light.png`,
    `LV4/dlg-restore-390.png`.
- **Как должно быть:**
  - ADR-0019 §Диалог подтверждения. ADR внутренне согласован: нейтральная «Назад» в опасном окне описана как
    осознанное исключение, чтобы не было двух красных кнопок;
  - противоречие возникает в коде, где исключение применено к «Отмене», и в самом правиле «красная Отмена»
    (см. раздел 5, С-1);
  - Нильсен №4.
- **Почему важно:** промах «Отменить» вместо «закрыть» отменяет урок и шлёт уведомление ученику. Цвет перестаёт
  называть последствие.
- **Предложение:**
  - в `dangerConfirmation` ставить `rejectLabel: 'Назад'` после spread, то есть не давать его переопределить, и убрать
    5 переопределений;
  - в окне занятия — «Отменить занятие…» и «Удалить…» с многоточием (см. DA-028);
  - на странице оплат — «Снять начисление»;
  - у ученика для CANCEL — «Попросить отменить» (filled danger) и «Назад»;
  - общий компонент «подтверждение паролем» в `shared/ui` для восстановления, сброса и настроек — кнопки в подвале;
  - тест `confirmation.spec.ts` на попытку переопределения;
  - решение по цвету «Отмены» — раздел 5, С-1.
- **Все вхождения:**
  - `shared/ui/confirmation.ts:7-26`;
  - переопределения:
    - `features/homework/teacher/assignment-page.ts:274`;
    - `features/settings/backups/backups-card.ts:218`;
    - `features/notifications/teacher/bots-panel.ts:153`;
    - `features/identity/groups/groups-panel.ts:361`;
    - `features/identity/students/students-page.ts:451`;
  - свои окна: `features/settings/backups/restore-dialog.ts:70-84, 103-105`, `features/settings/reset-card.ts:80-94`;
  - `features/schedule/teacher/lesson-details-dialog.ts:194-229`;
  - `features/billing/ledger/ledger-table.ts:77-78`, `features/billing/teacher/student-ledger-page.ts:219-230`;
  - `features/schedule/student/change-request-dialog.ts:96-104`;
  - эталон раскладки — `features/admin/settings/settings-page.ts:221-239`.
- **Источники:** ST1-03, ST1-18, ST5-10, LV2-16, LV3-10, LV4-12; противоречие Пр-5.

<a id="da-028"></a>
### DA-028. Окно занятия: до пяти кнопок в подвале, три красные; начальный фокус — на «Удалить» или «Начать урок»; окно из окна

- **Серьёзность:** Major · **Уровень:** A + C · **Раздел:** компоненты, UX
- **Где:** учитель, «Расписание» → занятие. Это ежедневный сценарий «отметить занятие».
- **Что сейчас:**
  - **Подвал** у начавшегося занятия с одним учеником, слева направо:
    - «Удалить» — text красная;
    - «Отменить» — text красная;
    - «Изменить» — tonal;
    - «Пропуск» — tonal красная;
    - «Проведено» — filled зелёная.

    При ссылке на встречу в теле окна есть ещё filled «Начать урок». На 390 px подвал занимает три ряда.
    Снимки `ST1/lesson-details-1440.png`, `ST1/lesson-details-390.png`.
  - **Начальный фокус.** PrimeNG ставит его на первый фокусируемый элемент тела, а если такого нет — подвала
    (`primeng-dialog.mjs:617-627`). Без встречи это «Удалить», со встречей — «Начать урок» с видимым кольцом:
    Enter запускает урок.
  - **Окно из окна.** У группового занятия «Отметить» в списке открывает окно занятия, а оттуда «Отметить
    посещаемость» — второе окно поверх первого. Esc закрывает только верхнее.
- **Как должно быть:**
  - ADR-0019 — в окне не должно быть двух красных кнопок, вес задаёт важность;
  - ADR-0018 — одно главное действие;
  - M3 — у диалога два-три действия, окно из окна не открывают (по памяти, требует сверки);
  - Нильсен №8.
- **Почему важно:** три красные кнопки разного веса спорят с главным «Проведено». Первым под рукой оказывается
  разрушительное действие.
- **Предложение:**
  - «Удалить» и «Отменить занятие» — в меню «⋮» в заголовке окна. Класс `tb-menu-item--danger` уже есть, но нигде не
    используется;
  - «Изменить» — карандаш в заголовке;
  - «Пропуск | Проведено» — связанная группа;
  - «Начать урок» в окне — tonal;
  - начальный фокус — на заголовок окна;
  - «Отметить» у группы — сразу посещаемость;
  - один компонент, средний риск, уточнение ADR-0019 («одна красная кнопка в любом окне»).
- **Все вхождения:** `features/schedule/teacher/lesson-details-dialog.ts:58-80, 171-262`;
  `features/schedule/teacher/schedule-page.ts:158-165`; `features/schedule/teacher/attendance-dialog.ts:43`.
- **Источники:** ST1-04, LV2-17, LV2-24.

<a id="da-029"></a>
### DA-029. Действия с последствиями — без подтверждения и без «Отменить»

- **Серьёзность:** Major · **Уровень:** C · **Раздел:** UX, состояния
- **Где:** учитель — главная («Сегодня»), расписание («Отметьте прошедшие занятия»), окна досок, видеовстречи и
  календарей, строка ученика, «Мессенджеры учеников», настройки портала; ученик — расписание (отзыв запроса) и
  мессенджеры. Проверено на 1440 и 390 px.
- **Что сейчас:**
  - **«Пропуск» и «Проведено»** в «Отметьте прошедшие занятия» и на главной — одно нажатие на значок 40×40 рядом с
    соседним. Нет ни окна, ни тоста, ни «Отменить»: строка просто исчезает.
    - Проверено на LV2-ученике: баланс +1 000 ₽ → долг 500 ₽, ученик получил уведомление (`LV2/ledger-lv2-after-missed.png`).
    - Вернуть можно только через календарь → занятие → «Снять отметку». Ошибка запроса молча игнорируется.
  - **Без подтверждения и без «Отменить»:**
    - удаление доски (корзина);
    - удаление ссылки на встречу;
    - «Новая встреча в Телемосте» — заменяет ссылку, которую ученики уже получили;
    - «Отключить» Google Календарь и Яндекс;
    - «Отключить» ленту календаря и «Новая ссылка» ленты — старая подписка перестаёт работать;
    - «Ссылка» в строке ученика — перевыпускает приглашение;
    - «Напомнить всем без мессенджера» — отправка 45 ученикам;
    - «×» отключения мессенджера у ученика и учителя;
    - «Убрать» логотип — сразу на сервере, хотя остальная форма ждёт «Сохранить»;
    - «Отозвать» запрос ученика — ни подтверждения, ни тоста.
  - **С подтверждением:** удаление копии, файла, серии, нерабочего времени, отключение бота и ученика, архив группы,
    отмена занятия и оплаты. Правило проведено непоследовательно.
- **Как должно быть:** Нильсен №3 и №5; M3 — подтверждение для необратимого, snackbar с «Отменить» для
  обратимого (по памяти, требует сверки).
- **Почему важно:** промах пальцем списывает оплату и отправляет ученику уведомление. Замена ссылки встречи или
  календаря ломает то, что уже работает у учеников.
- **Предложение:**
  - отметки занятия — тост «Отмечено: пропуск · Отменить», обработка ошибки;
  - отключения интеграций и замены ссылок — `dangerConfirmation`;
  - «Напомнить всем» — `safeConfirmation` с числом получателей;
  - доска, логотип, отзыв — тост с «Отменить»;
  - уровень страниц, малый объём;
  - правило «когда подтверждение, когда отмена в тосте» — в ADR-0019.
  - **меняет функционал:** подтверждения и «Отменить» в тосте добавляют шаги и возможность отмены в сценарии.
- **Все вхождения:**
  - `features/schedule/teacher/schedule-page.ts:166-185, 472-476`;
  - `features/schedule/home/today-lessons-widget.ts:77-99`;
  - `features/boards/manage/boards-dialog.ts:55`;
  - `features/meetings/rooms/room-dialog.ts:67, 84`;
  - `features/schedule/teacher/google-calendar-panel.ts:115`;
  - `features/meetings/settings/meetings-settings-panel.ts:99`;
  - `features/schedule/ui/calendar-feed-panel.ts:57, 65`;
  - `features/identity/students/students-page.ts:434-443`;
  - `features/notifications/teacher/student-messengers-panel.ts:36-45, 149-160`;
  - `features/notifications/channels/channels-panel.ts:72`;
  - `features/settings/portal-settings-card.ts:168`;
  - `features/schedule/student/my-schedule-page.ts:118, 197, 301-314`.
- **Источники:** ST1-11, LV2-07, LV2-31, LV2-32, LV3-19, LV3-28, LV3-29.

<a id="da-030"></a>
### DA-030. Нет обратной связи после частых действий: результат уходит за край экрана

- **Серьёзность:** Major · **Уровень:** C · **Раздел:** состояния, UX
- **Где:** учитель — расписание, главная («Сегодня»), «Ученики» → группы; ученик — главная и расписание. 1440 и 390 px.
- **Что сейчас:**
  - **Без тоста** — учитель: создание разового и группового занятия, ответ на запрос («Согласовать»), создание
    группы, отметка «Проведено» и «Пропуск». Ученик: отправка запроса с главной, отзыв запроса.
  - **С тостом:** регулярные занятия, оплата, возврат и приём работы, сообщение ученикам, напоминание, правка
    ученика, цена, запрос из расписания ученика.
  - Новое занятие появляется в календаре ниже экрана, новая группа — в конце страницы высотой около 15 000 px.
  - Снимки: `LV2/schedule-after-lesson-create-1440.png`, `LV2/schedule-after-answer-1440.png`,
    `LV2/groups-after-create-1440.png`.
- **Как должно быть:** Нильсен №1 и №4 — одинаковая обратная связь для одинаковых действий; M3 snackbar — короткое
  подтверждение.
- **Почему важно:** учитель не видит, сохранилось ли, и нажимает второй раз (см. DA-064).
- **Предложение:** тост в обработчиках `saved`, `answered`, `created`, `mark()`; уровень страницы, 1–2 строки на место.
- **Все вхождения:**
  - `features/schedule/teacher/schedule-page.ts:472-476` и обработчики `reload()`;
  - `features/identity/groups/groups-panel.ts:207`;
  - `features/schedule/home/today-lessons-widget.ts`;
  - `features/schedule/home/next-lesson-widget.ts:40-54, 70`;
  - `features/schedule/student/my-schedule-page.ts:301-314`.
- **Источники:** LV2-06, LV3-19.

<a id="da-031"></a>
### DA-031. Длинные списки без поиска и порций: «Группы» на глубине 15 000 px, журнал — 56 780 px

- **Серьёзность:** Major · **Уровень:** A (ADR-0018 §Списки и фильтры: «поиск слева») + C · **Раздел:** UX, компоненты
- **Где:** учитель — «Ученики», «Оплаты», «Уведомления» → «Мессенджеры учеников», «Задания» → «На проверку»;
  администратор — «Журнал». 1440 и 390 px; на стенде 45 учеников, 66 работ на проверке, 200 записей журнала.
- **Что сейчас:**
  - **«Ученики»:**
    - 45 карточек по 316–461 px, страница 15 475 px на 1440 и 19 028 px на 390;
    - карточка «Группы» начинается на y ≈ 14 800 px;
    - пустые строки «Контакты» и «Группы» занимают место в каждой карточке.
  - **«Оплаты»** — 45 строк, над таблицей только тумблер «Только должники», поиска нет.
  - **«Мессенджеры учеников»** — 45 строк без поиска.
  - **Очередь «На проверку»** — 66 работ без поиска, фильтра по заданию и сортировки.
  - **Журнал администратора:**
    - 200 записей без порций;
    - на 390 px каждая запись — карточка 342×274, страница 56 780 px;
    - «Подробный журнал» начинается на y ≈ 55 976 px;
    - фильтры занимают весь первый экран.

    Снимок `LV4/admin-logs-390-light-viewport.png`.
- **Как должно быть:** ADR-0018 §Списки и фильтры; ADR-0021 — сверху то, что требует действия; Нильсен №7 и №8.
- **Почему важно:** создать группу, найти должника или включить подробный журнал — частые действия. Сейчас это
  прокрутка на 15–56 тысяч пикселей или Ctrl+F.
- **Предложение** (уровень страниц):
  - поиск в `tb-toolbar` «Оплат», «Мессенджеров учеников», очереди проверки;
  - «Группы» — выше учеников или якорь «Группы» в заголовке;
  - пустые строки карточки скрывать;
  - журнал — порции по 50 с «Показать ещё»; «Подробный журнал» — `tb-fold-card` над выдачей;
  - на телефоне фильтры журнала — поисковая строка и чипы «Период», «Уровень», остальное в `tb-sheet`;
  - строка записи на телефоне — плотнее.
  - **меняет функционал:** поиск в списках, порции журнала, порядок блоков «Ученики» и «Группы».
- **Все вхождения:**
  - `features/identity/students/students-page.ts:92-261`;
  - `features/billing/teacher/billing-overview-page.ts:106`;
  - `features/notifications/teacher/student-messengers-panel.ts:26-90`;
  - `features/homework/teacher/review-queue-page.ts:31-80`;
  - `features/admin/logs/log-page.ts:36, 61-160`;
  - `features/admin/logs/logger-levels-panel.ts:28-88`.
- **Источники:** LV2-09, LV4-05, LV2-08.

<a id="da-032"></a>
### DA-032. Проверка работ: «Назад» ведёт на задание, а не в очередь; нет «Следующей работы»; прокрутка теряется

- **Серьёзность:** Major · **Уровень:** C · **Раздел:** навигация, UX
- **Где:** `/teacher/homework/review` → «Проверить» → страница работы.
- **Что сейчас:**
  - Стрелка «Назад» ведёт на страницу задания, а не в очередь.
  - Браузерный «Назад» возвращает очередь в начало: прокрутка 3 000 → 0 px.
  - После «Принять» или «Вернуть» учитель остаётся на странице работы.
  - Заголовок вкладки у всех работ одинаковый — «Проверка работы».
  - Просроченная сдача в очереди не выделена.
  - Итог — около четырёх переходов на каждую из 66 работ.
- **Как должно быть:** Нильсен №7 (ускорители для частой работы) и №3; ADR-0018 §Заголовок — «Назад» ведёт туда,
  откуда пришли по смыслу.
- **Почему важно:** проверка работ — ежедневная работа учителя.
- **Предложение:**
  - «Следующая работа» после решения или автопереход;
  - `back` с учётом `?from=review`;
  - восстановление прокрутки;
  - имя ученика в заголовке вкладки;
  - фильтр по заданию;
  - уровень страницы.
  - **меняет функционал:** «Следующая работа», автопереход и фильтр по заданию.
- **Все вхождения:** `features/homework/teacher/task-review-page.ts:56-57`;
  `features/homework/teacher/review-queue-page.ts:31-80`; `app.routes.ts:56`.
- **Источники:** LV2-08.

<a id="da-033"></a>
### DA-033. Время показывается в поясе браузера без подписи и расходится с уведомлениями

- **Серьёзность:** Major · **Уровень:** C · **Раздел:** тексты, UX
- **Где:** ученик и учитель, если часовой пояс устройства отличается от `TEACHERBOX_TIMEZONE`. Затронуты главная,
  расписание, окна, списки заданий, входящие.
- **Что сейчас:** живой замер — браузер в поясе Asia/Novosibirsk, портал в Europe/Moscow.
  - Ученица видит в расписании «ср, 30.09, 15:00–16:30», а во входящих — «Скоро занятие: среда, 30.09 в 11:00».
    Пояс не подписан нигде.
  - У учителя в «Сегодня» — занятие на 02:00–02:45. По поясу портала оно сегодня в 22:00, по поясу устройства —
    завтра.
  - В одном списке смешаны пояса:
    - регулярные занятия и еженедельное нерабочее время — в поясе портала;
    - разовое нерабочее время — в поясе браузера.
  - Подсказку о поясе показывают только «Расписание» учителя и окна регулярных занятий и нерабочего времени. У
    ученика её нет.
  - Все `DatePipe` (около 40 мест) и `Intl.DateTimeFormat` работают без `timeZone`, а текст уведомлений и бота сервер
    пишет в поясе портала.
- **Как должно быть:** один пояс на всех экранах и в уведомлениях — либо явная подпись («по времени портала,
  Москва»); Нильсен №1 и №4.
- **Почему важно:** ученик в другом городе или в поездке придёт не в то время. Веб и бот показывают разное время
  одного занятия.
- **Предложение:**
  - общий форматтер `shared/dates` с поясом портала (из `Portal` или настроек расписания) или с подписью пояса,
    если пояса различаются;
  - подсказку показать и ученику;
  - средний объём, нужен ADR (выбор «пояс портала или устройства»); меняет функционал отображения.
- **Все вхождения:**
  - `features/schedule/schedule-labels.ts:65-92, 102-123`;
  - `features/schedule/teacher/schedule-page.ts:351-354`;
  - `features/schedule/teacher/series-dialog.ts:119-120`;
  - `features/schedule/teacher/off-time-dialog.ts:109-110`;
  - `features/settings/setup/setup-page.ts:152-159`;
  - `features/schedule/home/today-lessons-widget.ts`;
  - `features/schedule/home/next-lesson-widget.ts`;
  - `features/schedule/student/my-schedule-page.ts`;
  - `features/schedule/student/change-request-dialog.ts:55`;
  - `features/schedule/teacher/lesson-dialog.ts:87`;
  - все `DatePipe` из DA-072;
  - backend: `notifications/application/ScheduleNotifications.java:200, 207`.
- **Источники:** ST5-04.

<a id="da-034"></a>
### DA-034. Справка расходится с экраном и обещает то, чего нет; поиск не прощает «е/ё»; часть статей не привязана к «?»

- **Серьёзность:** Major · **Уровень:** C + A (ADR-0018: справка секции — «?», а не «Подробнее») · **Раздел:** тексты,
  навигация
- **Где:** справка трёх ролей (`/teacher/help`, `/cabinet/help`, `/admin/help`), кнопки «?» в заголовках карточек,
  страница входа, `README.md`.
- **Что сейчас:**
  - **Названия, которых нет на экране:**

    | Справка | Экран |
    |---|---|
    | «Календарь по ссылке» → «Создать ссылку» | «Календарь на телефоне» → «Получить ссылку» |
    | «Сдать» | «Отправить на проверку» |
    | «колокольчик → Все уведомления или меню» | колокольчик сразу открывает раздел, в меню пункта нет |
    | «Старт» | «Запустить» |
    | «Принять перенос» | «Согласовать» (а окно открывает «Ответить») |
    | «Сделать копию» | «Создать копию сейчас» |
    | «Напомнить» | «Напомнить всем без мессенджера» / «Напомнить выбранным» |
    | «карандаш у серии» | слова «серия» в интерфейсе нет |
    | шаги «Адрес портала», «Стоимость занятия» | «Адрес», «Занятия» |
    | «Отменить или Перенести» | порядок «Перенести», «Отменить» |
    | «в строке ученика справа», «Колонки таблицы» | ученики — карточки |
    | «меню с вашим именем» | на телефоне имени нет |

  - **Обещания того, чего нет:**
    - «Неудачные доставки… можно отправить ещё раз» — у учителя кнопки нет, повтор есть только у администратора;
    - «сумма, дата и способ» оплаты — поля «способ» нет ни в окне, ни в боте;
    - «цена каждого ученика меняется в его строке» — в строке только кошелёк;
    - «неделя, день, месяц» — на компьютере «Неделя, Месяц, Список»;
    - «почта и телефон — их видите только вы» — ученик видит свои;
    - «откроется в приложении Телемоста, если оно установлено» — на Windows режим включён всегда.
  - **Поиск.** `toLocaleLowerCase('ru')` не сводит «ё» к «е»: «отчет», «темная тема», «еще» — 0 статей. Поиск идёт по
    сырому Markdown со ссылками. Не показывает фрагмент и не подсвечивает найденное.
  - **Статьи без «?».**
    - Пять статей не привязаны ни к одному «?»: bot, calendars, appearance, cabinet/login, cabinet/appearance.
    - «?» карточки «Портал» ведёт в «Первоначальную настройку», а цвет и логотип описаны в «Оформлении».
    - Статья «Забыли пароль» недоступна со страницы входа — справка открывается только после входа.
  - **«Подробнее» вместо «?»:** окно досок, мастер бота.
  - **Старые ссылки.** `?tab=students` в виджете «Требует внимания»; «вкладки» в `README.md`.
  - **Панель «?»** — 320 px без затемнения, закрывает кнопки заголовка; кнопка закрытия квадратная.
- **Как должно быть:** справка описывает только существующее и точными подписями (Нильсен №2, №4, №10);
  ADR-0018 §Секции; ADR-0021 — раскладка одинакова, «проще описывать в справке».
- **Почему важно:** пользователь ищет «Календарь по ссылке» или «Сдать» и решает, что функции нет. Большинство
  пишет без «ё», и пустой результат поиска выглядит как «такого нет».
- **Предложение:**
  - около 20 правок текстов справки и `README.md`;
  - в `searchArticles` — нормализация `ё→е` и поиск по тексту без разметки (3–5 строк и тест);
  - «?» в 4 местах; убрать `label` из `HelpButton` или запретить правилом;
  - `?open=students` вместо `?tab=`;
  - публичная выдержка «Забыли пароль?» на странице входа;
  - E2E-проверка: каждая подпись в «ёлочках» из статьи есть в DOM нужной страницы;
  - «Повторить доставку» для учителя — отдельная задача, меняет функционал.
- **Все вхождения:**
  - статьи учителя `features/help/articles/teacher.ts:17, 25-29, 42-46, 60, 70, 77, 83, 151, 153-154, 179, 246, 264, 293,
    297, 321, 348, 366, 372, 376, 394, 402, 416, 479, 488, 491`;
  - статьи ученика `features/help/articles/student.ts:20, 33, 35, 45, 47, 56, 58, 81, 92, 107, 141`;
  - поиск: `features/help/help-library.ts:40-49`;
  - «?» и «Подробнее»:
    - `features/help/help-topics.ts:5-33`;
    - `features/help/help-button.ts:12, 65, 82-83, 126-127`;
    - `features/boards/manage/boards-dialog.ts:39`;
    - `features/notifications/teacher/bot-wizard-dialog.ts:74`;
    - `features/settings/portal-settings-card.ts:57`;
    - `features/notifications/teacher/bot-abilities-panel.ts:14`;
    - `features/schedule/ui/calendar-feed-panel.ts:29`;
    - `features/identity/account/account-page.ts:26`;
  - старые ссылки: `features/home/attention-card.ts:98`; `README.md:188, 189, 232`;
  - `features/billing/teacher/default-price-card.ts:65`;
  - `features/help/help-page.ts` (поиск и панель).
- **Источники:** ST5-02, ST5-03, ST5-05, ST5-13, ST5-19, ST3-08, ST1-27, LV2-27, LV3-26.

<a id="da-035"></a>
### DA-035. Одно понятие — разные слова; «снять начисление» присылает ученику «Занятие отменено»

- **Серьёзность:** Major · **Уровень:** C (частично — осознанное решение ADR-0022) · **Раздел:** тексты
- **Где:** веб всех ролей, бот, тексты уведомлений (backend) и справка.
- **Что сейчас** (полная таблица терминов — в [m3e-ux.md §5](design-audit-2026-09-29-m3e-ux.md#terms)):
  - **Вход на урок** — четыре названия одного действия:
    - «Начать урок» у учителя;
    - «Войти в урок» на главной ученика;
    - «Подключиться» в расписании и листе ученика;
    - «Войти на урок» в боте.
  - **Разнобой слов:**
    - «урок» и «занятие» вперемешку: «Скоро урок:» учителю, «Скоро занятие:» ученику;
    - «работа», «ответ», «сдать», «отправить на проверку»;
    - «На доработке», «На доработку», «Нужно доработать»;
    - «Регулярные занятия», «расписание», «серия», «регулярные уроки»;
    - «Согласовать» (веб) и «Принять» (бот, справка);
    - «Цена» и «Стоимость»; «Долг» и «Задолженность»;
    - пять названий недоставленных уведомлений, ведущих в два разных места;
    - «Изменить» и «Редактировать»; «Далее» и «Дальше»; «E-mail» и «Почта»; «учитель» и «преподаватель».
  - **Пункт меню, заголовок и вкладка** называют раздел по-разному: «Задания» / «Домашние задания», «ИИ» /
    «ИИ-помощник», «Главная» / «Личный кабинет», «Копии» / «Резервные копии» (см. DA-067).
  - **«Отменить занятие»** в истории оплат — это снятие начисления, а в расписании то же действие называется
    «Снять отметку». Оба пути публикуют `LessonCancelled`, и ученик получает «Занятие <дата> отменено. Оплата за него
    не списывается.» — хотя учитель лишь поправил ошибочную отметку. Проверено по коду backend, вживую не
    воспроизводилось.
  - Обращение везде на «вы» ✓, «ё» и «ёлочки» единообразны ✓, суммы — одним форматтером ✓.
- **Как должно быть:** одно понятие — одно слово в вебе, боте, уведомлениях и справке (Нильсен №4); уведомление
  называет то, что случилось.
- **Почему важно:** пользователь не узнаёт по справке и уведомлению то, что видит на экране. Ученик получает ложное
  «занятие отменено».
- **Предложение:**
  - словарь терминов — `docs/glossary.md` или раздел ADR-0018;
  - выравнивающий проход, около 60 правок, почти все в шаблонах;
  - «Снять начисление» в истории оплат и текст уведомления `BillingNotifications` (backend);
  - у ученика одна подпись — «Войти в урок» и в листе, и в боте. Меняет решение ADR-0022 («Подключиться» в листе).
- **Все вхождения:**
  - таблица терминов — [m3e-ux.md §5](design-audit-2026-09-29-m3e-ux.md#terms);
  - `features/billing/ledger/ledger-table.ts:77-78`;
  - `features/billing/teacher/student-ledger-page.ts:221-223`;
  - `features/schedule/teacher/lesson-details-dialog.ts:194, 229`;
  - `features/schedule/student/my-schedule-page.ts:112, 190`;
  - `features/schedule/ui/lesson-actions.ts:48`;
  - `features/meetings/ui/join-lesson-button.ts:67`;
  - `features/homework/homework-labels.ts:6`;
  - `features/homework/home/my-deadlines-widget.ts:45`;
  - backend:
    - `notifications/application/BillingNotifications.java:35-39`;
    - `notifications/application/ScheduleNotifications.java:200, 207`;
    - `meetings/chat/JoinLessonChatAction.java:34, 60`.
- **Источники:** ST5-06, ST5-07, ST5-09, ST1-25, LV3-11, LV3-34.

<a id="da-036"></a>
### DA-036. Учителю показывают имена переменных окружения вместо «попросите администратора»

- **Серьёзность:** Major · **Уровень:** A (ADR-0016: эти настройки — у администратора в интерфейсе; ADR-0010 —
  техника у администратора) · **Раздел:** тексты
- **Где:** учитель:
  - `/teacher/ai`: пустое состояние из 8 строк переменных, `LV4/empty-ai-390-light-viewport.png`;
  - «Настройки»: «см. .env.example», «TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY»;
  - мастер, шаг «Адрес»: `TEACHERBOX_PUBLIC_URL`, `TEACHERBOX_TIMEZONE`;
  - Телемост;
  - тексты ошибок;
  - справка.
- **Что сейчас:** все эти параметры есть в каталоге администратора (`platform/settings/SettingsCatalog.java:46, 48, 83,
  96`), но интерфейс учителя ни разу не называет администратора. ИИ «исчезает» без объяснения: кнопки «Сгенерировать
  с ИИ» просто нет. «Адрес портала» выглядит редактируемым полем, хотя задан сервером.
- **Как должно быть:** Нильсен №2; «Это настраивает администратор портала: Настройки → ИИ».
- **Почему важно:** учитель не может действовать по такому тексту — и это единственное содержимое раздела «ИИ».
- **Предложение:** тексты, около 15 мест. Неактивная кнопка «Сгенерировать с ИИ» с подсказкой вместо её отсутствия.
  Имена переменных оставить в справке администратора.
- **Меняет функционал:** неактивная кнопка «Сгенерировать с ИИ» вместо её отсутствия.
- **Все вхождения:**
  - `features/ai/ai-usage-page.ts:71-80`;
  - `features/settings/settings-page.ts:93-94, 117`;
  - `features/notifications/teacher/bots-panel.ts:45-46`;
  - `features/notifications/teacher/bot-wizard-dialog.ts:165-166`;
  - `core/portal/portal-address-field.ts:35-39`;
  - `features/settings/setup/setup-page.ts:155-159, 227`;
  - `features/meetings/settings/meetings-settings-panel.ts:92`;
  - `core/http/error-messages.ts:65, 68, 83, 134, 147`;
  - `features/homework/teacher/assignment-dialog.ts:70-78, 105`;
  - справка `features/help/articles/teacher.ts:52, 60, 248`.
- **Источники:** ST5-08, LV2-26, LV4-19.

<a id="da-037"></a>
### DA-037. Кнопки форм, секций и окон стоят не на своих местах

- **Серьёзность:** Major (разнобой между экранами) · **Уровень:** A (ADR-0018 §Секции) · **Раздел:** компоненты,
  адаптивность
- **Где:** формы (проверка и сдача работы, смена пароля, мастер настройки), секции «Уведомлений» и страниц
  администратора, шапка расписания учителя, окна досок, видеовстречи, восстановления и сброса. 1440 и 390 px.
- **Что сейчас:**
  - **`tb-form-actions`** используется в 5 из 16 форм. Кнопки слева и не во всю ширину на телефоне:
    - «Отправить на проверку» — 231 px на 390;
    - «Сменить пароль» — 160 px;
    - «Принять» и «Вернуть на доработку» на проверке работы;
    - шаги мастера настройки.
  - **Действия секций** стоят в теле карточки, а не в строке заголовка: «Прочитать все», «Написать ученикам»,
    «Напомнить…», «Повторить все», «Отправить все повторно», «Проверить», «Скачать архив».
  - **«Регулярные занятия» и «Нерабочее время»** — в шапке страницы, а не в своих карточках. На 390 px это две кнопки
    по 366 px, шапка 160 px, и они не делят ширину, как требует ADR-0018.
  - **Действия окон в теле**, а не в подвале: доски (порядок «Добавить | Отмена» обратный остальным), восстановление,
    сброс, видеовстреча (подвала нет).
  - **Секции без заголовка** рядом с озаглавленными: «Ученики», «Оплаты», «Входящие» ученика, журнал, ИИ.
- **Как должно быть:** ADR-0018 §Секции — действия секции tonal справа в `tb-card-title`; кнопки формы внизу справа,
  на телефоне во всю ширину. ADR-0015 — кнопки окна в подвале.
- **Почему важно:** на телефоне кнопки то во всю ширину, то узкие слева, то посреди пустого экрана — глаз ищет их
  каждый раз заново.
- **Предложение:**
  - обернуть в `tb-form-actions`, перенести в `tb-card-title__actions` и `#footer`;
  - для окон с формой — подвал с `button[form]` (см. DA-063);
  - перенос кнопок «Регулярные занятия» в карточки — решить в ADR-0018.
- **Все вхождения:**
  - формы:
    - `features/homework/teacher/task-review-page.ts:72-80, 108-135`;
    - `features/homework/student/my-task-page.ts:93-101`;
    - `features/identity/account/change-password-form.ts:71-79`;
    - `features/identity/account/account-page.ts:43`;
    - `features/settings/setup/setup-page.ts:134, 162, 192, 231`;
  - действия секций:
    - `features/notifications/inbox/inbox-panel.ts:22-37`;
    - `features/notifications/teacher/broadcasts-panel.ts:19-30`;
    - `features/notifications/teacher/student-messengers-panel.ts:31-46`;
    - `features/admin/events/events-page.ts:34-41, 73-80`;
    - `features/admin/integrations/integrations-page.ts:44-52`;
    - `features/admin/diagnostics/diagnostics-page.ts:27`;
  - шапка расписания: `features/schedule/teacher/schedule-page.ts:96-107`;
  - окна:
    - `features/boards/manage/boards-dialog.ts:100-112`;
    - `features/settings/backups/restore-dialog.ts:70-84`;
    - `features/settings/reset-card.ts:80-94`;
    - `features/meetings/rooms/room-dialog.ts:59-117`;
  - секции без заголовка:
    - `features/identity/students/students-page.ts:93`;
    - `features/billing/teacher/billing-overview-page.ts:105`;
    - `features/notifications/inbox/inbox-panel.ts:21`;
    - `features/admin/logs/log-page.ts:62, 105`;
    - `features/ai/ai-usage-page.ts:79`.
- **Источники:** ST1-17, ST3-12, ST3-13, LV2-22, LV3-15, LV4-12, LV4-18.

<a id="da-038"></a>
### DA-038. Строки данных в карточках и окнах — своими списками, а не `tb-list` и `tb-stats`

- **Серьёзность:** Major (одни и те же строки выглядят по-разному) · **Уровень:** A (ADR-0020, ADR-0021) ·
  **Раздел:** компоненты
- **Где:** «Настройки» учителя (интеграции), «Мои доски» ученика, окна досок, занятия и посещаемости, «ИИ» (расход),
  «Финансы» на главной учителя, «Интеграции» администратора.
- **Что сейчас:** свои разметки вместо сегментированного списка:
  - интеграции в «Настройках» — `ul.tb-integrations`: строки без плиток, «подключить» строчными
    (`ST3/phone_settings-integrations.png`);
  - «Мои доски» — столбик tonal-кнопок 42 px, подпись сбоку или снизу;
  - доски в окне;
  - участники занятия — без аватара;
  - посещаемость;
  - расход ИИ — маркированный текст вместо `tb-stats`;
  - одиночная карточка `tb-stat` вне `tb-stats`;
  - «Финансы» на главной — своя копия `tb-stats` (`.tb-finance`, зазор 12 px вместо плиток через 2 px).

  Спорно: проверки «Интеграций» у администратора — ADR-0021 описывает их словами, но не плитками.
- **Как должно быть:** ADR-0020 — «любой список внутри карточки — сегментированный список» (кроме шагов, справки,
  чек-листа, возможностей бота и файлов); ADR-0021 — показатели в `tb-stats`.
- **Почему важно:** интеграции, доски и участники выглядят по-разному от экрана к экрану.
- **Предложение:** `ul.tb-list` плюс `tb-avatar` / `tb-list__lead`; для окон — записать в ADR-0020, распространяется ли
  правило на них.
- **Все вхождения:**
  - `features/settings/settings-page.ts:62-109`;
  - `features/boards/student/my-boards-card.ts:15-46`;
  - `features/boards/manage/boards-dialog.ts:41-67`;
  - `features/schedule/teacher/lesson-details-dialog.ts:90-102`;
  - `features/schedule/teacher/attendance-dialog.ts:52-68`;
  - `features/ai/ai-usage-page.ts:79-85, 99-106`;
  - `features/billing/home/finance-widget.ts:18-32, 59-80`;
  - `features/admin/integrations/integrations-page.ts:57-68`.
- **Источники:** ST3-05, LV3-24.

<a id="da-039"></a>
### DA-039. «Подключиться» в строках ближайших занятий скачет, «Отозвать» уже соседних

- **Серьёзность:** Major · **Уровень:** A (ADR-0021 §Кнопки на месте) · **Раздел:** компоненты
- **Где:** ученик, `/cabinet/schedule`, 1024 и 1440 px, строка с запросом, ждущим ответа.
- **Что сейчас:**
  - «Подключиться» стоит на x = 937 в строках 1–3 и на x = 1086 в строке с «Отозвать». На 1024 px — 521 и 670.
  - «Отозвать» шириной 112 px против 136 px у «Отменить» и «Не приду»: `tb-button-steady` на ней не стоит, а хвост
    строки выровнен вправо.
  - Снимки: `LV3/anna-schedule-1440-light.png`, `ST1/student-schedule-upcoming-1440.png`.
- **Как должно быть:** ADR-0021 §Кнопки на месте — одинаковые кнопки соседних строк стоят в одной колонке и одной
  ширины; «Отозвать» — кнопка строки той же ширины, что «Отменить» и «Не приду» (этап 67.2 плана).
- **Почему важно:** перед уроком взгляд ищет «Подключиться» на одном месте.
- **Предложение:**
  - хвост строки — фиксированные «слоты»: пустое место вместо «Перенести», «Отозвать» с `tb-button-steady`;
  - либо `justify-content: flex-start` в колонке хвоста;
  - общий класс или компонент.
- **Все вхождения:** `features/schedule/student/my-schedule-page.ts:109-126`; `features/schedule/ui/lesson-actions.ts:25-42`;
  `styles.scss:693-702, 793-795`.
- **Источники:** ST1-14, LV3-08.

<a id="da-040"></a>
### DA-040. Правка цены на телефоне ломает вёрстку — ровно тот дефект, который назван в ADR-0018

- **Серьёзность:** Major · **Уровень:** A (ADR-0018 §Контекст: «поле цены в «Счёте ученика» выходит за экран»;
  ADR-0022 §Поля) · **Раздел:** адаптивность
- **Где:** 390 px:
  - «Оплаты» → карандаш «Цена для новых учеников»;
  - история оплат ученика → «Изменить цену занятия».
- **Что сейчас:**
  - Подпись сжата в столбик по слову: «Цена / для / новых / учеников».
  - «Цена занятия» наезжает на поле.
  - Подсказка «Отменить» после касания рисуется вертикально по букве и раздвигает страницу до 398 px.
  - Кнопка сохранения — круглая залитая зелёная (см. DA-026).
  - Снимки: `LV2/billing-default-price-edit-390.png`, `LV2/ledger-price-edit-390.png`.
- **Как должно быть:** ADR-0022 §Поля — поле с подписью на рамке во всю ширину колонки; ADR-0018 — вёрстка не
  выходит за экран, кнопки правки — пара tonal «Сохранить | Отмена», а не «капля».
- **Почему важно:** цена — второй шаг первоначальной настройки.
- **Предложение:**
  - режим правки `tb-stat--editing`: поле во всю ширину под подписью, `.tb-field` с подписью на рамке, кнопки — `tb-copy-row`;
  - подсказки не показывать по касанию;
  - 2 компонента.
- **Все вхождения:** `features/billing/teacher/student-ledger-page.ts:63-110`; `features/billing/teacher/default-price-card.ts:20-65`.
- **Источники:** LV2-04, ST1-08.

<a id="da-041"></a>
### DA-041. Окна подтверждения растягиваются по длине текста до 1127 px; ширины окон заданы по месту

- **Серьёзность:** Major · **Уровень:** B + A · **Раздел:** компоненты, форма
- **Где:** все `p-confirmdialog` (ученики, группы, расписание, файлы задания, копии, бот) и 22 окна форм с шириной
  по месту; окна подтверждения паролем (восстановление, настройки, сброс). 1440 и 390 px.
- **Что сейчас:**
  - **`p-confirmdialog` на 1440 px:**

    | Окно | Ширина |
    |---|---|
    | «Убрать группу в архив?» | 1127 px |
    | «Завершить регулярные занятия?» | 932 px |
    | «Отключить доступ?» | 841 px |
    | «Удалить файл?» | 772 px |

    На 390 px окно идёт от края до края, а углы 28 px прижаты к краям. Снимки
    `LV2/dlg-group-archive-confirm-1440.png`, `LV2/dlg-deactivate-confirm-390.png`.
  - **Окна форм** — inline `[style]="{ width }"`, 6 разных значений (30, 32, 34, 36, 40, 44 rem) в 22 окнах.
    36–44 rem — это 576–704 px.
  - **Окна с одним полем пароля** (восстановление, сохранение настроек, сброс) на телефоне открываются на весь экран:
    80 % экрана пусто между полем и кнопками (`LV4/dlg-settings-confirm-390.png`). А `p-confirmdialog` —
    обычное окно с углами 28 px.
- **Как должно быть:**
  - M3 dialog — ширина 280–560 dp (по памяти, требует сверки), поля от краёв экрана;
  - full-screen — для сложных задач (см. раздел 5, С-8).
- **Почему важно:** строку в 1 100 px трудно читать. Окна одной важности выглядят по-разному.
- **Предложение:**
  - `styles.scss`: `.p-confirmdialog { width: min(35rem, calc(100vw - 2rem)) }`;
  - классы `tb-dialog` и `tb-dialog--wide` вместо 22 inline-ширин;
  - класс-исключение «обычное окно на телефоне» для окон подтверждения паролем.
- **Все вхождения:**
  - `p-confirmdialog` — список в DA-012;
  - ширины: 30 rem ×5, 32 rem ×5, 34 rem ×7, 36 rem ×3, 40 rem ×1, 44 rem ×1 (полный список — ST2-16);
  - `styles.scss:1628-1666`.
- **Источники:** LV2-11, ST2-16, LV4-29.

<a id="da-042"></a>
### DA-042. Календарь на телефоне: названия обрезаны без многоточия, «? Занятие», точки без легенды, «Занятий нет» чужого вида

- **Серьёзность:** Major · **Уровень:** C · **Раздел:** адаптивность, компоненты
- **Где:** 390 px, «Расписание» учителя и ученика, вид «Список»; тёмная тема.
- **Что сейчас:**
  - **Обрезка.** Заголовок события — 112 px с `overflow: hidden; text-overflow: clip; white-space: nowrap`:
    «Анна Смирнова ·», «Константинополи», «Квадратные урав».
  - **Запрос.** Занятие с запросом показано как «? Занятие» с оранжевой пунктирной рамкой.
  - **Точки статусов** — зелёная, сиреневая, розовая — без легенды. В тёмной теме тёмно-синие на чёрном почти
    не видны.
  - **Без заголовка.** У карточки календаря нет заголовка; заголовок периода 18/24 700 — вне шкалы.
  - **«Занятий нет»** — серый блок FullCalendar.
  - **axe** `aria-required-children` на FullCalendar.
  - Снимки: `LV2/schedule-390-list-view.png`, `LV3/anna-schedule-390-light.png`.
- **Как должно быть:** ADR-0021 §Переносы; M3 lists — двухстрочный пункт; цвет — не единственный носитель смысла
  (WCAG 1.4.1).
- **Почему важно:** на телефоне расписание — главный способ узнать, с кем и о чём урок.
- **Предложение:**
  - перенос строк в списке, колонка времени уже;
  - подпись «Запрос на перенос» вместо «?»;
  - подписи статусов или легенда;
  - заголовок карточки «Календарь»;
  - пустой день — `tb-empty-state`.
- **Все вхождения:** `features/schedule/ui/schedule-calendar.ts:96-112, 185`;
  `features/schedule/student/my-schedule-page.ts:162-171`; `styles.scss:1113-1275`.
- **Источники:** LV2-12, LV3-27.

<a id="da-043"></a>
### DA-043. Без поддержки `oklch(from …)` диалоги, меню и тосты становятся прозрачными

- **Серьёзность:** Major · **Уровень:** B (осознанное решение ADR-0017, последствия описаны неполно) + C ·
  **Раздел:** цвет
- **Где:** все экраны в браузерах без относительного синтаксиса цвета: Chrome < 119, Safari < 16.4, Firefox < 128
  (по памяти, требует сверки).
- **Что сейчас:**
  - Становятся невалидными 22 пользовательских свойства с `oklch(from …)`, а через цепочку `var()` за ними — все роли
    поверхностей, текста, обводок и семантические токены PrimeNG.
  - Симуляция (переменные подменены на неразбираемое значение):
    - `body`, карточки, плитки, **диалоги** — `rgba(0,0,0,0)`;
    - диалог прозрачный поверх списка учеников;
    - меню, тост и подсказка тоже прозрачные;
    - рамки полей чёрные.

    Снимки: `ST4/no-relative-color-dialog-dark.png`, `ST4/no-relative-color-students-light.png`.
  - ADR-0017 пишет только «нейтральные цвета не вычисляются… приемлемо».
  - Фактический минимум браузера с учётом `linear()` и `:has()` — Chrome 119, Safari 17.2, Firefox 128.
  - `tone()` у части цветов выходит за пределы sRGB: secondary-container у indigo, blue, violet; tertiary у зелёных.
- **Как должно быть:** интерфейс читаем в любом поддерживаемом браузере — цвета считаются заранее (готовые sRGB) или
  есть запасной вариант через `@supports`; минимальные версии браузеров записаны в ADR-0017 §Последствия.
- **Почему важно:** ученики заходят с чего угодно, в том числе со старых iPad. Прозрачное окно «Сдать работу» —
  сорванный сценарий, а ошибок в консоли нет.
- **Предложение:**
  - считать `tone()` в JS при `applyAccent`: преобразование OKLCH → sRGB около 40 строк, без зависимостей;
  - передавать готовые hex в пресет. Заодно это позволит проверять все роли (DA-010) и подрезать насыщенность до sRGB;
  - либо `@supports not (color: oklch(from red l c h))` с фиксированными нейтралями;
  - записать минимальные версии браузеров в ADR-0017 §Последствия.
- **Все вхождения:** пресет `:14-17, 26-37, 45-50, 61, 63, 80-85, 95-98, 102`.
- **Источники:** ST4-07, ST4-28.

<a id="da-044"></a>
### DA-044. Ученик: «Перенести» и «Отменить» предлагаются для уже идущего занятия; время переноса — стрелками по 5 минут

- **Серьёзность:** Major · **Уровень:** C · **Раздел:** UX, компоненты
- **Где:** ученик — главная («Ближайшее занятие»), расписание (строки и нижний лист), окна «Перенести занятие» и
  «Отменить занятие». 390 и 1440 px.
- **Что сейчас:**
  - **Идущее занятие.** Ученик открыл главную через 10 минут после начала: там «вт, 29.09, 18:54–19:54» без пометки
    «идёт сейчас» и кнопки «Перенести | Отменить». Окно пишет «До занятия осталось мало времени…», а после отправки
    сервер отвечает «Перенести или отменить можно только предстоящее занятие» (`LV3/lv3-cancel-ongoing-390-light.png`).
  - **Выбор времени:**
    - формат поля не подсказан, «30.09.26 11:00» молча стирается при уходе из поля;
    - по умолчанию стоит «сейчас» (18:41 — не кратно шагу);
    - время меняется только стрелками ±5 мин: от 18:41 до 16:00 около 30 нажатий;
    - дни следующего месяца серые, как прошедшие;
    - занятость учителя видна только сообщением после выбора.
  - **Панель даты.** На 390 px прижата к левому краю, на 1440 px уходит на −2 px выше окна и закрывает его заголовок.
- **Как должно быть:** Нильсен №1, №5, №7; M3 time picker — поле ввода или циферблат (сверено: MW
  `_md-comp-time-input.scss`: поля 96×72).
- **Почему важно:** опоздавший ученик хочет предупредить — и получает отказ уже после ввода комментария. Перенос —
  частая просьба.
- **Предложение:**
  - условие `startsAt > now` в `canAsk` и в виджете; подпись «Идёт сейчас» и только «Войти в урок»;
  - подсказка формата «дд.мм.гггг чч:мм», неразобранный ввод сохранять и подсвечивать ошибкой;
  - время — отдельным полем со списком свободных слотов (данные `teacherBusy` уже есть) или `stepMinute` с
    округлением; `selectOtherMonths`.
  - **меняет функционал:** выбор времени из списка свободных слотов. Скрытие «Перенести» и «Отменить» у идущего
    занятия функционал не меняет — сервер уже отказывает.
- **Все вхождения:**
  - `features/schedule/home/next-lesson-widget.ts:33, 48`;
  - `features/schedule/student/my-schedule-page.ts:295-299`;
  - `features/schedule/student/change-request-dialog.ts:54-75, 141-148, 162-177`;
  - `features/schedule/teacher/lesson-dialog.ts:88`.
- **Источники:** LV3-07, LV3-18, LV2-35.

<a id="da-045"></a>
### DA-045. У ученика путь к подключению мессенджера длинный: «Подключить» на главной ведёт в начало ленты

- **Серьёзность:** Major · **Уровень:** C · **Раздел:** навигация, UX
- **Где:** ученик — главная (карточка «Получайте уведомления в мессенджере») → `/cabinet/notifications`. 390 и 1440 px.
- **Что сейчас:**
  - Карточка «Получайте уведомления в мессенджере» → «Подключить» ведёт на `/cabinet/notifications` без якоря.
  - Карточка «Мессенджеры» стоит ниже ленты из 20 уведомлений и «Показать ещё» — у anna на y = 3258 из 4212, около
    четырёх экранов вниз.
  - Там снова «Подключить», и только потом окно.
- **Как должно быть:** одна цель — одно действие (Нильсен №7); ADR-0021 — сверху то, что требует действия.
- **Почему важно:** мессенджер — главный канал напоминаний о занятиях.
- **Предложение:**
  - ссылка сразу открывает окно кода (`?connect=TELEGRAM`) или ведёт на якорь `#messengers`;
  - настройки ученика — свёрнутые секции над лентой, как у учителя (`tb-fold-card`).
  - **меняет функционал:** ссылка сразу открывает окно кода; порядок секций «Уведомлений» ученика.
- **Все вхождения:** `features/notifications/student/connect-messenger-card.ts:33`;
  `features/notifications/notifications-page.ts:110-114`.
- **Источники:** LV3-13.

<a id="da-046"></a>
### DA-046. Сдача работы с файлом: ошибки двойные, лимит не назван, 413 не расшифрован, перетаскивания нет

- **Серьёзность:** Major · **Уровень:** C · **Раздел:** состояния, тексты, UX
- **Где:** ученик, сдача работы, 390 px.
- **Что сейчас:**
  - **.exe** — тост «Ошибка: Такой тип файла загружать нельзя» и то же сообщение в форме, без списка допустимых типов.
  - **21 000 000 Б** показан как «20 МБ» и отвергнут «Файл слишком большой» — уже после загрузки, лимит 20 МБ не назван.
  - **26,5 МБ** (больше multipart 25 МБ) — «Не удалось отправить ответ».
  - **Перетаскивания нет** — обработчиков dragover и drop нет.
  - **Два тоста подряд.** Ошибочный тост и «Отправлено» видны одновременно.
  - **Двойные сообщения в окнах.** По коду в окнах ученика, группы, оплаты, встречи, досок, задания, ответа, рассылки
    и настроек уведомлений ошибка пишется в форму, а запрос не помечен `SKIP_ERROR_TOAST` — и сверху появляется тост с
    тем же текстом.
- **Как должно быть:** Нильсен №5 и №9 — проверка размера и типа до отправки; в сообщении — файл, лимит, допустимые
  типы; одна ошибка — одно сообщение.
- **Почему важно:** ученик не понимает, почему файл не принят и что сделать.
- **Предложение:**
  - проверка в `FilePicker` (лимит — константа или настройка, `ACCEPTED_FILES`);
  - `SKIP_ERROR_TOAST` для запросов с ошибкой в форме;
  - `STATUS_MESSAGES[413]`;
  - зона перетаскивания — по желанию.
  - **меняет функционал:** проверка размера и типа файла до отправки, зона перетаскивания.
- **Все вхождения:**
  - `features/homework/ui/file-picker.ts:7-8, 37, 59-64`;
  - `features/homework/student/my-task-page.ts:147-162`;
  - `features/homework/data-access/homework-api.ts:104`;
  - `core/http/error-messages.ts:56-57, 185-188`;
  - двойные сообщения:
    - `features/identity/students/student-form-dialog.ts:123`;
    - `features/identity/groups/group-form-dialog.ts:172`;
    - `features/billing/teacher/payment-dialog.ts:172`;
    - `features/meetings/rooms/room-dialog.ts:233`;
    - `features/boards/manage/boards-dialog.ts:217`;
    - `features/homework/teacher/assignment-dialog.ts:286`;
    - `features/homework/student/my-task-page.ts:161`;
    - `features/notifications/teacher/broadcast-dialog.ts:153`;
    - `features/notifications/preferences/preferences-panel.ts:222`.
- **Источники:** LV3-14, ST5-14.

<a id="da-047"></a>
### DA-047. Журнал администратора: подробности ошибки раздувают таблицу; код запроса не попадает в адрес; период не сбрасывается

- **Серьёзность:** Major · **Уровень:** C · **Раздел:** адаптивность, UX
- **Где:** `/admin/logs`, 1024–1440 px (запись ERROR со стеком) и 390 px.
- **Что сейчас:**
  - **Раздувание таблицы.** После раскрытия «Подробностей ошибки» колонка «Сообщение» — 1441 px, `scrollWidth`
    контейнера 1713 px при ширине 1064. «Время», «Уровень», «Раздел» сжимаются до 122 / 79 / 71 px и уезжают при
    прокрутке. Снимок `LV4/logs-8092-error-details-1440.png`.
  - **Код не в адресе.** Нажатие на «код …» фильтрует журнал, но адрес остаётся `/admin/logs`: не работают «Назад» и
    ссылка на поиск.
  - **Период.** При ручном вводе кода период остаётся «Последние сутки», и старый код не находится. В `?requestId=` он
    сбрасывается на «Всё время».
  - **Копирования нет** — ни для кода, ни для сообщения.
  - **`pre` со стеком** не получает фокус с клавиатуры.
  - Основное — длина и фильтры — описано в DA-031 и DA-017.
- **Как должно быть:** ADR-0010 — учитель называет код, администратор находит запрос; ADR-0021 §Переносы — без
  прокрутки таблицы вбок; Нильсен №7.
- **Почему важно:** это основной сценарий администратора, а сейчас он требует лишних шагов и ломает таблицу.
- **Предложение:**
  - `table-layout: fixed` или стек отдельной строкой во всю ширину; у `pre` — `tabindex="0"`;
  - фильтры — в query-параметрах;
  - «Копировать» у кода;
  - непустой код → период «Всё время».
  - **меняет функционал:** фильтры журнала в адресе, сброс периода при поиске по коду.
- **Все вхождения:** `features/admin/logs/log-page.ts:118, 138-150, 141-143, 186-196, 230-256`.
- **Источники:** LV4-10, LV4-24.

<a id="da-048"></a>
### DA-048. Настройки администратора: сохранение далеко от правки, правки теряются без предупреждения

- **Серьёзность:** Major · **Уровень:** C + A (ADR-0019: вес кнопки) · **Раздел:** UX, адаптивность
- **Где:** `/admin/settings`: на 390 px — 62 настройки, 12 карточек, страница 11 742 px; также 1440 px.
- **Что сейчас:**
  - **Кнопка сохранения.** Единственная «Сохранить и перезапустить» — в заголовке страницы, не закреплена: после правки
    в середине страницы её не видно (`LV4/d8092-settings-deep-edit-1440.png`). На странице нет счётчика правок.
  - **Потеря правок.** Уход в «Журнал» с несохранёнными правками — без вопроса, правки пропадают.
  - **Окно подтверждения:**
    - поле пароля не в `<form>`, Enter не отправляет;
    - неверное значение сообщается в окне, а поле на странице не подсвечивается;
    - «Отмена» красная, «Сохранить» зелёная — хотя действие делает портал недоступным всем примерно на 15 с;
    - «Сохранить» не говорит о перезапуске, «Изменится настроек: 1».
  - **Вес кнопки.** «Сохранить и перезапустить» в заголовке — filled зелёная (см. DA-026).
- **Как должно быть:** Нильсен №1, №3, №5, №9; ADR-0018 «Сохранить и перезапустить — обычная кнопка в заголовке» —
  длину страницы это не решает.
- **Почему важно:** администратор меняет одно-два значения в длинном списке одной рукой на телефоне.
- **Предложение:**
  - при `changes() > 0` — закреплённая панель внизу: «Изменено: N · Сбросить · Сохранить и перезапустить». Здесь
    уместен docked toolbar M3E (по памяти, требует сверки);
  - `CanDeactivate`-вопрос при уходе;
  - `<form (ngSubmit)>` в окне;
  - подсветка поля по `problemDetail`;
  - в окне — «Сохранить и перезапустить» и «Будет изменена 1 настройка»;
  - новый общий паттерн «панель несохранённых правок» — дополнение ADR-0016 или ADR-0018.
  - **меняет функционал:** панель несохранённых правок и вопрос при уходе со страницы.
- **Все вхождения:** `features/admin/settings/settings-page.ts:83-102, 171-240`.
- **Источники:** LV4-09, LV4-22.

<a id="da-049"></a>
### DA-049. Приглашение: использованная ссылка — тупик; вошедший учитель видит форму ученика; логин проверяет только сервер

- **Серьёзность:** Major · **Уровень:** C · **Раздел:** навигация, UX
- **Где:** `/invite/:token`: использованная ссылка, неверная `/invite/zzz`, ссылка, открытая вошедшим учителем;
  390 и 1440 px.
- **Что сейчас:**
  - **Недействительная ссылка.** Карточка «Приглашение недействительно / Ссылка устарела или уже была использована…»:
    - нет кнопки «Войти», а для вошедшего ученика — «В личный кабинет»;
    - нет названия портала, нет h1.

    Снимки `LV4/invite-used-390-light.png`, `LV4/scn-invite-4-used-signed-in-390.png`.
  - **Вошедший учитель** видит форму «Здравствуйте, Гордей Новенький! Придумайте логин…» без пометки. По коду
    отправка заменит сессию учителя сессией ученика и израсходует приглашение.
  - **Логин.** На клиенте у логина только `maxLength(50)` и required: «ab» и кириллица проходят, ошибка приходит
    после отправки внизу формы. После принятия — сразу кабинет, без «Аккаунт создан».
- **Как должно быть:** Нильсен №3, №5, №9.
- **Почему важно:**
  - ученик, уже создавший аккаунт, второй раз нажимает ссылку из мессенджера, чтобы войти, решает, что доступ
    сломан, и пишет учителю;
  - учитель, проверяя ссылку, может случайно создать ученику аккаунт и выйти из своего.
- **Предложение:**
  - в состоянии `invalid` — «Уже создали аккаунт? Войдите» (filled цвета портала), для вошедшего — «В кабинет»;
  - для вошедшего учителя — баннер «Вы вошли как учитель. Эту ссылку откроет ученик» и неактивная форма;
  - `Validators.pattern(/^[A-Za-z0-9._-]{3,50}$/)` с текстом у поля (см. DA-014);
  - тост при первом входе;
  - уровень страницы.
  - **меняет функционал:** баннер и неактивная форма для вошедшего учителя, проверка логина в браузере, «Войдите»
    для использованной ссылки.
- **Все вхождения:** `features/identity/invite/invite-page.ts:55-61, 63-126, 152-162, 186-190`; `app.routes.ts`
  (маршрут `invite/:token` без guard).
- **Источники:** LV4-08, LV4-16, LV4-28, LV3-30.

<a id="da-050"></a>
### DA-050. Первый запуск: FAB «Занятие» и «Оплата» без учеников ведут в пустой выбор; цена 0 ₽ по умолчанию; мастер не по правилам форм; «С чего начать» теряет сделанные шаги

- **Серьёзность:** Major · **Уровень:** C + A · **Раздел:** UX, состояния
- **Где:** чистый инстанс, 0 учеников, 390 и 1440 px.
- **Что сейчас:**
  - **FAB без учеников.**
    - «Занятие» открывает «Новое занятие», где в списке «С кем» только заголовок группы «Ученики», пусто, без
      сообщения (`LV4/fr-schedule-fab-no-students-390-select.png`).
    - «Оплата» — выбор ученика пуст. Быстрые действия главной ведут туда же.
    - Пустое состояние «Оплат» пишет «Добавьте учеников в разделе «Ученики»» без ссылки.
  - **Мастер настройки:**
    - цена по умолчанию **0,00 ₽**, «Далее» активна;
    - кнопки «Далее», «Назад», «Сохранить и продолжить» — слева и не во всю ширину на телефоне;
    - «Пропустить настройку» — вне карточки;
    - двойной отступ под заголовком: следующий элемент на 176 px против 144 на других страницах;
    - заголовок шага 22/28 400;
    - своя ширина 44rem вместо `tb-stack--narrow`;
    - ошибка «Текущий пароль указан неверно» не исчезает при исправлении;
    - под шагом «Пароль» — «После смены пароля все остальные устройства выйдут», что неуместно при первом входе.
  - **«С чего начать».**
    - «Сделано 1 из 4», а в списке три пункта — какой сделан, не видно;
    - полоса 8 px против 4 px у M3;
    - «Скрыть» пишет в `localStorage`: на другом устройстве список снова виден, а на этом его уже не вернуть.
- **Как должно быть:** Нильсен №1, №3, №5; ADR-0018 — кнопка пустого состояния ведёт к первому действию, кнопки
  формы — `tb-form-actions`; ADR-0021 — формы в `tb-stack--narrow`.
- **Почему важно:** это первый день учителя: он жмёт главную кнопку раздела и упирается в пустой список. Нулевая
  цена ломает долги и авансы с первого занятия.
- **Предложение:**
  - при 0 учеников FAB «Занятие» и «Оплата» открывают подсказку «Сначала добавьте ученика» с кнопкой;
  - `emptyMessage` у `p-select` (`[group]="true"` глушит стандартное «Нет данных»);
  - шаг цены — минимум 1 или предупреждение «0 ₽ — занятия будут бесплатными»;
  - мастер — `tb-form-actions`, `tb-stack--narrow`, `--tb-type-title-l-emphasized`, сброс ошибки при изменении;
  - сделанные шаги — с галочкой, а не исчезают;
  - «Скрыть» — с тостом «Вернуть можно в справке».
  - **меняет функционал:** подсказка вместо пустого выбора при 0 учеников, минимальная цена, сделанные шаги остаются
    в списке.
- **Все вхождения:**
  - `features/schedule/teacher/schedule-page.ts:108`;
  - `features/schedule/teacher/lesson-dialog.ts:70-79`;
  - `features/billing/teacher/billing-overview-page.ts:66, 165-169`;
  - `features/billing/teacher/payment-dialog.ts:52-58`;
  - `features/home/quick-actions.ts`;
  - `features/settings/setup/setup-page.ts:65-72, 134, 162, 192, 231, 243-251, 255-260, 309-312, 363`;
  - `features/identity/account/change-password-form.ts:71-79`;
  - `features/home/first-run-checklist.ts:36-71, 102, 137, 149-152`.
- **Источники:** LV4-07, LV4-18, LV4-20, ST3-20.

<a id="da-051"></a>
### DA-051. После закрытия окна и после ошибки входа фокус падает на `body`

- **Серьёзность:** Major · **Уровень:** C · **Раздел:** доступность
- **Где:** все `p-dialog` и `p-confirmdialog`; проверены «Новый ученик», «Запрос ученика», «Восстановление», «Удалить
  копию?»; `/login` после «Неверный логин или пароль».
- **Что сейчас:**
  - Окно открыто с клавиатуры, Tab внутри ходит по кругу ✓. Но после Esc или «Отмена» фокус на `body`, и следующий Tab
    начинается с шапки.
  - После ошибки входа фокус тоже на `body`.
  - Начальный фокус в окнах подтверждения паролем стоит верно — в поле пароля ✓.
- **Как должно быть:** WCAG 2.4.3; APG Dialog — фокус возвращается на вызвавший элемент (по памяти, требует сверки);
  после ошибки — на первое неверное поле.
- **Почему важно:** после каждого окна с клавиатуры приходится заново проходить шапку и навигацию.
- **Предложение:**
  - хелпер: при открытии запомнить `document.activeElement`, в `(onHide)` вернуть фокус;
  - проверить, не мешает ли `@if` вокруг `p-dialog`: уничтожение компонента до `onHide` сбрасывает восстановление
    фокуса PrimeNG;
  - вход — фокус в поле пароля;
  - около 25 мест.
- **Все вхождения:** все окна из DA-012; `features/identity/login/login-page.ts:94-97`;
  `features/settings/backups/backups-card.ts:201-226`.
- **Источники:** LV1-15, LV4-14.

---

## Minor

<a id="da-052"></a>
### DA-052. Кнопки с подписью — 42 px вместо 40; «Добавить» в широких карточках — 32 px; значки 40×32 и капля 40×42

- **Серьёзность:** Minor · **Уровень:** A (ADR-0018: «Размер один: 40 px»; ADR-0019: радиус — половина высоты) ·
  **Раздел:** форма
- **Где:** все экраны трёх ролей, обе темы; широкие карточки учеников и групп — от 769 px; «Оплаты» и история
  оплат ученика — режим правки цены.
- **Что сейчас:**
  - Все кнопки с подписью 42 px: 10 + 20 + 10 + рамка 2 × 1. Это 440 замеров у ученика и все экраны остальных ролей.
    Радиус 20 px уже не половина высоты. В одной строке кнопка с подписью (42) и значок (40), «Сегодня» календаря (40)
    стоит рядом с кнопками заголовка (42).
  - Группа дней недели — 44 px.
  - В широких карточках учеников и групп правило `.p-button-text { height: 2rem }` делает:
    - текстовые «Добавить» — 32 px, 89 штук на 1440;
    - кнопки-значки «Видеовстреча», «Доски» — 40×32 овалом.
  - «✓ Сохранить цену» без `rounded` — капля 40×42.
  - Сверено: M3 common button — 40 (MW `_md-comp-button-filled.scss`: container-height 40px).
- **Как должно быть:** ADR-0018 — один размер кнопки 40 px; ADR-0019 — радиус равен половине высоты (20 px); M3 small
  button — 40 (сверено: MW `_md-comp-button-filled.scss`).
- **Почему важно:** кнопка и значок в одной строке расходятся на 2 px, радиус 20 у кнопки 42 — уже не «таблетка»;
  32-px «Добавить» ниже минимальной цели касания M3 (48) и выбивается из ряда.
- **Предложение:**
  - пресет `paddingY: '0.5625rem'` или рамка 0;
  - `togglebutton.content.padding` `0.5rem 1rem`;
  - в `styles.scss:1524` исключить `.p-button-icon-only` и заменить `height` выравниванием строки;
  - проверка высоты в E2E;
  - риск низкий.
- **Все вхождения:**
  - пресет `:448-455, 584`;
  - `styles.scss:153-159, 1524-1526`;
  - `features/meetings/rooms/room-cell.ts:17, 28`;
  - `features/boards/manage/board-cell.ts:18, 29`;
  - `features/billing/teacher/default-price-card.ts:33`, `features/billing/teacher/student-ledger-page.ts:97`.
- **Источники:** ST1-06, ST1-07, ST2-13, LV2-14, LV3-16, LV4-27; противоречие Пр-10.

<a id="da-053"></a>
### DA-053. Строки таблиц ниже 56 px: 36–48 px, флажки 20×20

- **Серьёзность:** Minor · **Уровень:** A (ADR-0020: «Высота — от 56 px, поля 12/16») · **Раздел:** компоненты
- **Где:** таблицы `tb-cards` учителя (отчёт, задания, «Мессенджеры учеников», копии, «ИИ») и администратора
  (события, журнал, уровни, интеграции); 1440 и 390 px.
- **Что сейчас:**
  - `p-datatable-sm` в 9 таблицах:
    - «Мессенджеры учеников» — строки 36 px и поля 6/8 px;
    - уровни журнала — 44 px.
  - Обычные строки без аватара — 48 px: «По ученикам» в отчёте (48 строк), задания без срока.
  - На телефоне у «Мессенджеров учеников» первая ячейка карточки — флажок, и имя ушло в строку «Ученик: …».
- **Как должно быть:** ADR-0020 §Строка списка — высота от 56 px, поля 12/16 px; флажок — с целью касания 40–48 px
  (M3, по памяти, требует сверки).
- **Почему важно:** плотные строки соседствуют со строками 56–64 px других разделов; на телефоне флажок 20×20
  трудно попасть, а имя уходит из первой строки карточки.
- **Предложение:** `min-height: 3.5rem` для строк `tb-cards`; убрать `p-datatable-sm` или разрешить его в ADR для
  журналов.
- **Все вхождения:**
  - `features/ai/ai-usage-page.ts:112`;
  - `features/admin/events/events-page.ts:42, 81`;
  - `features/admin/logs/logger-levels-panel.ts:62`;
  - `features/admin/logs/log-page.ts:118`;
  - `features/admin/integrations/integrations-page.ts:90`;
  - `features/notifications/teacher/student-messengers-panel.ts:52, 56, 64`;
  - `features/settings/backups/backups-card.ts:85`;
  - `features/settings/settings-page.ts:129`;
  - `features/billing/teacher/monthly-report-page.ts`;
  - `features/homework/teacher/assignments-page.ts`.
- **Источники:** ST2-13, ST3-06, LV2-13.

<a id="da-054"></a>
### DA-054. Таблицы: главная колонка, аватары и колонка действий оформлены по-разному; числа выровнены влево

- **Серьёзность:** Minor · **Уровень:** A (ADR-0018 §Списки и фильтры: `tb-col-main`, `tb-amount`) · **Раздел:** компоненты
- **Где:** 20 таблиц учителя, ученика и администратора (полный список — «Все вхождения»); 1440 px.
- **Что сейчас:**
  - **`tb-col-main`** есть в 2 таблицах из 20: ученики и оплаты.
  - **Аватары.** Люди без `tb-avatar` в 7 таблицах и окнах, хотя в соседних списках аватары есть.
  - **Своя колонка действий** `.tb-row-actions` с пустым `<th>` в 3 таблицах: у скринридера колонка без названия. На
    телефоне пустая ячейка рисует разделитель.
  - **Числа** («Учеников», «На проверке», «Занятий», «Попыток», «Токены», «Размер») выровнены влево.
- **Как должно быть:** ADR-0018; M3 data tables — числа вправо (по памяти, требует сверки).
- **Почему важно:** одна и та же роль колонки (кто, сколько, что сделать) выглядит в каждой таблице по-своему;
  числа влево не сравниваются по разрядам; колонка без заголовка непонятна скринридеру.
- **Предложение:** `tb-col-main` в таблицах; `tb-avatar` и `initials` для людей; `tb-actions-column` вместо
  `.tb-row-actions`; класс `tb-num` для чисел.
- **Все вхождения:**
  - без `tb-col-main`:
    - `features/identity/groups/groups-panel.ts:95`;
    - `features/homework/teacher/assignments-page.ts:71`;
    - `features/homework/teacher/review-queue-page.ts:44`;
    - `features/homework/teacher/assignment-page.ts:122`;
    - `features/homework/student/my-homework-page.ts:50`;
    - `features/billing/teacher/monthly-report-page.ts:94, 139, 180`;
    - `features/billing/ledger/ledger-table.ts:31`;
    - `features/notifications/teacher/student-messengers-panel.ts:57`;
    - `features/settings/settings-page.ts:133`;
    - `features/settings/backups/backups-card.ts:88`;
    - `features/ai/ai-usage-page.ts:116`;
    - `features/admin/events/events-page.ts:46, 86`;
    - `features/admin/logs/log-page.ts:124`;
    - `features/admin/logs/logger-levels-panel.ts:65`;
    - `features/admin/integrations/integrations-page.ts:94`;
  - без аватара:
    - `features/homework/teacher/review-queue-page.ts:53`;
    - `features/homework/teacher/assignment-page.ts:130`;
    - `features/billing/teacher/monthly-report-page.ts:102-105, 148, 188`;
    - `features/notifications/teacher/student-messengers-panel.ts:65`;
    - `features/settings/settings-page.ts:141`;
    - `features/schedule/teacher/lesson-details-dialog.ts:93`;
    - `features/schedule/teacher/attendance-dialog.ts:55`;
  - `.tb-row-actions`:
    - `features/admin/events/events-page.ts:49, 60, 88, 99, 120-122`;
    - `features/admin/logs/logger-levels-panel.ts:68, 80, 108-110`;
    - `features/settings/backups/backups-card.ts:91, 108, 148-151`;
    - `styles.scss:1365-1369`;
  - числа:
    - `features/homework/teacher/assignments-page.ts:86-90`;
    - `features/billing/teacher/billing-overview-page.ts:141`;
    - `features/billing/teacher/monthly-report-page.ts:107`;
    - `features/admin/events/events-page.ts:59`;
    - `features/ai/ai-usage-page.ts:135-136`;
    - `features/admin/integrations/integrations-page.ts:110-113`;
    - `features/settings/backups/backups-card.ts:107`.
- **Источники:** ST3-06, LV4-31.

<a id="da-055"></a>
### DA-055. Слои состояний и disabled: 12 % вместо 10 %, hover 4 % на неоткрываемых строках, нажатие tonal = наведение, неактивные кнопки остаются цветными

- **Серьёзность:** Minor · **Уровень:** A + B · **Раздел:** состояния
- **Где:** все кнопки, строки таблиц от 769 px, FAB на телефоне, поля, переключатели, календарь; обе темы.
- **Что сейчас:**
  - **Токены не используются.** `--tb-state-hover/focus/pressed` (8/10/10 %) нигде не применяются. Проценты 8 и 12
    вписаны литералами в `layer()`/`over()` пресета и в 9 правил CSS.
  - **Нажатие — 12 %** в пресете (комментарий «pressed 12 %»). В токене и в M3 — 10 % (сверено: MW `_md-sys-state.scss`,
    CMP `StateTokens.kt`: hover 0,08, focus 0,10, pressed 0,10, dragged 0,16).
  - **Строки таблиц.**
    - Наведение 4 % на всех `tb-cards` от 769 px, независимо от `[rowHover]`, при `cursor: auto` — строка целиком не
      открывается. ADR-0020 требует 8 % и только для открываемых строк.
    - Список заданий ученика подсвечивается, но не открывается.
    - Пустая строка отчёта тоже подсвечивается.
  - **Tonal success и danger** (`tb-tonal`) — у hover и active один и тот же слой 8 %, нажатие не видно.
  - **FAB на телефоне.** У `p-button.tb-page-fab .p-button` нет правила `:active`. Правило PrimeNG
    `.p-button:not(:disabled):active` сильнее, и при нажатии пробелом или Enter FAB «вспыхивает» залитым primary с
    белым текстом.
  - **Disabled:**
    - `opacity: .38` на весь компонент, поэтому неактивная «Сохранить» — бледно-зелёная, «Сбросить» — бледно-красная;
    - M3: контейнер on-surface 10–12 %, содержимое on-surface 38 % (сверено: MW `_md-comp-button-filled.scss`);
    - поля: заливка 4 % — это значение filled field, а у outlined её нет (сверено: MW `_md-comp-outlined-text-field.scss`);
    - switch и checkbox: трек или фон 4 %.
  - **Ripple** — цвета Aura: чёрный 10 % в светлой, белый 30 % в тёмной; на tonal слишком яркий.
  - **Календарь** — своя шкала: 18, 14, 8, 6, 4 %.
- **Как должно быть:** ADR-0017 §Состояния; ADR-0020 §Строка списка; M3 state layers.
- **Почему важно:** ложная кликабельность строк, нажатие не подтверждается, FAB мигает чужим цветом, отключённая
  цветная кнопка похожа на активную.
- **Предложение:**
  - `layer(…, 'var(--tb-state-hover)')`, pressed — один источник, 10 %;
  - hover строк — только при `.p-datatable-hoverable` и 8 %;
  - `:active` для `tb-tonal` и FAB;
  - disabled кнопок — через `css` пресета;
  - `.p-ink { background: currentColor; opacity: .1 }`;
  - около 20 правок.
- **Все вхождения:**
  - `styles.scss:71-73, 171-180, 435, 638, 1117-1140, 1174, 1319, 1443-1445, 1453-1455, 1565-1590`;
  - `core/layout/shell.scss:123`;
  - `core/layout/side-nav.scss:122`;
  - `shared/ui/fold-card.ts:115`;
  - `features/help/help-page.ts:112`;
  - пресет `:19-22, 122-127, 134, 143, 161, 173-187, 224-228, 239-240, 254-258, 291, 319, 365-366, 406, 521, 667`;
  - `app.config.ts:52` (ripple);
  - `features/homework/student/my-homework-page.ts:44`;
  - `features/notifications/teacher/bot-wizard-dialog.ts:343-346` (disabled 0.6).
- **Источники:** ST2-09, ST4-14, ST4-15, ST4-24, LV2-25, LV3-32, LV4-32.

<a id="da-056"></a>
### DA-056. Движение: индикатор нижней панели и rail без пружины; при reduced motion индикатор загрузки застывает квадратом; нет перехода между разделами

- **Серьёзность:** Minor · **Уровень:** A (ADR-0019 §Движение: «пружины используются в… индикаторе раздела») + B ·
  **Раздел:** движение
- **Где:** каркас (нижняя панель, rail), кнопки, FAB, раскрываемые секции, индикатор загрузки при
  `prefers-reduced-motion: reduce`, смена разделов; 390 и 1440 px.
- **Что сейчас:**
  - **Индикатор раздела.**
    - Нижняя панель: `transition: background var(--tb-duration-short) var(--tb-motion-standard)` — кривые ADR-0017, а не
      пружина, индикатор не растёт.
    - Rail: только смена фона.
    - Развёрнутый rail: индикатор вырастает пружиной ✓.
  - **Кнопки.** Цвет меняется за 0.2s ease PrimeNG, а не effects-пружиной.
  - **Появление.** FAB (`tb-fab-in`: прозрачность и масштаб) и раскрытие секции (`tb-fold-in`) идут spatial-пружиной, в
    том числе по прозрачности — смешение схем ADR-0019.
  - **FAB** выпрыгивает пружиной при каждом заходе на страницу.
  - **Reduced motion.**
    - Глобальное правило сводит бесконечную `tb-loading-morph` к одному кадру за 0,01 мс.
    - В базовом состоянии у `::after` нет `border-radius`, и остаётся неподвижный квадрат: пользователь не видит, что
      идёт загрузка. Снимки `ST2/spinner-reduce.png`, `ST2/spinner-normal.png`.
    - Остальное reduce отключает правильно: FAB, индикаторы, меню, диалоги, секции.
  - **Переходы.** Смены разделов нет: `provideRouter` без `withViewTransitions`.
  - **Совпадает с M3:** пружины совпадают с `ExpressiveMotionTokens` (сверено: CMP), кривые `linear()` точны до 0,2 %
    (effects — до 1 %). «Slow-spatial — та же кривая, медленнее» математически верно: при одинаковом затухании
    430 мс × √(380/200) ≈ 593 мс.
- **Как должно быть:** ADR-0019 §Движение — пружины spatial для формы и позиции (в том числе индикатора раздела),
  effects — для цвета и прозрачности; при reduced motion индикатор загрузки остаётся узнаваемым (не квадрат); M3E —
  переход между разделами fade-through (по памяти, требует сверки).
- **Почему важно:** навигация — самое частое движение в интерфейсе, и именно оно без Expressive-характера; квадрат
  вместо индикатора при reduced motion выглядит как сломанная вёрстка, и пользователь не понимает, что идёт загрузка.
- **Предложение:**
  - индикатор нижней панели и rail — `scaleX` и `--tb-spring-default-spatial`, как в развёрнутом rail;
  - в `shapeTransition` цвет — `--tb-spring-fast-effects`;
  - `@media (prefers-reduced-motion: reduce) { .p-progressspinner::after { border-radius: 50% } }` и медленная пульсация
    вместо вращения;
  - `withViewTransitions()` с fade 150 мс — по желанию;
  - около 10 строк.
- **Все вхождения:**
  - `core/layout/shell.scss:139`;
  - `core/layout/side-nav.scss:33, 44-46, 117`;
  - пресет `:335-340, 475, 589, 630-645`;
  - `styles.scss:185-194, 1580, 1598-1603`;
  - `shared/ui/fold-card.ts:148, 151, 168-176`;
  - `app.config.ts:37-41`.
- **Источники:** ST2-11, ST4-22, LV1-25.

<a id="da-057"></a>
### DA-057. Границы окон: щели 768–769 и 1199–1199,98 px, лишняя граница 480 px

- **Серьёзность:** Minor · **Уровень:** C + B · **Раздел:** адаптивность
- **Где:** каркас и раскладки всех ролей на ширинах 768–769 и 1199–1200 px при дробной ширине окна (масштаб
  110–133 % в Firefox, Windows 125 %); разбор по коду.
- **Что сейчас:**
  - **В TS:** `MOBILE_QUERY = '(max-width: 768px)'`, `MEDIUM_QUERY = '(min-width: 769px) and (max-width: 1199.98px)'`.
  - **Щель 768 < w < 769** (Firefox при 110 % и 133 %, Windows 125 %):
    - JS возвращает `expanded` — развёрнутый rail 280 px в окне 768 px;
    - CSS не применяет ни `max-width: 768px`, ни `min-width: 769px`, и ученики становятся 8-колоночной таблицей.
  - **Щель 1199,01–1199,98:** `max-width: 1199px` в CSS уже не действует, а JS ещё rail.
  - **Граница 480 px** — вне системы.
  - В Chromium ширина окна целая, поэтому щель разобрана по коду.
  - **Против M3:** ADR-0017 пишет «Границы — классы окна M3», но у M3 compact < 600, medium 600–839, expanded 840–1199,
    large 1200–1599, extra-large ≥ 1600 (сверено: developer.android.com, window size classes). 768 и 1200 — осознанное
    решение, неточна формулировка (см. раздел 5, С-4).
- **Как должно быть:** одна система границ без щелей, одинаковая в CSS и TS (ADR-0015: телефон ≤ 768, компьютер ≥ 769;
  ADR-0017: rail до 1199, развёрнутый от 1200).
- **Почему важно:** в щели каркас и раскладка расходятся: развёрнутый rail 280 px в окне 768 px и таблица из 8 колонок
  вместо карточек — у пользователей Windows с масштабом 125 % это реальная ширина.
- **Предложение:**
  - одна система границ: синтаксис диапазонов `(width <= 768px)` / `(width > 768px)` или `max-width: 768.98px` везде;
  - SCSS-миксины `phone`, `tablet`, `desktop` и те же значения в `mobile.ts`;
  - объединить с DA-019 (em);
  - 480 убрать или объявить;
  - поправить слова в ADR-0017.
- **Все вхождения:**
  - `core/layout/mobile.ts:7, 10`;
  - `styles.scss:200, 320, 516, 734, 961, 1463, 1484, 1497, 1564, 1613, 1628, 1668`;
  - `core/layout/shell.scss:25, 50, 76`;
  - `shared/ui/fold-card.ts:178`;
  - `features/admin/settings/settings-page.ts:184`;
  - `features/home/quick-actions.ts:38`.
- **Источники:** ST2-12, LV1-19.

<a id="da-058"></a>
### DA-058. Токены: два источника правды, мёртвые токены, классы и блоки пресета, комментарии против кода, хаки специфичности

- **Серьёзность:** Minor · **Уровень:** A (ADR-0015 §Токены, ADR-0017 §Последствия) · **Раздел:** сопровождаемость
- **Где:** `styles.scss`, пресет, `core/layout/*.scss`, стили компонентов в `features/**` (сопровождаемость, пользователь
  этого не видит напрямую).
- **Что сейчас:**
  - **Дубли значений.** Пресет задаёт литералами то, что уже есть в `--tb-*`:
    - тени `ELEVATION_2/3` = `--tb-elevation-2/3`, `raisedShadow` = `--tb-elevation-1`;
    - радиусы `primitive.borderRadius` = `--tb-shape-*`, `PILL` = `--tb-shape-full`, `BUTTON_SHAPE` = `--tb-shape-button`;
    - радиус карточки `'1.25rem'` при токене `--tb-shape-lg-plus: 20px`;
    - типографика заголовков;
    - отступы — все литералами, часть вне сетки 4 px: 15, 10, 9, 6, 14, −1 px;
    - высота нижней панели 5rem повторена 6 раз, токена нет;
    - фон страницы — в `body` и в шапке через `:host-context`.
  - **Мёртвые токены** (14 из 60):
    - `--tb-radius`;
    - `--tb-elevation-1/2`;
    - `--tb-state-*`;
    - `--tb-motion-emphasized`, `--tb-duration-medium`;
    - `--tb-spring-slow-spatial`, `-default-effects`, `-slow-effects`;
    - `--tb-type-headline-l`, `-headline-m`, `-title-s`.

    `--tb-motion-standard` и `--tb-duration-short` используются по разу (Пр-6).
  - **Мёртвые классы и блоки:**
    - `.tb-section`, `.tb-section__title` — ADR-0017 называет их общими;
    - `.tb-menu-item--danger` — описан в ADR-0022, но не применён ни одним меню;
    - блок `tabs` в пресете — `p-tabs` нигде не импортируется;
    - кнопки `sm`/`lg`, схемы `outlined` и `link`, `raisedShadow` — ни один из этих вариантов по ADR не используется;
    - отсюда лишнее `:not(.p-button-sm, .p-button-lg)`;
    - `.tb-row-actions` в `settings-page.ts` без разметки;
    - `styles: ''`.
  - **Копии правил:**
    - `.tb-meetings-*` и `.tb-google-*`;
    - `.tb-room-cell` и `.tb-board-cell`;
    - сброс списка — 11 раз, нумерованные шаги — 9 раз;
    - локальные переопределения `.tb-actions`.
  - **Комментарии против кода:**
    - «48 px high» у полей (`styles.scss:148`);
    - «pressed 12 %» (`пресет:19`);
    - «Label Small fits» и «not by weight» (`shell.scss:146, 158`);
    - «Colors come from the roles» при палитрах в том же файле (`styles.scss:5-9`);
    - «The page is a container (ADR-0017)».
  - **Хаки специфичности:**
    - `::ng-deep` — вся стилизация side-nav, секции, чек-лист, панель справки;
    - `:host-context`;
    - `!important` — ширина окна на телефоне, тост, меню «Ещё»;
    - удвоенные классы `.tb-fc-button.tb-fc-button`.

    Причина — стили PrimeNG вставляются после `styles.css`, а `cssLayer` не включён.
  - **Прямые палитры:** `.tb-positive` — `--p-green-700/300` вместо `--p-md-success`; семантические токены PrimeNG
    вместо `--p-md-*` в 15 местах.
- **Как должно быть:** ADR-0015 §Токены и ADR-0017 §Последствия — значения живут в одном месте (`--tb-*`), пресет и
  компоненты ссылаются на них; мёртвых токенов и классов нет; комментарии совпадают с кодом.
- **Почему важно:** правка одного источника молча расходится с другим. Уже расходятся радиусы при крупном шрифте
  (DA-019) и нажатие 12 против 10 % (DA-055).
- **Предложение:**
  - пресет ссылается на CSS-переменные строками: `'var(--tb-shape-lg-plus)'`, `'var(--tb-elevation-2)'`;
  - `--tb-bottom-nav-height`, `--tb-space-12`, `--tb-font-mono`;
  - удалить мёртвое или начать использовать;
  - `providePrimeNG({ theme: { options: { cssLayer: { name: 'primeng', order: 'primeng, app' } } } })` — стили проекта
    станут сильнее без хаков. Средний риск, строка в ADR-0017;
  - общие классы `tb-plain-list`, `tb-steps`;
  - stylelint или скрипт проверки неиспользуемых классов и токенов: knip CSS не проверяет;
  - около 60 правок.
- **Все вхождения:** инвентарь всех 60 токенов и 97 классов — отчёт участка ST2 (§«Инвентарь»); ключевые места —
  `пресет:207-211, 376-383, 456-469, 485, 489, 495, 501, 514-545`; `styles.scss:5-9, 55-79, 104, 117-118, 148, 155,
  465-479, 923-928, 1812-1816`; `core/layout/shell.scss:19-23, 83, 106, 146, 158`; `core/layout/side-nav.scss:17-136`;
  `app.config.ts:49-53`.
- **Источники:** ST2-08, ST2-14, ST2-15, ST2-16, ST2-18, ST2-19, ST2-20, ST4-23, ST1-22, ST3-20; противоречие Пр-6.

<a id="da-059"></a>
### DA-059. Компоненты PrimeNG, не приведённые к M3: switch, radio, checkbox, выбор даты, progress, индикатор загрузки, пункты меню, colorpicker, paginator, chip

- **Серьёзность:** Minor · **Уровень:** B · **Раздел:** компоненты
- **Где:** переключатели («Настройки», «Уведомления», фильтры), радио и флажки (формы, «Мессенджеры учеников»), выбор
  даты (окна занятий, переноса, отчёт), полоса «С чего начать», индикатор загрузки, все меню, выбор цвета портала,
  пагинация истории оплат и отчёта, чипы выбора учеников; обе темы.
- **Что сейчас → как в M3** (подробная таблица по 30 компонентам — в [m3e-ux.md §3](design-audit-2026-09-29-m3e-ux.md#components)):

  | Компонент | Что сейчас | Как в M3 |
  |---|---|---|
  | switch | ручка 20 px во всех состояниях; обводка при наведении on-surface-variant; disabled 4 %; у выбранного отключённого остаётся рамка primary; нет слоя состояния | ручка 16 / 24 / 28 (выкл. / вкл. / нажата), обводка outline, disabled 12 % / 38 %, слой 40 (сверено: MW `_md-comp-switch.scss`) |
  | radio | заливка primary и белая точка 12 px (Aura); обводка 1 px; область нажатия 20×20 | кольцо и точка primary; обводка 2 px; слой 40 (сверено: MW `_md-comp-radio-button.scss`) |
  | checkbox | обводка 1 px; область нажатия 18×18; disabled 4 % | обводка 2 px, слой 40 (сверено: MW `_md-comp-checkbox.scss`) |
  | datepicker | «сегодня» — заливка primary-container; дни недели 16/700; разделитель шапки; `timeOnly` — стрелки Aura | «сегодня» — обводка 1 px primary и текст primary (сверено: MW `_md-comp-date-picker-docked.scss`) |
  | progressbar | нет зазора и stop indicator; на главной 8 px | зазор 4, stop indicator 4, толщина 4; 8 px помечено deprecated (сверено: MW `_md-comp-progress-indicator-linear.scss`) |
  | loading indicator | фигура 60 % primary, 4 кадра | 38 px, on-primary-container; 7 форм, морф 650 мс (сверено: MW `_md-comp-loading-indicator.scss`, CMP `LoadingIndicator.kt`) |
  | пункты меню | 16/400, высота 40, все с радиусом 12 | Label Large 14/500, 44 px; радиус xs 4, у первого, последнего и выбранного — 12 (сверено: MW `_md-comp-menus.scss`) |
  | colorpicker | целиком Aura: тёмная панель в светлой теме, превью 24×24 | — |
  | paginator | без темы | — |
  | chip у `p-multiselect display="chip"` | Aura | — |
  | кнопки `p-inputnumber showButtons` | Aura | — |
  | confirmdialog | значок и отступы Aura | — |

- **Как должно быть:** см. колонку «Как в M3» — токены компонентов Material Web; ADR-0017 — «весь интерфейс
  перекрашивается одним пресетом» (компоненты без темы выпадают из схемы).
- **Почему важно:** рядом с приведёнными к M3E кнопками и полями компоненты Aura выглядят чужими; colorpicker с тёмной
  панелью в светлой теме и радио с белой точкой — самые заметные.
- **Предложение:** `css` и токены пресета, по 10–20 строк на компонент. Порядок по заметности: datepicker, switch,
  меню, radio, progress.
- **Все вхождения:**
  - пресет:
    - `:342-359, 567-581` — switch;
    - `:646-656` — checkbox, radio;
    - `:362-372, 705-746` — datepicker;
    - `:697-704` — progressbar;
    - `:616-645` — индикатор загрузки;
    - `:423-435, 503-513` — меню;
  - progressbar на главной — `features/home/first-run-checklist.ts:37-42, 68-71`;
  - colorpicker — `features/settings/portal-settings-card.ts:114`;
  - paginator — `features/billing/ledger/ledger-table.ts:24`, `features/billing/teacher/monthly-report-page.ts:132`;
  - chip — `features/identity/groups/group-form-dialog.ts:66`, `features/homework/teacher/assignment-dialog.ts:139`,
    `features/homework/teacher/assignment-page.ts:166`, `features/notifications/teacher/broadcast-dialog.ts:61`;
  - inputnumber — `features/schedule/teacher/lesson-dialog.ts:108`, `features/schedule/teacher/series-dialog.ts:113`,
    `features/ai/homework-draft-dialog.ts:63`.
- **Источники:** ST4-12, ST4-13, ST4-18, ST4-19, ST4-22, ST4-26, ST4-27, ST3-18.

<a id="da-060"></a>
### DA-060. Бейджи: у колокольчика бейдж стоит в строку и превращает кнопку в таблетку 101×38; счётчики трёх цветов

- **Серьёзность:** Minor · **Уровень:** B · **Раздел:** компоненты, форма
- **Где:** шапка всех ролей (колокольчик), счётчики в «Заданиях» и секциях «Уведомлений»; 360–1440 px.
- **Что сейчас:**
  - `p-button [badge]` ставит «99+» в строку справа от значка. Кнопка становится таблеткой 101×38 с полями 24 px, а
    не круглой 40×40 с бейджем на углу. Слой наведения — на всю таблетку.
  - На 360 px из-за этого название портала сжимается с 196 до 135 px.
  - Высоты кнопок шапки — 38, 40 и 42.
  - У названия портала при обрезке нет ни `title`, ни подсказки.
  - Цвета счётчиков — danger, warn и primary (см. DA-004).
  - Снимок: `LV1/crop-header-teacher-360-light.png`.
- **Как должно быть:** M3 badge — на углу значка, large 16 px, цвет error (сверено: MW `_md-comp-badge.scss`); кнопка-значок
  с целью касания 48.
- **Почему важно:** колокольчик — единственный индикатор новых событий; таблетка с бейджем в строку отнимает место у
  названия портала на телефоне и не похожа на кнопку-значок; три цвета счётчиков не говорят, что важнее.
- **Предложение:** `p-overlaybadge` (есть в PrimeNG 21) вокруг кнопки-значка или абсолютное позиционирование
  `.p-badge`; `pTooltip` у названия портала; колокольчик — ссылка, а не кнопка с `navigateByUrl` (см. DA-070).
- **Все вхождения:** `core/notifications/notification-bell.ts:12-26, 57-59`; `core/layout/shell.ts:43-59`;
  `core/layout/shell.scss:31-60`; `features/homework/teacher/assignments-page.ts:50`; `shared/ui/fold-card.ts:61`.
- **Источники:** LV1-17, ST1-19.

<a id="da-061"></a>
### DA-061. Поверхности каркаса: шапка и rail — тоном страницы, прокрутка не видна; тень листа — уровня 3; scrim в тёмной теме 50 %

- **Серьёзность:** Minor · **Уровень:** A (ADR-0017 и ADR-0020 описывают поверхности иначе, чем код) + B ·
  **Раздел:** цвет, поверхности
- **Где:** каркас всех ролей (шапка, rail, нижняя панель), нижний лист занятия ученика, панель справки, scrim
  окон; светлая и тёмная темы.
- **Что сейчас:**
  - **Светлая тема: фон = шапка = rail = нижняя панель**, #eef0f6, контраст 1,00 : 1.
    - Нижняя панель отделена линией в 1 px (`box-shadow`), шапка от 769 px — ничем.
    - При прокрутке белые карточки уходят под шапку того же цвета без смены тона.
    - В режиме `forced-colors` `box-shadow` убирается, и граница пропадает (гипотеза).
  - **Плитка** в светлой теме темнее карточки (Пр-9): 1,09 : 1, ΔE 3,0 — у порога различимости.
  - **`p-drawer`** — лист и справка — берут тень `overlay.modal` уровня 3. У M3 modal bottom sheet — уровень 1 и
    surface-container-low (сверено: MW `_md-comp-sheet-bottom.scss`).
  - **Ручка листа** — с прозрачностью 40 %.
  - **Scrim** в тёмной теме — 50 %, у M3 — 32 % в обеих темах (сверено: MW `_md-comp-scrim.scss`).
- **Как должно быть** (сверено: MW):
  - шапка — surface, при прокрутке surface-container и уровень 2 (`_md-comp-app-bar.scss`);
  - navigation bar — surface-container (`_md-comp-navigation-bar.scss`).
- **Почему важно:** при прокрутке непонятно, где кончается шапка и начинается содержимое; тень листа уровня 3
  тяжелее, чем у окон M3; 50 % scrim в тёмной теме почти скрывает контекст, из которого открыт лист.
- **Предложение:**
  - шапке — состояние «прокручено» (surface-container-high или тень уровня 2 при `scroll > 0`);
  - разделители — `border-block-*` вместо `box-shadow`;
  - тень листа — `var(--tb-elevation-1)`;
  - поправить текст ADR-0017 и ADR-0020 под код (Пр-7, Пр-9).
- **Все вхождения:**
  - `styles.scss:128-146, 1778-1810`;
  - `core/layout/shell.scss:8-29, 87-97`;
  - `core/layout/side-nav.scss:6-16`;
  - пресет `:72, 107, 439`.
- **Источники:** LV1-20, ST2-21, ST4-21, ST4-25.

<a id="da-062"></a>
### DA-062. Форма: радиусы вне шкалы, группы скруглены по-разному, при нажатии в группе растут все углы

- **Серьёзность:** Minor · **Уровень:** A + B · **Раздел:** форма
- **Где:** мастер бота, настройки портала (образцы цвета), код привязки, плашка запроса в окне занятия, показатели
  `tb-stats`, split button «Начать урок», связанная группа «Перенести | Отменить».
- **Что сейчас:**
  - **Радиусы вне шкалы:**
    - `border-radius: 50%` вместо `--tb-shape-full` — образцы цвета, шаги мастера бота;
    - `--p-border-radius-md` (примитив PrimeNG) вместо `--tb-shape-md` — код привязки, образцы цвета, плашка запроса.
  - **Внешние углы групп.** У ключевых показателей `tb-stats` — `var(--p-card-border-radius)` = 20 px, у списков —
    `--tb-list-outer` = 16 px. Две «сегментированные группы» скруглены по-разному.
  - **Внутренние углы пар кнопок.** У split button — xs 4 px, у связанной группы — sm 8 px. ADR-0022 называет оба
    значения «малые» (Пр-12).
  - **Нажатие в группе:**
    - у связанных групп при нажатии все углы становятся 12 px, внутренние растут с 8 до 12;
    - в M3E при нажатии внутренний угол — 4 (сверено: MW `_md-comp-button-group-connected-small.scss`);
    - у split button при наведении и нажатии внутренние углы остаются 4, а в M3E — 12 (сверено: MW
      `_md-comp-split-button-small.scss`).
  - **Сегментированный список.** У M3 элемент — `corner-none`, у выбранного — large (сверено: MW `_md-comp-list.scss`).
    У нас внутренние 4 — осознанно (ADR-0020).
- **Как должно быть:** ADR-0019 §Форма — радиусы только из шкалы `--tb-shape-*`; ADR-0020 — внешние углы групп
  одинаковые (`--tb-list-outer`); ADR-0022 — внутренние углы пар кнопок «малые», при нажатии — по токенам M3E (сверено:
  MW, см. выше).
- **Почему важно:** соседние группы скруглены по-разному, а «морф» при нажатии в группе работает наоборот — растут
  внутренние углы, которые в M3E сужаются; литералы расходятся со шкалой при крупном шрифте (DA-019).
- **Предложение:**
  - заменить литералы на токены;
  - внешние углы `tb-stats` → `--tb-list-outer`;
  - нажатие в группах — по токенам M3E;
  - уточнить ADR-0022: split — «extra-small 4 px», группа — «small 8 px».
- **Все вхождения:**
  - `features/notifications/teacher/bot-wizard-dialog.ts:356`;
  - `features/settings/portal-settings-card.ts:204, 241`;
  - `features/notifications/channels/link-code-view.ts:58`;
  - `features/schedule/teacher/lesson-details-dialog.ts:304`;
  - `styles.scss:845-852, 1216-1218, 1703-1725, 1760-1771`;
  - пресет `:610-612`.
- **Источники:** ST2-17, ST4-26; противоречие Пр-12.

<a id="da-063"></a>
### DA-063. Enter не отправляет форму в 9 окнах: кнопка отправки вне `<form>`

- **Серьёзность:** Minor · **Уровень:** C · **Раздел:** UX, доступность
- **Где:** 9 окон форм учителя (ученик, группа, черновик ИИ, сообщение, оплата, регулярные занятия, нерабочее время,
  занятие, задание) и окно сохранения настроек администратора.
- **Что сейчас:**
  - В окнах с `<form (ngSubmit)>` кнопка «Сохранить» стоит в `#footer` — вне формы и без `type="submit"`, поэтому
    `(ngSubmit)` — мёртвый код.
  - Проверено вживую на «Новом ученике»: Enter в поле имени — POST не ушёл, окно осталось открытым.
  - В окнах, где кнопки стоят в теле формы (доски, восстановление, сброс, мастер бота), Enter работает.
  - В окне сохранения настроек администратора пароль тоже не в форме.
- **Как должно быть:** Enter в поле однострочной формы отправляет её — так работают формы браузера, и так уже
  работают окна проекта с кнопками внутри формы; кнопка отправки — `type="submit"` своей формы.
- **Почему важно:** учитель, привыкший к Enter, думает, что сохранил, и закрывает окно; у администратора пароль не
  отправляется Enter.
- **Предложение:** `<button pButton type="submit" [attr.form]="formId">` в подвале (у `p-button` нет атрибута `form`) и
  `id` у формы; 10 файлов, риск низкий.
- **Все вхождения** (строка формы / строка подвала):
  - `features/identity/students/student-form-dialog.ts:35 / 56`;
  - `features/identity/groups/group-form-dialog.ts:45 / 90`;
  - `features/ai/homework-draft-dialog.ts:35 / 83`;
  - `features/notifications/teacher/broadcast-dialog.ts:50 / 82`;
  - `features/billing/teacher/payment-dialog.ts:49 / 98`;
  - `features/schedule/teacher/series-dialog.ts:64 / 189`;
  - `features/schedule/teacher/off-time-dialog.ts:54 / 188`;
  - `features/schedule/teacher/lesson-dialog.ts:67 / 146`;
  - `features/homework/teacher/assignment-dialog.ts:63 / 152`;
  - `features/admin/settings/settings-page.ts:181`.
- **Источники:** ST1-05, LV4-09.

<a id="da-064"></a>
### DA-064. У 20 действий, отправляющих запрос, нет защиты от двойного нажатия

- **Серьёзность:** Minor · **Уровень:** C · **Раздел:** состояния
- **Где:** 20 действий учителя, ученика и администратора (список — «Все вхождения»).
- **Что сейчас:**
  - У форм защита есть: `[loading]` и проверка `pending()`, 31 место.
  - Без неё:
    - «Выдать»;
    - «✓ Сохранить цену» на странице ученика;
    - «Проведено» и «Пропуск» в «Отметьте прошедшие»;
    - «Повторить все», «Отправить все повторно», «Повторить» — возможна повторная отправка сообщений;
    - «Вернуть доступ»;
    - «Ссылка» — второе нажатие выпускает вторую ссылку и аннулирует первую;
    - «Вернуть из архива», «Вернуть» (уровень журнала);
    - «×» мессенджера, «Отключить» ×3, «Отозвать», «Убрать» логотип;
    - «Скачать» копию — большой файл дважды;
    - «Прочитать все».
- **Как должно быть:** как у форм проекта — на время запроса кнопка показывает `[loading]` и не принимает повторное
  нажатие (Нильсен №5).
- **Почему важно:** двойное нажатие отправляет сообщения дважды, выпускает вторую ссылку-приглашение (первая
  перестаёт работать) и скачивает большой файл копии дважды.
- **Предложение:** сигнал `pending` и `[loading]` в этих местах; общий хелпер — по желанию.
- **Все вхождения:**
  - `features/homework/teacher/assignment-page.ts:172`;
  - `features/billing/teacher/student-ledger-page.ts:97`;
  - `features/schedule/teacher/schedule-page.ts:167, 176, 472`;
  - `features/admin/events/events-page.ts:35, 61, 74, 100`;
  - `features/identity/students/students-page.ts:201, 211`;
  - `features/identity/groups/groups-panel.ts:159`;
  - `features/admin/logs/logger-levels-panel.ts:82`;
  - `features/notifications/channels/channels-panel.ts:72`;
  - `features/meetings/settings/meetings-settings-panel.ts:99`;
  - `features/schedule/teacher/google-calendar-panel.ts:115`;
  - `features/schedule/ui/calendar-feed-panel.ts:65`;
  - `features/schedule/student/my-schedule-page.ts:118, 197`;
  - `features/settings/portal-settings-card.ts:168`;
  - `features/settings/backups/backups-card.ts:119`;
  - `features/notifications/inbox/inbox-panel.ts:30`.
- **Источники:** ST1-12.

<a id="da-065"></a>
### DA-065. Цвет по смыслу соблюдён не везде; в строках tonal вместо text

- **Серьёзность:** Minor · **Уровень:** A (ADR-0019 §Цвет кнопок, ADR-0018 §Кнопки) · **Раздел:** цвет, компоненты
- **Где:** ссылки встречи, «Мессенджеры учеников», события администратора, мастер бота, копии, календарь на телефоне,
  файлы задания, «Сегодня» и расписание учителя, журнал и настройки администратора, строки занятий ученика.
- **Что сейчас:**
  - **Нейтральные при ADR-0019 «зелёный»:**
    - «Отправить ученику» (ссылка встречи, отправляет сразу);
    - «Напомнить всем без мессенджера»;
    - «Отправить все повторно»;
    - «Отправить тестовое сообщение»;
    - «Создать копию сейчас»;
    - «Получить ссылку»;
    - «Загрузить».
  - **«Отметить».** «Отметить» и «Отметить посещаемость» — цвета портала, а парная «Проведено» — зелёная.
  - **«Вернуть».** «Вернуть» (уровень журнала) и «Вернуть как в .env» — цвета портала, хотя по смыслу это откат.
  - **«Готово»** — filled портал в настройках администратора и filled зелёная в мастере бота.
  - **Tonal вместо text в строках:** «Подключить» (мессенджер), «Проверить» и «Настроить» (боты), «Перенести» (строка
    занятия ученика на компьютере). ADR-0018 — «действие с подписью в строке списка — text».
- **Как должно быть:** ADR-0019 §Цвет кнопок — зелёная для подтверждения и отправки, красная — для отмены и
  удаления, цвет портала — для остального; ADR-0018 §Кнопки — действие с подписью в строке списка — text.
- **Почему важно:** правило «цвет — смысл» работает, только если соблюдается везде: одна и та же «отправка» то зелёная,
  то нейтральная, «Готово» — то портал, то зелёная.
- **Предложение:** уточнить ADR-0019: зелёный — отправка формы и решение, немедленные действия секций («создать сейчас»,
  «получить ссылку») — нейтральные. Либо перекрасить по таблице. В строках — `[text]="true"`.
- **Все вхождения:**
  - `features/meetings/rooms/room-dialog.ts:60`;
  - `features/notifications/teacher/student-messengers-panel.ts:36`;
  - `features/admin/events/events-page.ts:74`;
  - `features/notifications/teacher/bot-wizard-dialog.ts:298, 306`;
  - `features/settings/backups/backups-card.ts:65`;
  - `features/schedule/ui/calendar-feed-panel.ts:57`;
  - `features/homework/teacher/assignment-page.ts:107`;
  - `features/schedule/home/today-lessons-widget.ts:69`;
  - `features/schedule/teacher/schedule-page.ts:159`;
  - `features/schedule/teacher/lesson-details-dialog.ts:237`;
  - `features/admin/logs/logger-levels-panel.ts:82`;
  - `features/admin/settings/settings-page.ts:162, 237`;
  - `features/notifications/channels/channels-panel.ts:82`;
  - `features/notifications/teacher/bots-panel.ts:58, 76`;
  - `features/schedule/ui/lesson-actions.ts:27`.
- **Источники:** ST1-10, ST1-13, ST1-25.

<a id="da-066"></a>
### DA-066. Кнопки-значки: нет подсказки, имя не совпадает с подсказкой, шесть «Справок» на странице, имена без контекста

- **Серьёзность:** Minor · **Уровень:** A (ADR-0018: значок — «с подсказкой») + C (WCAG 2.4.6) · **Раздел:** доступность
- **Где:** шапка, «Оплаты» и история оплат, split button «Начать урок», строки учеников, оплат, уведомлений,
  событий, журнала, расписания и заданий; все «?» справки.
- **Что сейчас:**
  - **Без `pTooltip`:**
    - меню пользователя на телефоне;
    - колокольчик;
    - «✓ Сохранить цену» ×2;
    - «▾» split button — ещё и без `aria-haspopup` и `aria-expanded`.
  - **Имя ≠ подсказке:**
    - кошелёк — подсказка «Принять оплату», имя «Оплата: {имя}»;
    - «Ссылка: {имя}» при подсказке «Ссылка для сброса пароля» или «Новая ссылка-приглашение».
  - **Одинаковые «Справки».** Все «?» — `ariaLabel="Справка"`: на «Настройках» учителя их 6, и для диктора они
    неразличимы.
  - **Одинаковые имена в каждой строке** без контекста: «Отменить занятие», «Аннулировать оплату», «Отметить
    прочитанным», «Открыть», «Повторить», «Вернуть», «Ответить», «Проверить».
  - **Корзина** у «Завершить расписание» — значок не про это действие.
- **Как должно быть:** ADR-0018 — кнопка-значок всегда с подсказкой; доступное имя совпадает с подсказкой и
  различимо в списке ссылок и кнопок (WCAG 2.4.6, 2.5.3); у кнопки с меню — `aria-haspopup` и `aria-expanded`.
- **Почему важно:** на «Настройках» диктор читает шесть одинаковых «Справка»; в строках — десятки одинаковых
  «Отменить занятие» без имени ученика; без подсказки значок кошелька или «▾» не узнать.
- **Предложение:**
  - `HelpButton` берёт название статьи: «Справка: Портал»;
  - подсказка и имя совпадают, в имени — контекст строки (как у «Изменить группу: …»);
  - для «Завершить» — `pi-stop-circle` или `pi-calendar-times`.
- **Все вхождения:**
  - `features/help/help-button.ts:24-30`;
  - `core/layout/shell.ts:51, 85`;
  - `core/notifications/notification-bell.ts:17-26`;
  - `features/billing/teacher/default-price-card.ts:33-40`;
  - `features/billing/teacher/student-ledger-page.ts:96-102`;
  - `features/meetings/ui/join-lesson-button.ts:32-38`;
  - `features/billing/teacher/billing-overview-page.ts:149-155`;
  - `features/identity/students/students-page.ts:211-221`;
  - `features/billing/ledger/ledger-table.ts:72-78, 104-110`;
  - `features/notifications/inbox/inbox-panel.ts:62, 65`;
  - `features/admin/events/events-page.ts:61, 100`;
  - `features/admin/logs/logger-levels-panel.ts:82`;
  - `features/schedule/teacher/schedule-page.ts:139, 228`;
  - `features/homework/teacher/assignment-page.ts:142`;
  - `features/homework/teacher/review-queue-page.ts:62`;
  - `features/schedule/ui/lesson-actions.ts:23-39`.
- **Источники:** ST1-15, ST1-24, ST5-11.

<a id="da-067"></a>
### DA-067. Пункт меню, h1 и заголовок вкладки называют страницу по-разному; «Назад» подписан не туда

- **Серьёзность:** Minor · **Уровень:** C (WCAG 2.4.2 — заголовок описывает страницу) · **Раздел:** навигация, тексты
- **Где:** навигация и заголовки всех ролей; вложенные страницы учителя (проверка работы, задание, история оплат),
  справка; заголовки вкладок браузера.
- **Что сейчас:**
  - **Пункт меню → h1 и вкладка:**
    - «Задания» → «Домашние задания»;
    - «ИИ» → «ИИ-помощник»;
    - ученик «Главная» → «Личный кабинет»;
    - «Копии» → «Резервные копии».
  - **Вложенные страницы.** Вкладка общая, h1 — имя: «Проверка работы» / «Алиса Соловьёва», «Задание» / «Графики
    функций», «История оплат» / «Агата Титова». Несколько открытых вкладок не различить.
  - **Справка.** Вкладка всегда «Справка», название статьи в неё не попадает.
  - **«Назад»** из истории оплат подписан «Все ученики», а ведёт в «Оплаты». В отчёте тот же переход подписан
    «Оплаты».
  - Работает: вкладка «<страница> — <название портала>» ✓, `lang="ru"` ✓.
- **Как должно быть:** пункт меню, h1 и заголовок вкладки называют страницу одинаково, вложенная страница — своим
  именем (WCAG 2.4.2); «Назад» подписан местом, куда ведёт (Нильсен №4).
- **Почему важно:** пользователь сверяет пункт меню с заголовком, чтобы понять, туда ли попал; учитель с несколькими
  открытыми вкладками работ не различает их; «Все ученики» обещает не тот экран.
- **Предложение:**
  - выровнять `title` маршрутов и подписи меню;
  - для вложенных страниц — `Title.setTitle` или `TitleStrategy` из данных страницы: «Алиса Соловьёва — Проверка
    работы»;
  - `backLabel="Оплаты"`.
- **Все вхождения:**
  - `core/layout/teacher-layout.ts:14, 17`;
  - `core/layout/student-layout.ts:7, 13`;
  - `core/layout/admin-layout.ts:10`;
  - `app.routes.ts:46, 56, 61, 76, 86, 95-105, 120, 130, 135, 148-158, 195, 208-218`;
  - `features/homework/teacher/task-review-page.ts:55`;
  - `features/homework/teacher/assignment-page.ts:66`;
  - `features/billing/teacher/student-ledger-page.ts:51`;
  - `features/billing/teacher/monthly-report-page.ts:47`;
  - `features/homework/student/my-task-page.ts:44`.
- **Источники:** ST3-09, ST5-12.

<a id="da-068"></a>
### DA-068. Состояние экранов не сохраняется; истёкшая сессия не возвращает на страницу

- **Серьёзность:** Minor · **Уровень:** C (Нильсен №3) · **Раздел:** навигация
- **Где:** учитель — расписание (вид календаря), «Ученики» (поиск), очередь проверки (прокрутка); все роли — вход после
  истечения сессии. 390 и 1440 px.
- **Что сейчас:**
  - **Не сохраняется:**
    - вид календаря («Месяц») после перезагрузки сбрасывается на «Неделю» и не попадает в адрес;
    - поиск учеников пропадает после «Назад»;
    - прокрутка очереди проверки теряется.
  - **Сохраняется:** `?open=` уведомлений ✓.
  - **Сессия.** 401 во время работы → `/login?expired=1` без `returnUrl`: после входа — главная, а не раздел, где был
    пользователь (`LV1/error-401-inapp-390.png`). Перезагрузка без refresh-cookie `returnUrl` передаёт ✓.
- **Как должно быть:** «Назад» и перезагрузка возвращают экран в том же виде (Нильсен №3 и №6); после повторного
  входа пользователь попадает туда, где был.
- **Почему важно:** учитель, проверяющий работы по очереди, каждый раз ищет место в списке из 66 работ; после
  истечения сессии теряется контекст и введённые данные.
- **Предложение:**
  - вид календаря и поиск — в query-параметры;
  - восстановление прокрутки (`withInMemoryScrolling`);
  - `returnUrl: router.url` в `core/auth/auth.service.ts:106` — одна строка.
  - **меняет функционал:** вид календаря и поиск в адресе, возврат на прежнюю страницу после входа.
- **Все вхождения:** `features/schedule/ui/schedule-calendar.ts`; `features/identity/students/students-page.ts:318-321`;
  `core/auth/auth.service.ts:106`.
- **Источники:** LV2-28, LV1-23.

<a id="da-069"></a>
### DA-069. Страница 404 вне каркаса портала; «404» набрано 64 px с межстрочным 24 px

- **Серьёзность:** Minor · **Уровень:** A + B · **Раздел:** навигация, типографика
- **Где:** любой несуществующий адрес: аноним, учитель, ученик, администратор; 390, 1024 и 1440 px, обе темы.
- **Что сейчас:**
  - **Без каркаса.** Маршрут `**` на верхнем уровне: вошедший учитель на `/teacher/несуществующее` теряет шапку,
    навигацию и название портала. Нет `main`, landmark-ов 0.
  - **Заголовок.** `<h1>404</h1>` 64 px / 24 px / 700 цвета `--p-primary-color`, вне шкалы. Показано своей разметкой,
    а не `tb-empty-state`.
  - **Чужая роль.** Учитель на `/admin/*` и `/cabinet`, администратор на `/teacher/*` молча переброшены на свою главную.
  - **Неверный id** внутри раздела даёт пустую страницу (см. DA-002).
- **Как должно быть:** Display Large 57/64/400 (сверено: MW `_md-sys-typescale.scss`); Нильсен №3.
- **Почему важно:** ошибка в адресе (старая ссылка из уведомления, закладка) выбрасывает из портала: нет навигации,
  чтобы вернуться в раздел; молчаливый переход на свою главную не объясняет, почему страница не открылась.
- **Предложение:** дочерний `**` внутри `teacher`, `cabinet`, `admin` — страница в оболочке с `tb-empty-state`
  («Страница не найдена», «На главную»); токен `--tb-type-display-l`.
- **Все вхождения:** `core/pages/not-found.ts:10-32`; `app.routes.ts:227-231`.
- **Источники:** ST3-10, LV1-24, LV4-17.

<a id="da-070"></a>
### DA-070. Свои разметки вместо общих компонентов и классов

- **Серьёзность:** Minor · **Уровень:** A (AGENTS.md §6.3: «Собственные компоненты — только если в PrimeNG нет
  подходящего»; ADR-0018: «один тип элемента — один вид») · **Раздел:** компоненты
- **Где:** мастер бота и мастер первоначальной настройки, настройки портала (образцы цвета), колокольчик, главная
  (виджеты), журнал администратора, панели календарей и видеовстреч, окно восстановления.
- **Что сейчас:**
  - **Степперы.** Два самодельных, с разными токенами:
    - мастер бота — Aura-токены, `font-weight: 600`, кнопки-шаги без `aria-current`;
    - мастер настройки — M3-токены, `aria-current="step"` ✓.
  - **Образцы цвета портала** — свои `button role="radio"` 36×36:
    - без стрелочной навигации (радиогруппа WAI-ARIA требует стрелок), каждый образец — отдельная остановка Tab;
    - подсказки через `title`;
    - галочка `#fff` на teal и emerald — 2,49 : 1.
  - **Ссылки и кнопки, собранные вручную:**
    - кнопка-ссылка из `class="p-button"` без `pButton`: «Открыть бота»;
    - колокольчик — кнопка с `router.navigateByUrl`: переход, который нельзя открыть в новой вкладке;
    - заголовок уведомления на главной — `<button>` без вида ссылки;
    - «код …» в журнале — своя копия `tb-link-button`.
  - **Строка копирования** — пять вариантов одного: `tb-copy-row`, `.tb-feed-link`, `.tb-google-uri`, `.tb-meetings-uri`,
    `.tb-room-link`.
  - **Индикаторы.** «Перезапускается» — `pi-spin`, у администратора индикатора нет вовсе, хотя в теме есть индикатор M3E.
  - **Подвалы виджетов** с пустым `<span></span>` для выравнивания; «Не сейчас» в `.tb-actions` вместо
    `tb-widget-footer`.
  - **«Расписание»** — мелкая ссылка в строке с «Начать урок». Этот же приём ADR-0022 убрал у «в браузере».
- **Как должно быть:** AGENTS.md §6.3 — компоненты PrimeNG или общие из `shared/ui`; ADR-0018 — один тип элемента —
  один вид; радиогруппа по WAI-ARIA APG — одна остановка Tab и стрелки; переход — ссылка (`a`), а не кнопка.
- **Почему важно:** два мастера выглядят по-разному; образцы цвета нельзя выбрать стрелками, а колокольчик — открыть в
  новой вкладке; пять вариантов строки копирования — пять мест для правки одного дефекта.
- **Предложение:**
  - `shared/ui`: `tb-steps` (или `p-stepper` с темой), `tb-copy-field`;
  - `a pButton [routerLink]`;
  - радиогруппа с roving tabindex и 48 px;
  - «Расписание» — в подвал виджета.
- **Все вхождения:**
  - `features/notifications/teacher/bot-wizard-dialog.ts:75-317, 321-394`;
  - `features/settings/setup/setup-page.ts:73-90, 262-307`;
  - `features/settings/portal-settings-card.ts:82-111, 126, 191-224`;
  - `features/notifications/channels/link-code-view.ts:16`;
  - `core/notifications/notification-bell.ts:17, 58`;
  - `features/notifications/home/latest-notifications-widget.ts:34-41, 66-81`;
  - `features/admin/logs/log-page.ts:141, 198-206`;
  - `features/homework/ui/attachment-list.ts:18`;
  - строки копирования:
    - `features/identity/students/invite-link-dialog.ts:41`;
    - `features/schedule/ui/calendar-feed-panel.ts:33, 72-80`;
    - `features/schedule/teacher/google-calendar-panel.ts:179, 258-267`;
    - `features/meetings/settings/meetings-settings-panel.ts:140, 232-241`;
    - `features/meetings/rooms/room-dialog.ts:47`;
  - `features/settings/backups/restore-dialog.ts:88`;
  - `features/admin/settings/settings-page.ts:202`;
  - `features/billing/home/finance-widget.ts:54`;
  - `features/billing/home/my-balance-widget.ts:32`;
  - `features/home/student-welcome-card.ts:38`;
  - `features/notifications/student/connect-messenger-card.ts:32-38`;
  - `features/schedule/home/upcoming-lesson-widget.ts:26-31`.
- **Источники:** ST3-11, ST3-16, ST1-16, ST1-26, ST2-14.

<a id="da-071"></a>
### DA-071. Статусы вне `p-tag` и разной формы

- **Серьёзность:** Minor · **Уровень:** A (ADR-0018: «Статусы — `p-tag` одной формы, 8 px») · **Раздел:** компоненты
- **Где:** задания (список, страница, виджет главной), «ИИ» администратора, мессенджеры, «Требует внимания», окно
  занятия, история оплат.
- **Что сейчас:**
  - **«Просрочено»** — таблетка (`[rounded]`) в списке и на странице задания, 8 px в виджете главной. К тому же срок
    выделен красным текстом.
  - **Итог запроса к ИИ у администратора** — сырой enum текстом: `{{ request.status }}`. У учителя тот же список сделан
    через `p-tag`.
  - **Мессенджер** — `TELEGRAM` заглавными.
  - **Свой счётчик-«бейдж»** в «Требует внимания».
  - **Запрос в окне занятия** — плашка `--p-highlight-background`.
  - **Отменённое** — зачёркивание, прозрачность и тег одновременно.
  - **Цвета статуса занятия** заданы по месту трижды.
  - **Каждое списание** в истории — красным, хотя это не ошибка.
- **Как должно быть:** ADR-0018 — статус всегда `p-tag` одной формы (8 px) и цвета по смыслу; ADR-0019 — цвет роли,
  а не палитры; enum не показывается пользователю.
- **Почему важно:** «Просрочено» в трёх видах читается как три разных статуса; красные списания выглядят как ошибки;
  `TELEGRAM` и сырой статус выдают внутренние коды.
- **Предложение:** одна функция «статус → `p-tag`» на каждый домен; убрать `[rounded]`.
- **Все вхождения:**
  - `features/homework/ui/task-status-tag.ts:15`;
  - `features/homework/home/my-deadlines-widget.ts:43-45`;
  - `features/homework/student/my-homework-page.ts:60`;
  - `features/homework/student/my-task-page.ts:49`;
  - `features/admin/integrations/integrations-page.ts:103-108`;
  - `features/admin/events/events-page.ts:94`;
  - `features/home/attention-card.ts:39, 48-56`;
  - `features/schedule/teacher/lesson-details-dialog.ts:105, 302-306`;
  - `styles.scss:931-934`;
  - `features/billing/ledger/ledger-table.ts:40, 56, 66`;
  - `features/billing/teacher/monthly-report-page.ts:146, 153-159, 186`;
  - `features/schedule/schedule-labels.ts:15-22`.
- **Источники:** ST3-15, LV2-19, LV3-11.

<a id="da-072"></a>
### DA-072. Форматы дат и чисел: восемь масок, «2026-09», «0» без ₽, нет склонений и неразрывных пробелов

- **Серьёзность:** Minor · **Уровень:** C · **Раздел:** тексты
- **Где:** все роли — даты и время в списках, уведомлениях, виджетах, отчётах; числа с единицами; «ИИ» администратора
  и учителя; баланс ученика.
- **Что сейчас:**
  - **Маски дат** — `DatePipe`:
    - `dd.MM.yyyy HH:mm` — 22 места;
    - `dd.MM.yyyy` — 8;
    - `dd.MM HH:mm`, `dd.MM, HH:mm`, `dd.MM HH:mm:ss`, `HH:mm`.
  - **Intl:**
    - «вт, 29.09, 18:20–19:20» — день недели строчными;
    - «Пн, Ср в 16:00» — с заглавной;
    - «Вс 09:00–21:00» — без «в».
  - **Одно событие в двух форматах:**
    - уведомление — `dd.MM.yyyy HH:mm` во входящих и `dd.MM HH:mm` на главной;
    - срок задания — «02.10.2026 23:59» в списке и «до 02.10, 23:59» в виджете.
  - **Месяц.** «Использование за 2026-09» (бэкенд отдаёт `YearMonth.toString()`), фильтр отчёта «09.2026», в «Финансах» —
    «за сентябрь».
  - **Баланс 0** — «0» серым без «₽».
  - **Склонения.** Функции нет: «1 токенов», «22 токенов», сокращение «запр.». Везде обход «Подпись: N», и он разный:
    «Получателей: N» и «Получили учеников: N».
  - **Неразрывных пробелов** между числом и единицей нет нигде: «1 МБ», «45 мин», «0,4 с» разрываются.
  - **Мелочи:** точки в подсказках то есть, то нет; «например» с запятой и без, со строчной и заглавной.
  - **Что в порядке** ✓: деньги — единый `MoneyPipe`; размеры — `formatFileSize`; цифры Roboto табличные по умолчанию
    (замер: «0000» и «1111» по 35,97 px), `tabular-nums` не нужен.
- **Как должно быть:** одно событие — один формат во всех местах; числа согласованы с существительным («1 токен»,
  «22 токена»); число и единица не разрываются; нулевой баланс — с валютой (ADR-0021 §Переносы, типографика русского
  текста).
- **Почему важно:** учитель сравнивает сроки из разных мест и видит разные записи одного времени; «1 токенов» и
  «2026-09» выглядят как недоделка.
- **Предложение:**
  - `shared/dates` — 3–4 именованные маски, год только не для текущего года, «сегодня» и «завтра»; вместе с DA-033;
  - pipe `plural` на `Intl.PluralRules('ru')`;
  - «0 ₽ — всё оплачено»;
  - неразрывный пробел в шаблонах «число + единица»;
  - около 60 правок.
- **Все вхождения:**
  - полный список масок и счётчиков — ST5-16, ST5-17;
  - ключевые места:
    - `features/schedule/schedule-labels.ts:65-123`;
    - `features/ai/ai-usage-page.ts:87, 102-103, 136`;
    - `features/admin/integrations/integrations-page.ts:77, 113`;
    - `features/billing/teacher/monthly-report-page.ts:54`;
    - `features/billing/home/finance-widget.ts:8`;
    - `features/billing/ledger/balance-amount.ts:10-18`;
    - `shared/files/file-size.ts:4, 13`;
    - `features/admin/admin-labels.ts:41-46`;
    - `features/admin/logs/log-page.ts:115`.
- **Источники:** ST3-17, ST5-16, ST5-17, ST5-20, LV3-22, LV3-25, LV4-30.

<a id="da-073"></a>
### DA-073. Тексты ошибок: общие фразы, непереведённые коды сервера

- **Серьёзность:** Minor · **Уровень:** C · **Раздел:** тексты
- **Где:** тосты и сообщения об ошибках всех ролей (`core/http/error-messages.ts`, интерцептор).
- **Что сейчас:**
  - **Запасные тексты по статусу** ничего не объясняют:
    - «Некорректный запрос», «Не найдено», «Конфликт данных», «Операция невозможна»;
    - «Произошла ошибка. Попробуйте позже», «Внутренняя ошибка сервера»;
    - «Не получилось. Попробуйте позже» — без указания, что именно.
  - **Заголовок тоста** всегда «Ошибка».
  - **15 серверных кодов без перевода.** `task.grade-invalid`, `payment.reason-invalid`, `account.not-active`,
    `settings.read-only` и другие показываются как «Операция невозможна». Часть, возможно, недостижима из-за `@Size`.
  - **Одна фраза с разной пунктуацией:** «Сессия истекла. Войдите снова.» и «Сессия истекла. Войдите снова».
  - **Работает:** коды ошибок показываются («Код ошибки: …») ✓; блокировка частых попыток входа сформулирована понятно ✓.
- **Как должно быть:** Нильсен №9 — ошибка говорит, что не получилось и что делать; каждый код сервера переведён;
  одна фраза — одна пунктуация.
- **Почему важно:** «Операция невозможна» не подсказывает, что поправить (например, оценку вне диапазона), и
  пользователь повторяет то же действие.
- **Предложение:**
  - дописать коды в `error-messages.ts`;
  - заголовок тоста — по действию: «Не удалось сохранить оплату»;
  - про двойные сообщения — DA-046.
- **Все вхождения:**
  - `core/http/error-messages.ts:9-17, 43-47, 56-57, 76-88, 164-188`;
  - `core/http/api-error.interceptor.ts:25`;
  - `features/schedule/teacher/schedule-page.ts:464`;
  - `features/meetings/rooms/room-dialog.ts:233`;
  - `features/boards/manage/boards-dialog.ts:217`;
  - `features/identity/login/login-page.ts:25`.
- **Источники:** ST5-14.

<a id="da-074"></a>
### DA-074. Мелочи кабинета ученика: форма после сдачи остаётся открытой, строка подсвечивается, но не открывается, заголовок в семь строк, лист не смахивается

- **Серьёзность:** Minor · **Уровень:** C + B · **Раздел:** UX, компоненты
- **Где:** ученик — страница задания после сдачи, список заданий (1440 px), страница задания с длинным названием
  (360 px), нижний лист занятия (390 px).
- **Что сейчас:**
  - **Форма после сдачи.** Сразу после «Отправлено» под заданием — пустая форма «Новый ответ» и зелёная filled
    «Отправить на проверку» при статусе «На проверке» (`LV3/lv3-task-submitted-390-light.png`).
  - **Список заданий** (1440 px):
    - строка подсвечивается при наведении, но щелчок вне названия ничего не делает;
    - «27.09.2026 20:00» переносится в две строки;
    - «Выдано» и «Просрочено» стоят столбиком.
  - **Длинное название задания** на 360 px — семь строк заголовка, и «?» справки оказывается посередине блока.
  - **Нижний лист не смахивается.** Протяжка вниз на 300–360 px — касанием через CDP и мышью — лист не закрывает.
    Ручка декоративная, а M3 bottom sheet закрывается смахиванием (по памяти, требует сверки). ADR-0022 жест не
    оговаривает.
- **Как должно быть:** после отправки форма не предлагает «отправить» ещё раз (Нильсен №1); подсвечивается только то,
  что открывается (ADR-0020 §Строка списка); заголовок — не длиннее нескольких строк; у листа с ручкой работает
  смахивание (M3 bottom sheet, по памяти, требует сверки) или ручки нет.
- **Почему важно:** ученик не уверен, что работа ушла, и отправляет её снова; ложная подсветка и декоративная ручка
  обещают действие, которого нет.
- **Предложение:**
  - при `SUBMITTED` сворачивать форму до «Дополнить ответ»;
  - строка открывается целиком (`tb-list__stretched`) или без подсветки;
  - обработчик перетаскивания листа, либо записать отказ в ADR-0022 и убрать ручку.
  - **меняет функционал:** сворачивание формы после сдачи, смахивание листа.
- **Все вхождения:**
  - `features/homework/student/my-task-page.ts:82-104`;
  - `features/homework/student/my-homework-page.ts:44, 57-69`;
  - `shared/ui/page-header.ts` (`tb-page-heading`);
  - `styles.scss:1778-1812`;
  - `features/schedule/student/my-schedule-page.ts:176-207`.
- **Источники:** LV3-33, LV3-32, LV3-36, LV3-17.

<a id="da-075"></a>
### DA-075. Мессенджер ученика: у паузы нет подписи и статуса; поля тихих часов — не по ADR-0022

- **Серьёзность:** Minor · **Уровень:** A + C · **Раздел:** компоненты, UX
- **Где:** ученик — «Уведомления» → «Мессенджеры» и «Тихие часы»; проверено на временном инстансе с ботом.
- **Что сейчас** (проверено на временном инстансе с ботом, 390 px):
  - **Пауза.** Тумблер 52×32 без видимой подписи. После паузы строка остаётся прежней — «Telegram @e2e_7303, с
    29.09.2026».
  - **Отключение.** «×» «Отключить Telegram» срабатывает сразу, см. DA-029.
  - **Тихие часы.** «с [22:00] до [08:00]» — простые `label` сбоку от выпадающих списков, см. DA-017. В каждом списке
    48 значений.
- **Как должно быть:** у переключателя — видимая подпись, состояние видно в строке (WCAG 1.3.1, 3.3.2); поля времени —
  `.tb-field` с подписью на рамке (ADR-0022 §Поля).
- **Почему важно:** ученик не понимает, что делает тумблер и включена ли пауза, — и пропускает напоминания о занятиях.
- **Предложение:** подпись «Присылать» у тумблера и «на паузе» в подписи строки; поля «С» и «До» — `.tb-field`.
- **Все вхождения:** `features/notifications/channels/channels-panel.ts:56-80`;
  `features/notifications/preferences/preferences-panel.ts:80-95`.
- **Источники:** LV3-29.

<a id="da-076"></a>
### DA-076. Новое занятие: прошедшее время сохраняется без вопроса; предупреждение о пересечении — с двумя кнопками «сохранить»

- **Серьёзность:** Minor · **Уровень:** C · **Раздел:** UX, состояния
- **Где:** учитель — окна «Новое занятие» и «Регулярные занятия»; 1440 и 390 px.
- **Что сейчас:**
  - **Прошедшее время.** Занятие на вчера 10:00 сохранено без вопроса и сразу попало в «Отметьте прошедшие».
  - **Пересечение.** Жёлтый блок (2,84 : 1, см. DA-004) с text-кнопкой «Всё равно сохранить» и зелёной «Сохранить» в
    подвале. Нижний край блока срезан прокруткой (`LV2/dlg-lesson-overlap-1440.png`).
- **Как должно быть:** Нильсен №5 — «Занятие в прошлом — записать как проведённое?»; одно действие сохранения.
- **Почему важно:** занятие, созданное задним числом по ошибке в дате, сразу требует отметки и влияет на баланс;
  две кнопки «сохранить» заставляют угадывать, какая сохранит с пересечением.
- **Предложение:**
  - при времени в прошлом — вопрос в окне: «Занятие в прошлом. Сохранить?» (**меняет функционал**: новый шаг сценария);
  - пересечение — сообщение роли warning (см. DA-004) и одна кнопка «Сохранить» в подвале, которая после
    предупреждения сохраняет с пересечением;
  - уровень окна, малый объём.
- **Все вхождения:** `features/schedule/teacher/lesson-dialog.ts:130-155`; `features/schedule/teacher/series-dialog.ts:175-195`.
- **Источники:** LV2-18.

<a id="da-077"></a>
### DA-077. Перезапуск, восстановление и сброс почти без обратной связи; совет про Docker, когда портал не в Docker

- **Серьёзность:** Minor · **Уровень:** C + A (ADR-0019 §Индикатор загрузки) · **Раздел:** состояния, тексты
- **Где:** администратор и учитель — «Сохранить и перезапустить», «Восстановление из копии», «Сбросить все данные»;
  учитель и ученик во время перезапуска и после сброса. Проверено на своём инстансе (390 и 1440 px).
- **Что сейчас:**
  - **Перезапуск.** «Портал перезапускается, чтобы применить настройки…» — только текст, без индикатора и оценки
    времени (реально около 15 с).
  - **Восстановление:**
    - в окне `pi-spin`, а не индикатор M3;
    - в конечных состояниях «manual», «failed», «silent» есть только «×»;
    - текст «manual» советует `docker compose restart` именно тогда, когда портал не в Docker.
  - **Учитель во время перезапуска** видит ошибку браузера «This site can't be reached».
  - **Ученик, удалённый сбросом,** продолжает видеть пустой кабинет со старым названием, а после перезагрузки попадает
    на `/login` без объяснения.
  - **Тост сброса** — «Копия перед сбросом: teacherbox-20260929-190311-273.zip».
- **Как должно быть:** ADR-0019 §Индикатор загрузки — долгие операции показывают индикатор M3E; у каждого конечного
  состояния есть выход («Закрыть»); текст совета соответствует способу установки (Нильсен №1, №9).
- **Почему важно:** перезапуск и восстановление — самые рискованные операции; без индикатора и оценки времени
  администратор перезапускает повторно или закрывает вкладку посреди восстановления.
- **Предложение:**
  - индикатор M3E и «обычно около 15 секунд»;
  - «Закрыть» во всех конечных состояниях;
  - текст «перезапустите портал (службу или контейнер)»;
  - для удалённого пользователя — сообщение «Ваш доступ закрыт».
  - **меняет функционал:** сообщение удалённому пользователю «Ваш доступ закрыт».
- **Все вхождения:**
  - `features/admin/settings/settings-page.ts:201-219, 236-238`;
  - `features/settings/backups/restore-dialog.ts:88-120`;
  - `features/settings/reset-card.ts:135-146`;
  - `core/auth/auth.interceptor.ts`.
- **Источники:** LV4-21.

<a id="da-078"></a>
### DA-078. Цели касания меньше 48 px, как требует M3; минимум WCAG 2.5.8 (24 px) соблюдён

- **Серьёзность:** Minor · **Уровень:** B · **Раздел:** доступность
- **Где:** настройки портала (образцы цвета), «Мессенджеры учеников» (флажки), шапка, строки главной, карточки
  учеников, журнал администратора, тосты; 390 px, касание.
- **Что сейчас:**
  - **Мелкие цели:**
    - образцы цвета портала — 36×36;
    - флажки таблицы мессенджеров — 20×20;
    - кнопки 40×40 в шапке с зазором 4 px;
    - ссылки «Доска Анны» и «Подключите мессенджер» — высотой 24 px;
    - «Добавить» в карточках — 32 px;
    - код запроса в журнале — 91–102×24;
    - «×» тоста — 28×28.
  - **Checkbox и radio** — область нажатия равна значку, 18 и 20 px. Спасает `<label for>`, он есть у всех.
- **Как должно быть:** M3 — цель касания 48×48; у кнопки-значка Material Web добавляет цель 48 (сверено: MW
  `iconbutton/internal/_shared.scss`: `max(48px, …)`).
- **Почему важно:** на телефоне соседние цели 40 px с зазором 4 px и цели высотой 24 px легко перепутать пальцем —
  особенно в шапке, где рядом колокольчик и меню пользователя.
- **Предложение:** невидимое расширение цели (`::before` с `inset: -4px`) у кнопок-значков и ссылок в строках;
  образцы — 48 px.
- **Все вхождения:**
  - `features/settings/portal-settings-card.ts:191-220`;
  - `features/notifications/teacher/student-messengers-panel.ts:56, 64`;
  - `core/layout/shell.scss:62-67`;
  - `features/schedule/home/next-lesson-widget.ts`;
  - `features/home/first-run-checklist.ts`.
- **Источники:** LV2-34, LV1-17.

<a id="da-079"></a>
### DA-079. «Мало места на диске» обозначено только красным цветом

- **Серьёзность:** Minor · **Уровень:** C (WCAG 1.4.1; проверено по коду, на стенде места достаточно) · **Раздел:** цвет
- **Где:** администратор — «Состояние» → «Диск» (по коду).
- **Что сейчас:** при свободном месте меньше 10 % значение получает только `tb-negative` — без текста и значка.
- **Как должно быть:** WCAG 1.4.1 — состояние не передаётся только цветом: текст или значок рядом со значением.
- **Почему важно:** при цветовой слепоте администратор не заметит, что диск заканчивается, — а без места не создадутся
  резервные копии.
- **Предложение:** подпись «Мало места» или тег error рядом со значением.
- **Все вхождения:** `features/admin/status/status-page.ts:74-80, 115-118`.
- **Источники:** LV4-25.

<a id="da-080"></a>
### DA-080. axe critical: `aria-level` у progressbar и пустые `role=list` FullCalendar

- **Серьёзность:** Minor (critical в axe, но пользователю почти не мешает) · **Уровень:** C · **Раздел:** доступность
- **Где:** главная учителя («С чего начать»), «ИИ» (расход), расписание учителя и ученика (FullCalendar); axe на 13
  экранах.
- **Что сейчас:**
  - `<p-progressbar role="progressbar" aria-level="75%">` — атрибут ставит PrimeNG. axe: aria-allowed-attr и
    aria-valid-attr-value, critical; «С чего начать», все состояния.
  - У progressbar расхода ИИ нет `aria-label`.
  - FullCalendar — `div[role=list][aria-label=Events]` без listitem в днях без событий: aria-required-children, 4–7 на
    экран.
- **Как должно быть:** axe без critical: атрибуты ARIA допустимы для роли, у progressbar есть имя, у `role=list` есть
  `listitem` или роли нет (WCAG 4.1.2).
- **Почему важно:** шум для скринридера. Critical в отчёте axe помешает ввести проверку доступности в CI.
- **Предложение:** `[attr.aria-level]="null"` или своя обёртка; `ariaLabel` у progressbar; FullCalendar — issue в апстрим.
- **Все вхождения:** `features/home/first-run-checklist.ts:37-42`; `features/ai/ai-usage-page.ts:97`;
  `features/schedule/ui/schedule-calendar.ts`.
- **Источники:** LV1-22.

---

## Nit

<a id="da-081"></a>
### DA-081. Мелочи вёрстки

- **Серьёзность:** Nit · **Уровень:** A / C · **Раздел:** форма, компоненты
- **Где:** окна занятия, задания, запроса ученика; главная учителя и ученика на 360 px; «Уведомления» учителя;
  «Мой аккаунт»; мастер настройки; «Состояние» администратора; справка по доскам.
- **Что сейчас:** пятнадцать мелких отступлений — каждое в отдельной строке «Все вхождения»: что не так и где в коде.
- **Как должно быть:** ADR-0018, ADR-0021 и ADR-0022 (кнопки на своих местах, поля и отступы из токенов, окно не
  срезает содержимое); тексты — точные для платформы пользователя.
- **Почему важно:** по отдельности не мешают, вместе дают ощущение неаккуратности; часть — дешёвые правки на одну
  строку.
- **Предложение:** одна задача «мелочи вёрстки» — правки по списку, каждая на 1–3 строки; «Ctrl+V» → «Ctrl+V (на Mac —
  Cmd+V)».
- **Все вхождения:**
  - подсказка под «Управлять порталом через бота» течёт в строку подписи —
    `features/notifications/teacher/bot-abilities-panel.ts:47-59`, `styles.scss:726-731`;
  - календарь выбора даты в окне занятия вылезает на −2 px и закрывает заголовок окна —
    `features/schedule/teacher/lesson-dialog.ts:88`;
  - в окне «Запрос ученика» пустой зазор около 50 px между строкой запроса и цитатой —
    `features/schedule/teacher/request-answer-dialog.ts:40-70`;
  - в «Новом задании» «Добавить группу» срезано прокруткой — `features/homework/teacher/assignment-dialog.ts`;
  - половины «Перенести | Отменить» на главной на 360 px — 146 и 140 px (в листе 152 и 152 ✓); нужно `flex: 1 1 0` —
    `styles.scss:1749-1760`;
  - «Копировать» ссылки календаря выровнена по верху поля, а не по центру — `features/schedule/ui/calendar-feed-panel.ts`;
  - виджет «Уведомления» на главной — пять одинаковых строк «Работа на проверку: «Графики функций»» без имени
    ученика — `features/notifications/home/latest-notifications-widget.ts`;
  - пустая ячейка действий рисует разделитель в карточке строки на телефоне — `styles.scss:1365-1369`;
  - `.tb-page-title { margin: 0 0 var(--tb-space-4) }` — единственное использование этот отступ сбрасывает —
    `styles.scss:197, 220-222`;
  - мастер настройки — своя ширина 44rem — `features/settings/setup/setup-page.ts:259`;
  - «Состояние» администратора — блоки вне `tb-stack` — `features/admin/status/status-page.ts:31-94`;
  - подсказка о часовом поясе стоит между шапкой и первой карточкой — `features/schedule/teacher/schedule-page.ts:110-112`;
  - `nav aria-label="Быстрые действия"` для кнопок создания — это не навигация — `features/home/quick-actions.ts:18`;
  - у поля «Имя» в «Моём аккаунте» учителя одновременно `label for` и `aria-label` — `features/identity/account/account-page.ts:33, 39`;
  - «Ctrl+V» в инструкции к доскам — на Mac это Cmd+V — `features/boards/to-board/to-board-dialog.ts:52, 76`,
    `features/help/articles/teacher.ts:205`.
- **Источники:** LV2-21, LV2-30, LV2-35, LV3-28, LV3-35, LV4-31, ST3-20, ST2-18.

<a id="da-082"></a>
### DA-082. Нижний лист и связанная группа кнопок не переиспользуются; пары решений не собраны в группы; мелочи кнопок

- **Серьёзность:** Nit · **Уровень:** A + B · **Раздел:** компоненты
- **Где:** нижний лист и связанная группа кнопок (кабинет ученика), строки «Боты мессенджеров», «Отметьте прошедшие»,
  окна запроса и проверки работы, «На доску»; `p-selectbutton` в двух местах; подтверждения.
- **Что сейчас:**
  - **Одно использование.** `tb-sheet` есть только в листе занятия ученика, `tb-button-group` — только в
    `lesson-actions`.
    - Стили связанной группы описаны только внутри `.tb-lesson-actions--stacked`, вне неё класс даёт лишь flex с
      зазором 4 px.
    - Поэтому «связанную группу для следующих экранов» из ADR-0022 §Последствия получить нельзя.
    - Первый кандидат на лист — хвост строки «Боты мессенджеров»: тег, кнопка, значок.
  - **Пары решений,** которые читались бы как одно решение в связанной группе M3E: «Проведено | Пропуск», «Отклонить |
    Согласовать», «Принять | Вернуть на доработку». Кандидат на split button — «Текстом | ▾ Картинкой» в «На доску».
    ADR-0022 ограничивает группы нижним листом, поэтому это предложение, а не дефект.
  - **`size="small"`** у двух `p-selectbutton`: без эффекта, но вопреки ADR-0018. E2E проверяет только `.p-button-sm`.
  - **Значок ⚠** есть у 2 из 10 подтверждений.
- **Как должно быть:** ADR-0022 §Последствия — лист и связанная группа — общие элементы «для следующих экранов»;
  ADR-0018 — без `size`; одинаковые подтверждения выглядят одинаково.
- **Почему важно:** общий элемент, который нельзя применить вне одного экрана, заставит следующий экран делать свою
  копию; значок ⚠ у двух подтверждений из десяти — разнобой.
- **Предложение:** вынести стили связанной группы в сам `.tb-button-group`; убрать `size`; добавить
  `.p-togglebutton-sm` в E2E; значок задавать в `dangerConfirmation`.
- **Все вхождения:**
  - `styles.scss:1732-1771`;
  - `features/schedule/ui/lesson-actions.ts:26`;
  - `features/notifications/teacher/bots-panel.ts:54-83`;
  - пары решений:
    - `features/schedule/teacher/schedule-page.ts:167, 176`;
    - `features/schedule/home/today-lessons-widget.ts:77, 87`;
    - `features/schedule/teacher/lesson-details-dialog.ts:244, 253`;
    - `features/schedule/teacher/request-answer-dialog.ts:112, 119`;
    - `features/homework/teacher/task-review-page.ts:110, 119`;
    - `features/boards/to-board/to-board-dialog.ts:93, 101`;
  - `size="small"` — `features/homework/teacher/assignment-dialog.ts:92`, `features/schedule/teacher/attendance-dialog.ts:64`;
  - значок ⚠ — `features/identity/students/students-page.ts:449`, `features/identity/groups/groups-panel.ts:359`,
    `shared/ui/confirmation.ts:8-13`.
- **Источники:** ST3-19, ST1-20, ST1-21, ST1-23.
