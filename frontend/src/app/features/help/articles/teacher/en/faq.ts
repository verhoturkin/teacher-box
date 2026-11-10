import { HelpArticleText } from '@features/help/help.models';

export const faqArticle: HelpArticleText = {
  title: 'Frequently asked questions',
  summary: 'Quick answers to common sign-in, payment and scheduling questions',
  body: `
**A student cannot open their invitation.**
Check the public portal address. It must be reachable over the internet, not just on your home network. Contact the administrator if it needs \
changing.

**The invitation has expired.**
Open the student’s Profile tab and create a new invitation. The old link stops working.

**A student cannot sign in.**
Check that the account is active. If needed, send a reset link from “Students” → the student → “Profile” → “Reset password”.

**How do I recover something deleted by mistake?**
Restore a [backup](/teacher/help/backups) from “Settings” → “Data” → “Backups”.

**Messaging app notifications are not arriving.**
Check the bot connection under “Settings” → “Messengers”. The student must also connect their own messaging account. Check the failed deliveries \
block for rejected messages.

**I recorded the wrong lesson outcome.**
Open the lesson and select the active outcome again to clear it and reverse the charge. For a group, use “Clear outcome” in the ⋮ menu.

**A student paid, but still has an outstanding balance.**
Check that the payment was recorded for the correct student and amount. Open their Payments tab and review the history.

**How do I reschedule all recurring lessons?**
Open a lesson, choose Edit and “This and future lessons”, then change the date and time. Choose Once to stop repetition: the selected lesson stays \
and untouched later occurrences are removed. Completed, charged and individually edited lessons are preserved.

**How do I download all my data?**
Choose “Settings” → “Data” → “Backups” → “Back up now”, then download the backup.
`,
};
