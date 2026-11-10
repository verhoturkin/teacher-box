import { HelpArticleText } from '@features/help/help.models';

export const botArticle: HelpArticleText = {
  title: 'Messaging bots',
  summary: 'Get notifications and manage lessons through Telegram, VK or MAX',
  body: `
## Notifications in the portal

The bell at the top of the page opens your notifications. Its badge shows how many are unread. New notifications appear first; read notifications are \
grouped under “Read”. Open that group to see them.

Open a notification, mark it as read, or choose “Mark all as read”. On a phone, swipe a notification left or right to mark it as read.

## Connect a messaging app

Select your name → “Notifications” → “Where to send” → “Connect” beside the app you use. You can also use the connection card on your home page. Open \
the bot chat and press “Start”, or send the code shown in the portal.

The bot uses your account language. Notifications include an “Open” button for the relevant portal page or a “Join” button for a lesson. If the \
messaging app cannot display a link button, the link appears as text.

## Use the bot

Send /menu to see the available actions:

- **Schedule:** upcoming lessons and meeting links;
- **Join lesson** and **My boards:** quick links;
- **Cancel a lesson** and **Reschedule a lesson:** send a request to your teacher, or report that you cannot attend a group lesson;
- **My requests:** pending requests, which you can withdraw, and resolved requests;
- **Payments:** your balance and recent payments.

The bot asks for confirmation before sending a request. Choose “Cancel” or send /cancel to stop an action. Enter times as 18:30 and dates as 05.10.

## Device notifications

You can receive lesson reminders, new assignments and teacher messages on your phone or computer even when the portal is closed. You can use these \
alongside messaging app notifications.

Select your name → “Notifications” → “Where to send” → “This device” → “Connect”, then allow notifications in your browser. Enable them separately on \
each device and browser. Turn a device’s switch off to remove it.

On iPhone and iPad, first add the portal to your Home Screen using Share → Add to Home Screen, then open it from that icon. Device notifications \
require HTTPS. The portal explains if your browser does not support them.

Notifications pass through Google, Mozilla or Apple services. Their content is encrypted with your device’s key, so those services cannot read it. \
Your notification topics and quiet hours apply to both device and messaging app notifications.

## Turn notifications off

Send /stop to the bot or disconnect the app in “My account”. You can also choose notification topics (“What to send”) and quiet hours there; changes \
save immediately.
`,
};
