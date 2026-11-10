import { HelpArticleText } from '@features/help/help.models';

export const backupsArticle: HelpArticleText = {
  title: 'Backups and full reset',
  summary: 'Protect your data, restore a backup or clear the portal',
  body: `
The portal backs up its database and files every night, including students, lessons, payments, assignments and current board content. Individual \
board backups are excluded: after restoring a portal backup, each board has only its saved current content.

## Create and download a backup

Open “Settings” → “Data” → “Backups” and choose “Back up now”. Use a backup’s ⋮ menu → “Download” to keep a copy away from the server.

Each entry shows its date, type, size and Google Drive status. Scheduled, manual, pre-restore and pre-reset backups are all subject to the retention \
period. The default is two weeks; the administrator can change it. Older backups are removed after a new one is created.

## Connect Google Drive

Open “Settings” → “Data” → “Google Drive”. Set up a Google OAuth client once; the panel includes instructions and your redirect URL.

1. In [Google Cloud Console](https://console.cloud.google.com/), create and select a project using the account that will store the backups.
2. Under “APIs & Services” → “Library”, enable Google Drive API.
3. Open “Google Auth Platform” → “Get started”. Enter the app name, support email and contact email, choose an External audience, accept the policy \
and create the configuration.
4. Under “Data Access”, add the .../auth/drive.file scope and save.
5. Under “Audience”, publish the app. Otherwise access expires after seven days. This scope does not require Google verification.
6. Under “Clients”, create a Web application client. Add the redirect URL from the portal under “Authorized redirect URIs”.
7. Copy the Client ID and Client secret into the portal’s Google Drive panel and save. The secret is shown only once.

Choose “Connect Google Drive” and grant access. The portal creates a folder named after your portal and uploads scheduled and manual backups. It can \
access only files it creates. Retention matches the server; pre-restore and pre-reset backups remain on the server only.

Use “Send to Google Drive” in a backup’s menu to upload it manually. The Drive panel shows the latest upload and any error.

If the server is lost, install the portal again, connect the same Drive account and choose “Download to server” beside a cloud backup. Once it \
appears in the server list, restore it.

## Restore a backup

1. Open its ⋮ menu and choose “Restore…”.
2. Read the warning: the backup replaces all current portal data.
3. Enter your password and confirm.

The portal creates a backup of its current state, restarts and shows the result after about a minute. Keep the page open. Afterwards, sign in with \
the password in use when the restored backup was created. If restoration fails, the current data is kept and an error explains why.

## Full reset

“Settings” → “Data” → “Danger zone” → “Clear the portal” removes students, groups, lessons, payments, assignments, notifications, connections and \
portal details. Teacher and administrator accounts, their passwords, existing backups and the backup connection to Google Drive are kept.

Choose “Clear…”, then enter your password and RESET. A backup is created first, so you can recover the data if needed. Initial setup opens again \
afterwards.

If asked to remove a leftover Google Calendar, delete the portal calendar in Google Calendar manually.
`,
};
