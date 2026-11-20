import { HelpArticleText } from '@features/help/help.models';

export const botArticle: HelpArticleText = {
  title: 'Messaging bot',
  summary: 'Children’s schedule, balance, rescheduling and cancelling from a messenger',
  body: `
Connect Telegram, VK or MAX in “My account” → “Notifications” ([Notifications](/guardian/help/notifications)): the portal gives you a code to send to the bot.

The parent bot can:

- **“Children's lessons”**: the next lessons of each child;
- **“Balance”**: the balance and latest payments of each child, even if the teacher has hidden them from the student;
- **“Reschedule a lesson”** and **“Cancel a lesson”**: a request to the teacher, as in the cabinet ([Rescheduling and cancelling](/guardian/help/requests)).

With more than one child, the bot first asks which one. It asks you to confirm before any action. The teacher’s reply comes to the same chat.
`,
};
