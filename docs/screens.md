# Screens

How each screen is put together and why: route and files, parts, non-obvious transitions and states,
the sketch board it follows. Labels, icons, sizes and colours are in the templates, the dictionaries
(`features/<m>/i18n/`) and [`design-system.md`](design-system.md) (§ below point there); module
behaviour is in `docs/modules/<m>.md`. Marks: **M3** — published by Material 3, *ours* — a portal
decision. A change to a screen updates its page in the same commit. Boards: `docs/sketches/`
(excluded from searches: `rg --no-ignore`).

Shared loading feedback follows [design-system §12](design-system.md#12-states-and-feedback):
all standalone loading indicators wait 200 ms, cancel on completion and hold a static shape under
system reduced motion. This also applies to invitation validation and joining a call.

## Frame by role

Destinations, bottom bars, «Аккаунт», offline page — [screens/frame.md](screens/frame.md).

## Notifications (the bell)

The sheet in its two forms — [screens/notifications.md](screens/notifications.md).

## Today (teacher home)

[screens/today.md](screens/today.md).

### Nearest lesson hero

Shared by both home pages — [screens/today.md](screens/today.md#nearest-lesson-hero).

## Schedule (teacher)

Calendar, lesson card, requests — [screens/schedule.md](screens/schedule.md).

## Students and groups

[screens/students.md](screens/students.md).

## Homework (teacher)

List, assignment, review, editor, AI pane — [screens/homework.md](screens/homework.md).

## Payments (teacher)

[screens/payments.md](screens/payments.md).

## Materials

[screens/materials.md](screens/materials.md).

## Settings (teacher)

[screens/settings.md](screens/settings.md).

## First-run setup (teacher)

[screens/settings.md](screens/settings.md#first-run-setup).

## Student cabinet

Home, schedule, homework, payments, account — [screens/cabinet.md](screens/cabinet.md).

## Admin

[screens/admin.md](screens/admin.md).

## Call window

[screens/call.md](screens/call.md).
