import { HelpArticleText } from '../help.models';
import { AdminTopic } from '../help-topics';

/** Help articles in English (ADR-0035): plain words, steps to click and short answers. */
export const ADMIN_ARTICLES: Readonly<Record<AdminTopic, HelpArticleText>> = {
  diagnostics: {
    title: 'Log and diagnostics',
    summary: 'What the administrator can do and how to help with the server',
    body: `
Pane headings stay above scrolling content, while search and help text fill the available width.
Focus rings appear during keyboard use, not automatically when opening a dialog with the pointer.

The administrator helps with the server: reads the log, checks the integrations and collects data for the developer. The administrator does not see the students' data.

## Sections

- **Status** — tiles: the services, the event queue, the version and uptime, memory and disk space, the last backup, the portal address. The «Collect diagnostics» button at the top downloads an archive for the developer: the log and the settings without passwords and personal data.
- **Log** — three filters: «Logs» (the server's records; pick a record — the request code and the error details are on the right), «Events» (internal events of the portal; stuck ones can be resubmitted) and «Errors». With no record picked, detailed records can be turned on for a while for one section on the right.
- **Integrations** — the connection check of the messengers, the AI, the call server (LiveKit) and other external services, and the «AI assistant» section.
- **Backups** — [backups](/admin/help/backups): making and restoring them.
- **Settings** — [portal settings](/admin/help/settings) instead of the .env file.

The sections are in the panel on the left, «Help» at its bottom. On a phone all five sections are at the bottom of the screen, «Help» is under the ☰ button at the top left. «Account» at the bottom of the panel opens «My account»: the theme, the language and «Sign out» are there.

## If something broke

1. Open «Integrations» and click «Check».
2. Look through the «Log» for the time you need.
3. Click «Collect diagnostics» in «Status» and send the archive to the developer.

## On the server

If the portal was set up by the installer, the server has the \`teacherbox\` command:

- \`sudo teacherbox status\` — whether the portal runs and its version;
- \`sudo teacherbox logs backend\` — the log, if the portal does not open;
- \`sudo teacherbox update\` — update the portal to a new release (the data and the settings stay);
- \`sudo teacherbox backups\` — copy the backups to a folder on the server;
- \`sudo teacherbox reset\` — delete all data of the portal (the database, files, backups on the server, accounts) and start it as after a new installation; the settings in .env stay.

HTTPS comes from the built-in Caddy: it gets a certificate for the domain of the TEACHERBOX_DOMAIN setting by itself. If there is no certificate, check that the domain points to the server and ports 80 and 443 are open (\`sudo teacherbox logs caddy\`).
`,
  },
  backups: {
    title: 'Backups and portal address',
    summary: 'How the administrator makes and restores backups and changes the portal address',
    body: `
## Backups

The «Backups» section: the list of backups, «Back up now» and restoring. Only the teacher can download a backup — backups hold the students' data. The teacher connects Google Drive for backups. The «Backups» section also shows copies in Google Drive: bring a copy to the server, then restore it from the server list.

Backups are kept for as many days as «Settings» → «Backups» → «Days to keep backups» says (14 by default); the portal deletes older backups of every kind after making a new one, on the server and in Google Drive.

To restore a backup:

1. Click «⋮» in the backup's row → «Restore…».
2. Enter the administrator's password.
3. Wait for the result: the portal backs up its current state, restarts and restores the chosen backup.

After the restore, sign in with the password that was valid at the time of the backup. Warn the teacher: everything added after the backup is lost.

To restart, the container needs the \`restart: unless-stopped\` policy (the portal's compose files have it). Without Docker the backup is restored at the next start.

## Portal address

«Status» → the «Portal address» tile. All the portal's links start with it: invitations, bot messages, the calendar subscription, Google and Yandex return addresses. If the address is set by the TEACHERBOX_PUBLIC_URL variable, the portal only shows it.
`,
  },
  settings: {
    title: 'Portal settings',
    summary: 'How to change the .env settings in the interface',
    body: `
The «Settings» section shows all the portal's settings of the .env file by section: the value and where it comes from — «default», «from .env» or «set here». The sections are listed on the left and the chosen one is on the right (on a phone the list comes first and a section opens on its own page with a «back» button); the number next to a section's name is how many unsaved changes it has. The changes of all sections are saved together. On a computer, headings and «Save and restart» stay visible while the fields scroll.

## Change

1. Change the values — they are marked «changed». The time zone is chosen from a list: start typing a city, e.g. Moscow.
2. Click «Save and restart» and enter the administrator's password.
3. Wait until the portal restarts: it is unavailable to everyone for a minute.

Values set here take precedence over the .env file. «Back to .env» removes your value.

The names and hints of the settings and the results of the integration checks are shown in the language of the interface.

The AI assistant — the «AI assistant» section: choose the service and set the API key. For OpenRouter (openrouter) a key from openrouter.ai is enough: the address is preset, by default OpenRouter picks the model itself, and a specific one goes into «Model» by its name from openrouter.ai/models. For DeepSeek (deepseek) — a key from platform.deepseek.com, the default model is deepseek-flash.

Passwords, tokens and keys are not shown — they can only be set again. Docker settings (port, domain, version, limits) and the accounts are only shown here: the former are changed in .env, the latter in «My account».

The titles and descriptions of the settings come from the server in Russian.

## If the portal did not start

Most likely some value prevents the start. Open the file config/settings.properties in the data folder on the server, fix or delete the line and restart the container. All changes are written to the log with the names of the settings.
`,
  },
};
