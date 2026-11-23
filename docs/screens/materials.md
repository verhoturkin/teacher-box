# Materials

`/teacher/materials?course=<id>|none&tab=textbooks|plans|assignments|boards` (`MaterialsPage`,
`features/materials`, 466.1, roadmap 11 decisions 9–12): the **M3 list-detail** canonical layout
(`injectListDetail`, design-system §7).

- **List pane** (`tb-pane kind="fixed" resizeKey="materials"`): the page header «Материалы» with
  «?» and «Создать ▾», then the navigation menu `nav.tb-nav-menu` (466.4, design-system §10: the
  **M3** navigation drawer's destinations on one surface, not a segmented list): «Все материалы»
  (`stacks`); the headline «КУРСЫ» and the courses in their order (`CourseList` of
  `@features/textbooks/parts`) with «+ Новый курс» last; a divider; «Без курса»
  (`bookmark_remove`) and «Доски» (`co_present`). Each item is a 48 px pill linked as a whole,
  with its count at the end (Label Medium, on-surface-variant; the count is also in the link's
  name for screen readers): all — textbooks + plans + assignments, a course — its three kinds,
  «Без курса» — those without a course, «Доски» — the boards. The chosen item has the pill
  indicator of the rail (secondary-container across the item, on-secondary-container, Label
  Large emphasized) only while both panes stand (**M3**: the selected state is for two-pane
  layouts). An item keeps the tab in sight: «Все материалы» → `?tab=<tab>`, a course →
  `?course=<id>&tab=<tab>`, «Без курса» → `?course=none&tab=<tab>`, «Доски» → `?tab=boards`.
- **Courses** (`CourseList`, ADR-0071; `CoursesDialog` is gone): an item is the drag handle
  (`tb-drag-handle`, 24 px wide, ↑ ↓ on it, as the quiz and the videos; `PUT …/courses/order`, a
  refused order rolls back), the `collections_bookmark` icon (decision 11; the portal logo keeps
  `school`), the name, the count and «⋮» — shown on the chosen item, on hover and on focus within
  the item (on a touch screen on the chosen one). «⋮»: «Переименовать» (the name turns into a
  field in the item: Enter saves, Esc cancels, ✓ ✕), «Выше» / «Ниже» (**M3**: a single-pointer
  alternative to the drag) and «Удалить…» (danger confirmation). «+ Новый курс» is a primary
  item with `add` that turns into a field: Enter adds the course at the end, Esc or leaving it
  empty closes it. Every change saves at once; a rename or a delete reads the textbooks, plans
  and assignments again (their course changed).
- **Detail pane** (flexible): the chosen item's title (Title Large `h2` beside the list; on one
  pane the page header with «back» to `/teacher/materials`, «?» and «Создать ▾»), the tabs
  «Учебники · Планы · Задания» (`tb-tabs`, **M3** primary tabs; fixed on a phone; none for
  «Доски»), one toolbar row — the search (`tb-search-field`; «Название или курс» on plans and
  assignments), «Фильтр» (text button with `filter_list`, the chosen value as its label from
  600 px, a popup menu with a check: «Все · Учебники · Рабочие тетради · Другое» on textbooks,
  «Все · На портале · Внешние» on boards, none on plans and assignments; it resets when the kind
  changes) and the sort menu at the end; no chips. Then the `tb-material-grid` of
  `tb-material-card`s ([design-system §10](../design-system.md)).
- **Phone and medium** (one pane): `/teacher/materials` without parameters is the list; any of
  `?tab=` / `?course=` opens the detail, its header has «back» to the list. The list screen is
  the same menu across the width (`tb-nav-menu--touch`): 56 px items in Body Large, no chevrons
  (**M3** drawer items have none), every «⋮» shown (nothing is chosen there) and no drag handles
  («Выше» / «Ниже» in «⋮» move a course); the FAB «Создать» stays. Old links
  `?tab=boards|textbooks|plans|assignments` keep working (a gone course id filters nothing and
  shows «Все материалы»). *Ours:* the detail pane stays mounted (hidden) on the list screen, so
  the counts are known.
