import { HelpArticleText } from '@features/help/help.models';

export const notificationsArticle: HelpArticleText = {
  title: 'Notifications',
  summary: 'The bell, one inbox for all children, categories and messengers',
  body: `
## The bell and the inbox

The bell at the top is the inbox for all your children at once. Each notification starts with the child’s name (“Petya · Lesson moved”); choose it to open the right page for that child.

## What to receive

“My account” → “Notifications”. There are four categories, all on by default:

- **Payments and balance**: lesson charges, payments and their reversal;
- **Lessons**: reminders, new, moved and cancelled lessons, replies to requests;
- **Homework deadlines**: work due soon and the teacher’s reminders about work not handed in;
- **Marked work**: the teacher has marked your child’s work.

A category that is off reaches neither the portal nor messengers.

## Quiet hours, messengers and this device

On the same page choose quiet hours, when notifications wait until later, connect Telegram, VK or MAX, and turn on notifications on this device. The bot: [Messaging bot](/guardian/help/bot).
`,
};
