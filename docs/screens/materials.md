# Materials

`/teacher/materials?tab=boards|textbooks` (`MaterialsPage`, `features/materials`): one flexible pane
without a card — title, the connected group boards / textbooks with counts, a wrapping toolbar
(search, filter chips, sort menu) and the `tb-material-grid` of `tb-material-card`s ([design-system
§10](../design-system.md)).

- **Isolation (AGENTS.md §4.2.6):** `features/materials` only composes `BoardsFeed`
  (`@features/boards/parts`) and `TextbooksFeed` (`@features/textbooks/parts`). Each owns its API,
  cards, «⋮» and dialogs and takes search, filter, sort and member as inputs. Both stay mounted (the
  inactive one `hidden`) so both counts are known.
- «Создать» leads to `?tab=…&create=board|textbook`; `/teacher/boards` and `/teacher/textbooks`
  redirect to the tabs.
- **Student** (`/cabinet/materials`, `MyMaterialsPage`): the same feeds without actions
  (`MyBoardsFeed`, `MyTextbooksFeed`); `/cabinet/boards` and `/cabinet/textbooks` redirect.

The full-screen board editor shows the teacher an inline warning below the header once the saved
scene reaches 4 M of its 5 M character limit: make a backup from the menu and create a new board.
It follows the latest open/save/poll response and disappears below the threshold; students do not
see a teacher-only instruction.
