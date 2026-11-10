import { HelpArticleText } from '@features/help/help.models';

export const notificationsArticle: HelpArticleText = {
  title: 'Notifications and bots',
  summary: 'Read notifications, connect messaging apps and message students',
  body: `
The bell at the top of the page opens notifications. Its badge counts unread items. On wide screens the panel stays beside your work while you move \
between pages; on smaller screens it opens over the page.

## Inbox and sent messages

- **Inbox:** new notifications appear first. Opening one or marking it as read moves it to the expandable Read group. Choose “Mark all as read” to \
clear the unread list. On a phone, swipe an item left or right to mark it as read.
- **Sent:** messages you have sent to students, with the date and recipient count. Choose “Message students” to write another.

Close the panel with ×, Esc or the bell. On smaller screens it also closes when a notification opens another page. Existing links to Notifications \
open this panel.

## Connect messaging apps

Open “Settings” → “Messengers” → “Bots” and choose “Connect” beside Telegram, VK or MAX. The wizard walks you through creating a bot, checks the \
connection and sends a test message.

Choose the app your students use; one is enough. Students connect their own accounts under “My account”. The “Students” block in “Settings” → \
“Messengers” shows how many have connected (for example, 5 of 7), who has not and any failed deliveries; “Who uses what” opens the student list. \
“Send link” reminds a student who has not connected. Each student’s messengers are also on their details page.

## Message students

Choose “Message all” on the Students page, “Create” → “Message”, or open the bell → “Sent” → “Message students”. Write your message and choose all \
students, individual students or groups. The message form opens over your current page and the result appears in Sent.

## Notification preferences

All notifications appear in the portal. Under “My account” → “Notifications” → “What to send”, choose which topics also reach your devices and \
messaging apps and set “Quiet hours” (From and To). During quiet hours, those deliveries wait until they end. Changes save immediately.

New server notifications and bot replies use each recipient’s account language. Existing notifications keep their original text.

## Device notifications

Under “My account” → “Notifications” → “Where to send”, choose “Connect” on the “This device” row and allow browser notifications. Enable this \
separately on each device and browser. These notifications work even when the portal is closed and can be used alongside messaging apps. Turning a \
device’s switch off removes it.

On iPhone and iPad, add the portal to the Home Screen first using Share → Add to Home Screen, then open it from that icon. HTTPS and a supported \
browser are required. The portal explains when notifications are unavailable.

Delivery uses Google, Mozilla or Apple services, with content encrypted using the device key. Your topic preferences and quiet hours apply to both \
device and messaging app notifications.

The bot also supports [actions from the chat](/teacher/help/bot).
`,
};
