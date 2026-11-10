# Notifications (the bell)

`core/notifications/` (`notification-bell.ts`, `notifications-sheet.ts`); the content comes from
`features/notifications/sheet/` through the `NOTIFICATIONS_SHEET_CONTENT` token (`app.config.ts`),
so `core/` imports no feature.

- **One sheet, two forms.** Extra-large: a **non-modal** standard side sheet as the third pane,
  starting below the top strip (*ours*); it takes focus on open, gives it back on close and stays
  open across pages. Below extra-large: the modal narrow `tb-side-sheet` (full width on compact,
  transparent scrim — *ours*), closed by a notification that leads elsewhere.
- **Scrolling:** only the tab content scrolls (*ours*); the sheet has no side padding, the tabs and
  the content carry the gutter, so the scrollbar sits at the sheet's edge. The tabs are
  `tb-tabs--fixed` at every width.
- **Tabs:** the teacher has Inbox and Sent; the student has the inbox only. Inbox: unread items
  (titles emphasized, no dots), «show more», then the folded read ones. Marking read is a tick on a
  computer and a swipe on a phone (no tick there). Sent: a line of explanation with the new-message
  dialog, then the sent messages.
- **Addresses:** `?notifications=inbox|sent` opens the sheet on any page and is dropped
  (`replaceUrl`); `/teacher/notifications` and `/cabinet/notifications` redirect to the home page
  with `?notifications=inbox`.
