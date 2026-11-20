# Materials

`/teacher/materials?tab=boards|textbooks|plans` (`MaterialsPage`, `features/materials`): one
flexible pane without a card — title, the connected group boards / textbooks / plans with counts, a
wrapping toolbar (search, filter chips, sort menu) and the `tb-material-grid` of `tb-material-card`s
([design-system §10](../design-system.md)).

- **Isolation (AGENTS.md §4.2.6):** `features/materials` only composes `BoardsFeed`
  (`@features/boards/parts`), `TextbooksFeed` and `LessonPlansFeed` (`@features/textbooks/parts`).
  Each owns its API, cards, «⋮» and dialogs and takes search, filter, sort and member as inputs. All
  stay mounted (the inactive ones `hidden`) so every count is known.
- **Courses** (ADR-0071, under the toolbar on the textbooks and plans tabs, not on boards): filter
  chips «Все · <courses in their order> · Без курса» (`tb-filter-chips [oneRow]`),
  `?course=<id>|none` (a gone id filters nothing), passed to `TextbooksFeed [course]` and
  `LessonPlansFeed [course]`; «⋮» beside them opens a menu with «Курсы», without courses a text
  button «Курсы» takes their place. `CoursesDialog` (`@features/textbooks/parts`, a `sheet`): the
  courses as a segmented list — drag handle (↑ ↓ on it, `PUT …/courses/order`, a refused order rolls
  back), the name, ✎ (rename in place: Enter saves, Esc cancels) and 🗑 (danger confirmation); a
  field with «Добавить» under the list. Every change saves at once; on close the page reads the
  textbooks again (their course may have changed), the plans too. *Ours:* the menu with one item
  keeps «⋮» of the spec for later course actions.
- The textbook dialog has the «Курс» select («Без курса» first) and «Ученики курса» in
  `tb-member-picker [courses]` (a third section, shown only where courses are given).
- **Plans** (roadmap 11 «Bank», `LessonPlansFeed`, `GET …/textbooks/plans?bank=true`): the bank
  items as tonal cards with the `list_alt` icon — the title, «<course> · Использовано N раз» («Без
  курса», «Ещё не использовался»). No kind chips; the search finds the title and the course; the
  sort has «Сначала изменённые» and «По названию» only (the list has no creation time). A card
  opens the editor, «⋮» has «Изменить» and «Удалить…» (danger confirmation; the lessons' copies
  stay). «Новый план» — a filled button in the header (the FAB on a phone) — opens
  `/teacher/materials/plans/new`.
- **Plan editor** (`LessonPlanEditorPage`, `features/textbooks/teacher/lesson-plan-editor-page.ts`,
  `/teacher/materials/plans/new` and `…/plans/:planId`, `canLeaveGuard`): the page header (the
  title as typed, back to «Материалы» on «Планы»; the chip «В банке» on a bank item, «сохранено ·
  HH:mm», «⋮» of a lesson's plan with «Сохранить в банк» / «Обновить в банке» — the latter asks
  (`safe` confirmation) — and the filled «Готово»), then one column of section cards, at most
  52rem wide: «Название», «Курс» (a select while there are courses; its hint says the plan takes
  only the course's textbooks) and the Markdown field «План» (`tb-markdown-field`); «Учебники» with
  «N из 20» — rows with ✎ (pages, `BindTextbookDialog`) and ✕, «Добавить учебник» opens
  `BindTextbookDialog [courseId]` (the course's textbooks when a course is set, else all);
  «Видео» with «N из 5» — `VideoSection` of 459.2 (automatic YouTube transcripts). The plan saves
  itself 1.5 s after a change (a new one once it has a title — a bank item, as it is made in
  «Материалы»; the address becomes `…/plans/:id`); «Готово» saves the rest, `POST …/{id}/finish`
  and goes back; leaving saves what is left. A save during an autosave waits for it.
- «Создать» leads to `?tab=…&create=board|textbook`; `/teacher/boards` and `/teacher/textbooks`
  redirect to the tabs.
- **Student** (`/cabinet/materials`, `MyMaterialsPage`): the same feeds without actions
  (`MyBoardsFeed`, `MyTextbooksFeed`); `/cabinet/boards` and `/cabinet/textbooks` redirect.

The full-screen board editor shows the teacher an inline warning below the header once the saved
scene reaches 4 M of its 5 M character limit: make a backup from the menu and create a new board.
It follows the latest open/save/poll response and disappears below the threshold; students do not
see a teacher-only instruction.
