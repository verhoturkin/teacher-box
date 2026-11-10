# Students and groups

`features/identity/` (`StudentsPage`, `StudentCard`, `GroupCard`): list-detail of one route,
`/teacher/students[/:studentId]` and `/teacher/groups/:groupId`; «Ученики» stays active on both
(`NavItem.alsoActive`). Tags follow the canvas «Ученики — эскизы» (boards `Main`, `States`,
`PhoneTags`; not copied to `docs/sketches/`) and settings board 16.

## List

- Filter chips all / groups / disconnected (`?filter=`; disconnected = students without access and
  archived groups). From expanded only the list scrolls.
- **Tag filter:** a menu chip shown while a list tag exists (free-text tags filter nothing). A value
  in force is `?tag=<valueId>`, unselects «all», hides the groups (they have no tags) and labels the
  chip «tag: value» (a name over 12 characters cut to its first word). On a phone the chip in force
  leads the row with «×» — *ours*: the row scrolls sideways and a filter in force must not hide.
- **Rows:** students by name, then groups (member count, not names). Balances come from billing,
  messengers from notifications, lessons from schedule; a failed read drops only its part. The trail
  is one status (debt or access / archive tag), absent when empty (`tb-list--own-trail`); no «⋮».
  Tags appear neither in rows nor in the card header.

## Creation and header

- The new-student form starts with the choice student / group and asks only name and contacts; the
  card then opens on the profile tab with the invitation link over it. A new group opens on its
  profile.
- `card-head.ts` (both cards): student actions message, payment and new lesson (`tb-lesson-dialog
  [studentId]`: who fixed, default title and length); a deactivated student keeps only payment.
  Group actions message (hidden without members), new lesson, archive; an archived group has none. A
  payment or lesson made here re-reads the balance and the lessons.

## Student tabs (`card-tabs.ts`, `CARD_TABS`, `?tab=`)

`/teacher/billing/students/:studentId` redirects to `?tab=payments`.

- **Lessons** (`schedule/teacher/student-lessons-tab.ts`): upcoming (`GET …/upcoming`) shows a
  series as one row with its rule and range, exceptions as rows of their own, and can expand to
  every date of 180 days; history (`GET …/history`, pages of 20) shows the shared summary and the
  old read-only private note. A group lesson shows the student's own attendance.
- **Tags** (`StudentTagsTab`, always present): a list tag saves on choosing, a free-text tag (max
  120) on blur or Enter, blank clears. The whole set goes in one `PUT …/tags`; a failure restores
  the old value. «What the AI will see» lists the AI tags the student has.
- **Profile** (`student-profile-tab.ts`): the price card is the one place to change a student's
  price; the video room saves at once. *Ours* (**M3** has no in-place edit pattern): fields stay
  editable instead of a read view with a pencil.

## Group tabs (`GROUP_TABS`)

The lessons feed without private notes; assignments of every member; members (removal saved at
once); profile without a video room for an archived group.
