import { HelpArticleText } from '@features/help/help.models';

export const diagnosticsArticle: HelpArticleText = {
  title: 'Logs and diagnostics',
  summary: 'Check server health, investigate errors and collect diagnostic information',
  body: `
Administrators manage the server and integrations. They can inspect logs and collect diagnostics, but cannot view student records.

## Find the right section

- **Status:** service health, pending events, version, uptime, memory, disk space, latest backup and portal address. “Collect diagnostics” downloads \
an archive for a developer with logs, redacted settings and system information.
- **Log:** switch between “Logs”, “Events” and “Errors”. Select an entry to see its request code and error details. With no entry selected, you can \
temporarily enable more detailed logging for a section.
- **Integrations:** check messaging apps, AI, the LiveKit call server and other connected services. This section also contains AI settings.
- **Backups:** create and restore [backups](/admin/help/backups).
- **Settings:** manage [portal settings](/admin/help/settings) without editing .env.

On a computer, use the sidebar; on a phone, use the bottom navigation bar. Help is at the bottom of the sidebar or under ☰ on a phone. Select your \
name to open “My account”, choose a theme or language, or sign out.

## Investigate a problem

1. Open “Integrations” and run a connection check.
2. Search the log around the time of the problem.
3. In “Status”, choose “Collect diagnostics” and send the archive to the developer with the error code and steps to reproduce it.

## Server commands

If the installer was used, the server provides the following commands:

- \`sudo teacherbox status\` — show the running version and service status;
- \`sudo teacherbox logs backend\` — view backend logs, including when the portal will not open;
- \`sudo teacherbox update\` — install an update while keeping data and settings;
- \`sudo teacherbox backups\` — copy backups to a server directory;
- \`sudo teacherbox reset\` — delete the database, files, server backups and accounts, then start a fresh installation. Settings in .env are kept.

The bundled Caddy service obtains an HTTPS certificate for TEACHERBOX_DOMAIN automatically. If it cannot, check that the domain points to the server \
and ports 80 and 443 are open. View its logs with \`sudo teacherbox logs caddy\`.
`,
};
