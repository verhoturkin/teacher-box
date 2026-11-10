# Frame by role

The shell (`core/layout/`: `shell.ts`, `teacher-layout.ts`, `student-layout.ts`, `admin-layout.ts`)
holds the rail, the bottom bar and the top strip. Navigation rules are in [design-system
§6](../design-system.md); each layout file holds its menu and bar order.

| Role | Destinations | Rail bottom group | Bottom bar |
|---|---|---|---|
| Teacher | Today (home), Schedule, Students, Homework, Materials, Payments | Settings, Help, Account | `TEACHER_BOTTOM_NAV` (five, without Materials) + «Создать» |
| Student | Home, Schedule, Homework, Materials, Payments | Help, Account | `STUDENT_BOTTOM_NAV` (all five) |
| Admin | Status, Journal, Integrations, Backups, Settings | Help, Account | all five (`ADMIN_MENU`) |

- The bar is filled up from the menu in the order of the `*_BOTTOM_NAV` list.
- The student's Homework item carries the **M3** large badge of open tasks (`OpenTasks`, re-read
  after each navigation) with a screen-reader line for the count.
- «Аккаунт» (avatar + name, last in the bottom group and in the ☰ drawer) replaces the avatar menu
  of the top bar; the top bar keeps only the bell (and the teacher's search). It leads to
  `/teacher/settings/account`, `/cabinet/account` or `/admin/account`.
- There is no Notifications, Calls or AI section (ADR-0048): the inbox is the bell's sheet
  ([notifications](notifications.md)), integrations live in teacher [settings](settings.md).
- Installed app: the service worker caches only the shell; without a network the app opens the
  frameless page `/offline` (empty state + retry). Data is never cached.
