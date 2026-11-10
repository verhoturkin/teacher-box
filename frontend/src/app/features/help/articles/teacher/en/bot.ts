import { HelpArticleText } from '@features/help/help.models';

export const botArticle: HelpArticleText = {
  title: 'What the bot can do',
  summary: 'Record payments, manage lessons and respond to requests from a chat',
  body: `
Send /menu to see the available actions. The bot uses your account language.

## Teacher actions

- **Today:** view today’s lessons and record outcomes for lessons that have started. For a group, record attendance.
- **Attendance to record:** find past lessons without an outcome.
- **Requests:** approve or decline student requests and include a reply. Request notifications also have action buttons.
- **Record a payment:** choose a student and an amount. Shortcuts cover one, four or eight lessons at their price; you can enter any amount.
- **Receipts:** send an image or PDF up to 10 MB. The bot asks for the student and amount, then attaches it to the payment.
- **Add a lesson:** record a completed individual or group lesson that was not in the schedule.

## Student actions

Students can view their schedule, join a lesson, open boards, request a cancellation or reschedule, report a group absence, check requests and view \
payments.

## Using the bot

The bot asks for confirmation before changing data. Choose “Cancel” or send /cancel to stop at any point. Search for students using part of their \
name. Enter times as 18:30 and dates as 05.10.

Notification buttons open the relevant portal page or lesson. Where link buttons are unavailable, the bot sends a text link instead.

## Disable teacher actions

If someone else can access your messaging account, turn off “Teacher actions in the bot” under “My account” → “Notifications”. You will still receive \
notifications.

VK communities need “Bot features” enabled for buttons to work.
`,
};
