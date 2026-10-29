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
    summary: 'Change server settings from the portal and apply them with a restart',
    body: `
“Settings” groups the settings from .env by section. Each value shows its source: the default, .env or a value saved here. Choose a section on the left to edit it on the right. On a phone, open a section and use the back arrow to return to the list.

The number beside a section shows its unsaved changes. Changes across all sections are saved together.

## Apply changes

1. Edit the values you need. Changed fields are marked. For a time zone, search for a city such as Moscow.
2. Choose “Save and restart” and enter your administrator password.
3. Wait for the portal to restart. It will be unavailable to everyone for about a minute.

Values saved here override .env. Choose “Use .env value” to remove an override. Setting labels, hints, validation messages and integration check results use your interface language.

## Set up AI

In “AI assistant”, choose a provider and enter its API key. For OpenRouter, use a key from openrouter.ai. The API URL is preset; leave the model blank for automatic selection or enter a model ID from openrouter.ai/models. For DeepSeek, use a key from platform.deepseek.com; the default model is deepseek-flash.

## Read-only and secret settings

Saved passwords, tokens and keys are hidden. Enter a new value to replace one. Docker settings, such as ports, domain, version and resource limits, must be changed in .env. Account details are managed in “My account”.

## If the portal will not start

A setting may be preventing startup. On the server, open config/settings.properties in the data directory, correct or remove the relevant entry, then restart the container. Setting changes are recorded in the log by setting name.
`,
  },
};
