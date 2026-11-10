# Admin

Shell `core/layout/admin-layout.ts` (`ADMIN_MENU`); pages in `features/admin/`. `/admin` → status;
`/admin/events` → the journal's events (`?view=events`); `/admin/diagnostics` → status. The admin
sees IDs and technical data only (AGENTS.md §4.3).

- **Status** (`status/status-page.ts`): a feed of tiles in a fixed order — services, event queue,
  diagnostics | system, resources, last backup, portal address; two columns from expanded. The queue
  tile counts pending events and failed deliveries and links to the journal.
- **Journal** (`logs/journal-page.ts`): logs / events / errors as chips (`?view=`). Logs and errors
  are list-detail (with nothing open — the temporary log levels, `logger-levels-panel.ts`); events
  (`events/events-panel.ts`) is a wide page with resubmit of stuck events.
- **Integrations** (`/admin/integrations[/:section]`, `integrations/integrations-page.ts`):
  list-detail with `tb-pane-nav`; `?open=<section>` redirects.
- **Portal settings** (`/admin/settings`, `settings/settings-page.ts`, board 18 `AdminLive`; old
  `/admin/settings/:section` and `?open=` open it): one pane with one save. A warning lists the
  teacher's variables still set in `.env` («moved to the teacher's settings») and another one values
  waiting for a restart. A card grid — a named exception to one column (ADR-0021):
  `tb-section-card--flow` cards in three columns from expanded in a fixed order (files, network and
  proxy | sign-in, messages, other editable settings | backups, «.env only»). Short kinds (numbers,
  durations, sizes, yes/no) go two in a row. Each field shows its source, whether it differs and a
  reset to the `.env` value, and a note when it applies only after a restart. A daily backup cron is
  a switch with a time picker; any other cron stays text. «.env only» lists read-only values
  (secrets only as set / not set), offers to remove a value saved before it became read-only, and
  points to `sudo teacherbox config`. Saving asks the password; live-only edits end with a snackbar,
  others with the restart dialog.
- **Backups** (`backups/backups-page.ts`): the teacher's backups section in a pane.
