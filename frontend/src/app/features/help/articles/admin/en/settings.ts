import { HelpArticleText } from '@features/help/help.models';

export const settingsArticle: HelpArticleText = {
  title: 'Portal settings',
  summary: 'Files, proxies, sign-in and backups, with no restart',
  body: `
“Settings” is laid out in cards: “Homework files”, “Network and proxies”, “Sign-in and sessions”, “Messages” and “Backups”. Each value shows its \
source: the default, .env or a value saved here.

## Apply changes

1. Edit the values you need. Changed fields are marked.
2. Choose “Save” and enter your administrator password.
3. Most settings take effect straight away. If a field says “Takes effect after the portal restarts”, the portal restarts on its own and is \
unavailable to everyone for about a minute.

Values saved here override .env. Choose “Use .env value” to remove an override.

Portal and board backups run once a day. Use the switch to turn a backup on or off and pick its time, in the teacher’s time zone. If .env sets a \
different cron schedule, it is shown as it is and you can still change it.

New sign-in and lockout limits apply from the next sign-in; open sessions carry on.

## Settings only in .env

The “Only in .env” card shows the current values of settings you cannot change here: the domain, port and container resources, video calls, accounts, \
the access token secret, logging and the restart after a restore. Passwords and secrets are never shown, only whether they are set. To change one, \
run sudo teacherbox config on the server: it opens .env, and the portal restarts with the new values once you save. If one of these settings was \
saved in the portal earlier, choose “Remove saved value” to go back to the .env value.

## Moved to the teacher’s settings

The time zone, currency, lesson rules, portal address, bots and Google connections are now set by the teacher in their own “Settings”. If .env still \
contains their variables, the page lists them at the top. Their values have already been moved, so you can delete those lines from .env.

## If the portal will not start

A setting may be preventing startup. On the server, open config/settings.properties in the data directory, correct or remove the relevant entry, then \
restart the container. Setting changes are recorded in the log by setting name.
`,
};
