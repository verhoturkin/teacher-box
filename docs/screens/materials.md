# Materials

`/teacher/materials?tab=boards|textbooks` (`MaterialsPage`, `features/materials`): one flexible pane
without a card — title, the connected group boards / textbooks with counts, a wrapping toolbar
(search, filter chips, sort menu) and the `tb-material-grid` of `tb-material-card`s ([design-system
§10](../design-system.md)).

- **Isolation (AGENTS.md §4.2.6):** `features/materials` only composes `BoardsFeed`
  (`@features/boards/parts`) and `TextbooksFeed` (`@features/textbooks/parts`). Each owns its API,
  cards, «⋮» and dialogs and takes search, filter, sort and member as inputs. Both stay mounted (the
  inactive one `hidden`) so both counts are known.
- **Courses** (ADR-0071, under the toolbar on the textbooks tab, not on boards): filter chips «Все ·
  <courses in their order> · Без курса» (`tb-filter-chips [oneRow]`), `?course=<id>|none` (a gone
  id filters nothing), passed to `TextbooksFeed [course]`; «⋮» beside them opens a menu with
  «Курсы», without courses a text button «Курсы» takes their place. `CoursesDialog`
  (`@features/textbooks/parts`, a `sheet`): the courses as a segmented list — drag handle (↑ ↓ on
  it, `PUT …/courses/order`, a refused order rolls back), the name, ✎ (rename in place: Enter
  saves, Esc cancels) and 🗑 (danger confirmation); a field with «Добавить» under the list. Every
  change saves at once; on close the page reads the textbooks again (their course may have
  changed). *Ours:* the menu with one item keeps «⋮» of the spec for later course actions.
- The textbook dialog has the «Курс» select («Без курса» first) and «Ученики курса» in
  `tb-member-picker [courses]` (a third section, shown only where courses are given).
- «Создать» leads to `?tab=…&create=board|textbook`; `/teacher/boards` and `/teacher/textbooks`
  redirect to the tabs.
- **Student** (`/cabinet/materials`, `MyMaterialsPage`): the same feeds without actions
  (`MyBoardsFeed`, `MyTextbooksFeed`); `/cabinet/boards` and `/cabinet/textbooks` redirect.

The full-screen board editor shows the teacher an inline warning below the header once the saved
scene reaches 4 M of its 5 M character limit: make a backup from the menu and create a new board.
It follows the latest open/save/poll response and disappears below the threshold; students do not
see a teacher-only instruction.
