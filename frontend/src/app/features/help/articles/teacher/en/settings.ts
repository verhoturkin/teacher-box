import { HelpArticleText } from '@features/help/help.models';

export const settingsArticle: HelpArticleText = {
  title: 'Settings',
  summary: 'Manage your portal, integrations, prices, AI and backups',
  body: `
Open Settings from the sidebar or the ☰ menu on a phone. Select a category to open it beside the list; on a phone, use the back arrow to return. Each \
category has its own address and can be bookmarked.

- **My account:** Profile (photo, name), Sign-in (username, password, sign out), Appearance (theme and language) and Notifications (where and what to \
send, quiet hours). Changes save immediately. You can also open it by selecting your name in navigation.
- **Portal:** name and logo, portal colour, and fine tuning (scheme, contrast) with a preview. See [Appearance](/teacher/help/appearance).
- **Lessons:** under “Time and price”, the time zone (used for lesson times, reminders and monthly reports; lessons already booked keep their time), \
the currency (fixed once the first charge or payment is recorded), and the length and price for new lessons, students and groups (see \
[Payments](/teacher/help/billing)). Under “Rules”, when a cancellation counts as late, up to three lesson reminders for students (“Add” to choose \
when, “×” to remove one), how many hours before a homework deadline to remind students, and how many weeks ahead to create repeating lessons. Each \
field saves as soon as you leave it or press Enter. Also [calls](/teacher/help/calls) and [external video meetings](/teacher/help/meetings), Google \
Calendar and the calendar subscription (see [Calendars](/teacher/help/calendars)).
- **Messengers:** bots, what the bot can do and students’ connections (for example, 5 of 7). Failed deliveries appear first when present; the \
administrator can retry them. See [Notifications and bots](/teacher/help/notifications).
- **AI assistant:** connections and models, usage by model and the limit, recent requests, my prompts and system prompts. See [AI \
assistant](/teacher/help/ai).
- **Data:** scheduled and manual backups, downloads, restoration, Google Drive storage, and the danger zone for restoring a backup or clearing the \
portal. See [Backups](/teacher/help/backups).

Settings save as soon as you change a field or switch. The exception is Portal: a row with Discard and Save appears under the colour choice, and the \
portal asks before you leave with unsaved changes. File size and type are checked as soon as you select a file.

The portal address is entered during initial setup. Contact the administrator to change it later.
`,
};
