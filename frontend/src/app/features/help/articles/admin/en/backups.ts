import { HelpArticleText } from '@features/help/help.models';

export const backupsArticle: HelpArticleText = {
  title: 'Backups and portal address',
  summary: 'Create and restore backups, and check the portal’s public address',
  body: `
## Backups

Open “Backups” to view existing backups, choose “Back up now” or restore a backup. Only the teacher can download backups because they contain student \
data. The teacher also manages the Google Drive connection.

Backups in Google Drive appear here too. Download one to the server before restoring it from the server list.

Retention is set in “Settings” → “Backups” → “Days to keep backups”, with a default of 14 days. After creating a new backup, the portal removes older \
backups of every kind from both the server and Google Drive.

## Restore a backup

1. Open the backup’s ⋮ menu and choose “Restore…”.
2. Enter your administrator password.
3. Keep the page open while the portal backs up its current state, restarts and restores the selected backup.

Let the teacher know before restoring: data added after the backup will be replaced. Afterwards, sign in with the password that was in use when the \
backup was created.

Automatic restart requires the container policy \`restart: unless-stopped\`, which is included in the portal’s Compose files. Outside Docker, \
restoration runs the next time the portal starts.

## Portal address

Find the public address in “Status” → “Portal address”. It is used for invitation links, bot messages, calendar subscriptions and Google and Yandex \
callback URLs. If TEACHERBOX_PUBLIC_URL sets the address, it is read-only in the portal.
`,
};
