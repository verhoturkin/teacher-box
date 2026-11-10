import { HelpArticleText } from '../help.models';
import { AdminTopic } from '../help-topics';

/** English help, written for administrators alongside the Russian edition. */
export const ADMIN_ARTICLES: Readonly<Record<AdminTopic, HelpArticleText>> = {
  diagnostics: {
    title: 'Logs and diagnostics',
    summary: 'Check server health, investigate errors and collect diagnostic information',
    body: `
Administrators manage the server and integrations. They can inspect logs and collect diagnostics, but cannot view student records.

## Find the right section

- **Status:** service health, pending events, version, uptime, memory, disk space, latest backup and portal address. “Collect diagnostics” downloads an archive for a developer with logs, redacted settings and system information.
- **Log:** switch between “Logs”, “Events” and “Errors”. Select an entry to see its request code and error details. With no entry selected, you can temporarily enable more detailed logging for a section.
- **Integrations:** check messaging apps, AI, the LiveKit call server and other connected services. This section also contains AI settings.
- **Backups:** create and restore [backups](/admin/help/backups).
- **Settings:** manage [portal settings](/admin/help/settings) without editing .env.

On a computer, use the sidebar; on a phone, use the bottom navigation bar. Help is at the bottom of the sidebar or under ☰ on a phone. Select your name to open “My account”, choose a theme or language, or sign out.

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

The bundled Caddy service obtains an HTTPS certificate for TEACHERBOX_DOMAIN automatically. If it cannot, check that the domain points to the server and ports 80 and 443 are open. View its logs with \`sudo teacherbox logs caddy\`.
`,
  },
  backups: {
    title: 'Backups and portal address',
    summary: 'Create and restore backups, and check the portal’s public address',
    body: `
## Backups

Open “Backups” to view existing backups, choose “Back up now” or restore a backup. Only the teacher can download backups because they contain student data. The teacher also manages the Google Drive connection.

Backups in Google Drive appear here too. Download one to the server before restoring it from the server list.

Retention is set in “Settings” → “Backups” → “Days to keep backups”, with a default of 14 days. After creating a new backup, the portal removes older backups of every kind from both the server and Google Drive.

## Restore a backup

1. Open the backup’s ⋮ menu and choose “Restore…”.
2. Enter your administrator password.
3. Keep the page open while the portal backs up its current state, restarts and restores the selected backup.

Let the teacher know before restoring: data added after the backup will be replaced. Afterwards, sign in with the password that was in use when the backup was created.

Automatic restart requires the container policy \`restart: unless-stopped\`, which is included in the portal’s Compose files. Outside Docker, restoration runs the next time the portal starts.

## Portal address

Find the public address in “Status” → “Portal address”. It is used for invitation links, bot messages, calendar subscriptions and Google and Yandex callback URLs. If TEACHERBOX_PUBLIC_URL sets the address, it is read-only in the portal.
`,
  },
  settings: {
    title: 'Portal settings',
    summary: 'Files, proxies, sign-in and backups, with no restart',
    body: `
“Settings” is laid out in cards: “Homework files”, “Network and proxies”, “Sign-in and sessions”, “Messages” and “Backups”. Each value shows its source: the default, .env or a value saved here.

## Apply changes

1. Edit the values you need. Changed fields are marked.
2. Choose “Save” and enter your administrator password.
3. Most settings take effect straight away. If a field says “Takes effect after the portal restarts”, the portal restarts on its own and is unavailable to everyone for about a minute.

Values saved here override .env. Choose “Use .env value” to remove an override.

Portal and board backups run once a day. Use the switch to turn a backup on or off and pick its time, in the teacher’s time zone. If .env sets a different cron schedule, it is shown as it is and you can still change it.

New sign-in and lockout limits apply from the next sign-in; open sessions carry on.

## Settings only in .env

The “Only in .env” card shows the current values of settings you cannot change here: the domain, port and container resources, video calls, accounts, the access token secret, logging and the restart after a restore. Passwords and secrets are never shown, only whether they are set. To change one, run sudo teacherbox config on the server: it opens .env, and the portal restarts with the new values once you save. If one of these settings was saved in the portal earlier, choose “Remove saved value” to go back to the .env value.

## Moved to the teacher’s settings

The time zone, currency, lesson rules, portal address, bots and Google connections are now set by the teacher in their own “Settings”. If .env still contains their variables, the page lists them at the top. Their values have already been moved, so you can delete those lines from .env.

## If the portal will not start

A setting may be preventing startup. On the server, open config/settings.properties in the data directory, correct or remove the relevant entry, then restart the container. Setting changes are recorded in the log by setting name.
`,
  },
};