- **«Создать ▾»** (decision 10, the page's one create action): a filled button with
  `arrow_drop_down` and a popup menu — «Учебник» (`menu_book`, the textbook form of
  `TextbooksFeed`, `[course]` of `TextbookDialog`), «План урока» (`list_alt`,
  `/teacher/materials/plans/new?course=<id>`), «Задание» (`assignment`,
  `/teacher/homework/new?bank=true&course=<id>`), «Доска» (`co_present`, the board form). The
  chosen course is prefilled (none for «Все материалы», «Без курса», «Доски»). On a phone the same
  items are the page's `tb-fab-menu`. *Ours, beside **M3**:* the rail keeps the global «Создать»
  from 600 px, so the page has both (the teacher's decision: the page's one knows the course).
- **Isolation (AGENTS.md §4.2.6):** `features/materials` only composes `BoardsFeed`
  (`@features/boards/parts`), `TextbooksFeed`, `LessonPlansFeed` and `CourseList`
  (`@features/textbooks/parts`), `HomeworkBankFeed` (`@features/homework/parts`). Each feed owns
  its API, cards, «⋮» and dialogs, takes search, filter, sort and course as inputs and gives
  `total` and `courseCounts` (`countByCourse`). All stay mounted (the inactive ones `hidden`).
- The textbook dialog has the «Курс» select («Без курса» first) and «Ученики курса» in
  `tb-member-picker [courses]` (a third section, shown only where courses are given).
- **Plans** (roadmap 11 «Bank»; the UI calls the bank «шаблоны», decision 12; `LessonPlansFeed`,
  `GET …/textbooks/plans?bank=true`): the templates as tonal cards with the `list_alt` icon — the
  title, «<course> · Использовано N раз» («Без курса», «Ещё не использовался»). No filter; the
  search finds the title and the course; the sort has «Сначала изменённые» and «По названию» only
  (the list has no creation time). A card opens the editor, «⋮» has «Изменить» and «Удалить…»
  (danger confirmation; the lessons' copies stay). No button of its own: «Создать» → «План урока».
- **Assignments** (462.2, `HomeworkBankFeed`, `GET …/homework/assignments?bank=true`): the
  templates as tonal cards with the `assignment` icon — the title, «<course> · Использовано N раз»
  («Ещё не использовалось»). No filter; the search finds the title and the course; the sort has
  «Сначала изменённые» (by creation — a summary has no change time) and «По названию». A card
  opens the homework editor of the item, «⋮» has «Изменить» and «Удалить…» (danger confirmation;
  the copies stay). No button of its own: «Создать» → «Задание». The help button opens the
  homework article.
- **Plan editor** (`LessonPlanEditorPage`, `features/textbooks/teacher/lesson-plan-editor-page.ts`,
  `/teacher/materials/plans/new` and `…/plans/:planId`, `canLeaveGuard`): the page header (the
  title as typed, back to «Материалы» on «Планы»; the chip «Шаблон» on a bank item, «сохранено ·
  HH:mm», «С ИИ», the filled «Готово» and last «⋮» of a lesson's plan with «Сохранить как шаблон» /
  «Обновить шаблон» — the latter asks (`safe` confirmation); **M3**: the overflow menu ends the
  row, 466.2), then one column of section cards, at most
  52rem wide: «Название», «Курс» (a select while there are courses; its hint says the plan takes
  only the course's textbooks) and the Markdown field «План» (`tb-markdown-field`); «Учебники» with
  «N из 20» — rows with ✎ (pages, `BindTextbookDialog`) and ✕, «Добавить учебник» opens
  `BindTextbookDialog [courseId]` (the course's textbooks when a course is set, else all);
  «Видео» with «N из 5» — `VideoSection` of 459.2 (automatic YouTube transcripts). The plan saves
  itself 1.5 s after a change (a new one once it has a title — a bank item, as it is made in
  «Материалы»; the address becomes `…/plans/:id`). With `?lessonId=` (from the lesson card,
  461.4) it is the lesson's working plan: the hint «План этого урока…» instead of «Шаблон», the
  course prefilled from `?studentId=` / `?groupId=` (`course-links`), the first save links it to
  the lesson through the route's `linkToLesson` (a failed link is retried by the next save, the
  address keeps `?lessonId=`), back and «Готово» lead to the schedule; «Готово» saves the rest,
  «С ИИ» (secondary outlined, in the header, only when `AiApi.enabled$`; 464.2) opens
  `LessonPlanAiPanel` of `features/ai` in a `p-drawer` (a bottom sheet on a phone): the request,
  the context chips of the lesson's students, what the lesson tells (the topic, a mark that the
  previous summary goes along; the route's `lessonOf` reads the lesson and the previous held
  one), the sources (`planAiSources`: PDF/picture textbooks and videos with a transcript, all
  ticked until the teacher unticks) and the model pick; `POST /api/teacher/ai/lesson-plan`. The
  draft (title, Markdown) goes in by «Заменить план» (also narrows the bound textbooks to the
  chosen pages) or «Вставить в конец»; the title is set only when empty. `?ai=1` opens it with
  the editor. *Ours*: a drawer in every width and no prompt library, unlike the homework pane.
  `POST …/{id}/finish` and goes back; leaving saves what is left. A save during an autosave waits
  for it.
- The rail's «Создать» leads to `?tab=…&create=board|textbook` (the form opens with the course of
  `?course=`, if any); `/teacher/boards` and `/teacher/textbooks` redirect to `?tab=boards` and
  `?tab=textbooks`.
- **Student** (`/cabinet/materials`, `MyMaterialsPage`): the same feeds without actions
  (`MyBoardsFeed`, `MyTextbooksFeed`); `/cabinet/boards` and `/cabinet/textbooks` redirect.

The full-screen board editor shows the teacher an inline warning below the header once the saved
scene reaches 4 M of its 5 M character limit: make a backup from the menu and create a new board.
It follows the latest open/save/poll response and disappears below the threshold; students do not
see a teacher-only instruction.
