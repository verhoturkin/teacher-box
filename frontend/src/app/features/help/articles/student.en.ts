import { HelpArticleText } from '../help.models';
import { StudentTopic } from '../help-topics';

/** English help, written for students alongside the Russian edition. */
export const STUDENT_ARTICLES: Readonly<Record<StudentTopic, HelpArticleText>> = {
  login: {
    title: 'Sign-in, password and profile',
    summary: 'Set up your account, reset your password and update your profile',
    body: `
## Set up your account

Your teacher will send you an invitation link. Open it and choose a username and password. You can then sign in to the portal with those details. If the invitation has expired or does not open, ask your teacher for a new link.

## Reset or change your password

If you have forgotten your password, ask your teacher for a password reset link.

To change a password you know, select your name at the bottom of the sidebar, then “Change password”. On a phone, open the ☰ menu to find your account.

## Update your photo and name

Select your name to open “My account”.

- **Photo:** choose “Upload photo” and select a JPEG, PNG or WebP image. The portal crops it to a square and resizes it. Your teacher sees it alongside your name throughout the portal. Use the bin button to remove it.
- **Name:** enter the display name you want to use in the portal. Your teacher will still see the name they entered for you. Leave this field blank and save to use that name again.
`,
  },
  schedule: {
    title: 'Schedule and rescheduling',
    summary: 'Find your lessons, request a new time or report an absence',
    body: `
“Schedule” shows your lessons in a week or month view. On a phone it opens in agenda view: choose a day in the week strip to see its lessons. Tap a lesson to see its time, topic, boards and meeting link.

On a computer, upcoming lessons and “My requests” appear beside the calendar. On a phone, lesson details open in a panel at the bottom of the screen.

## Request a change

Choose “Reschedule” or “Cancel” beside the lesson. To reschedule, suggest a new date and time. You can also include a message for your teacher.

Times when your teacher is unavailable are marked “Busy”. Choose a free time; the portal will tell you if your suggested time is unavailable.

Your teacher will receive the request and you will be notified of their response. Check its status in “My requests”. Until your teacher responds, you can withdraw it with “Withdraw” or “Withdraw request”.

A late cancellation may be charged as a missed lesson. A request for a recurring lesson applies only to the date you selected.

## Group lessons

If you cannot attend a group lesson, choose “I can’t attend”. Let your teacher know in advance so you will not be charged for your absence.

## Lesson summaries

When your teacher sends a summary, you will receive a “Lesson summary” notification. Open the lesson and read “What we covered”. Completed lessons are also listed in “Lesson history” on the Schedule page. You can turn off summary notifications in “My account”.

## Add lessons to your own calendar

In “Calendar subscription”, choose “Get subscription link” and add the link to your calendar as a subscription. Lessons will update automatically. You can also get the link through a [messaging bot](/cabinet/help/bot).
`,
  },
  lesson: {
    title: 'Lessons and boards',
    summary: 'Join a lesson, use the call controls and open shared boards',
    body: `
## Join a lesson

Choose “Join lesson” on your home page or in the schedule. Your next lesson appears first on the home page, with its date, start time and duration. Shortly before it starts, the card shows a countdown; during the lesson, it shows the time remaining. Once a lesson has started, you cannot request to reschedule or cancel it.

For a portal call, check your camera and microphone in the preview, allow browser access when prompted, then choose “Join”. During the call you can:

- turn your microphone and camera on or off;
- drag your camera preview to another corner;
- choose “Minimise” to keep talking while you use a board or work on an assignment;
- choose “Expand” to return to the full call window;
- choose “Leave call” to leave.

If your teacher uses an external video service, such as Telemost, the lesson link opens that service in a new tab.

## Open a board

Open “Materials” → “Boards” to see boards shared with you or your group. Search by title or filter by “All”, “In the portal” or “External”. The next lesson card also links directly to its boards.

An **Excalidraw board** opens in the portal. You and your teacher can draw together and see each other’s cursors. Changes are saved automatically. The status at the top shows “Saved”, “Saving…” or “Offline — reconnecting…”. Images appear as they load, so you can start drawing straight away.

The board menu (☰) contains the theme, grid and mouse-wheel settings. Choose “Zoom” or “Scroll (touchpad)” to suit your device. Use “Back” to return to where you opened the board, or “Back to boards” if you followed a direct link. These actions are also in the board menu.

To save reusable shapes, select them, right-click and choose “Add to library”. Open your library with the button at the top right.

An **external board**, such as Holst, opens in a new tab. The bot also provides “Join lesson” and “My boards” links.
`,
  },
  homework: {
    title: 'Homework',
    summary: 'Read assignments, submit your work and respond to feedback',
    body: `
## Find an assignment

Open “Homework”. On a computer, the list is on the left and the selected assignment opens on the right. On a phone, select an assignment to open it, then use the back arrow to return to the list.

Use the search field to find an assignment by title. The three filters show:

- **To hand in:** new assignments and work returned for revision;
- **In review:** work you have submitted to your teacher;
- **Done:** assignments your teacher has accepted.

Each entry shows the title, due date and status. Overdue assignments are marked in red. The number on the Homework menu icon counts assignments you still need to submit. You will receive a reminder before a deadline.

Your home page also lists outstanding assignments under “To hand in”, with the nearest deadline first. Choose “Revise” for returned work. Recent feedback appears under “Reviewed recently”.

## Videos and textbooks

Videos play within the assignment when supported; other links open in a new tab. If your teacher has shared a transcript, choose “Transcript” below the video.

Attached textbooks appear under “Textbooks”, with the relevant page numbers. Select a title to open it or use the download button to save the assigned pages.

## Submit your work

1. Open the assignment.
2. Write your response and attach any files, such as photos or documents. The portal checks the file type and size when you select them.
3. Choose “Submit for review”.

Your teacher can accept the submission, add a grade and feedback, or return it for revision. If revisions are requested, make the changes and submit again.

## Take a quiz

If an assignment includes a quiz, choose “Start the quiz”. Questions may ask you to select answers, enter text or a number, match pairs, or put items in order. Use the arrow buttons for ordering questions; an order that is already correct can be left as it is.

On a phone, use “Back” and “Next” to move between questions. Answers are saved automatically. When you finish, choose “Submit the quiz” and confirm. You cannot change that attempt afterwards.

Your score appears immediately. Depending on your teacher’s settings, correct answers and explanations appear immediately, after the due date, or are not shown. If more attempts are allowed, choose “Try again”. Your best score counts.

When you are ready, choose “Submit for review” so your teacher can review your work and quiz result.

## Work on a board

If your teacher has added an assignment to a board, choose “Go to board” at the top of the assignment. Its text and textbook pages will already be there. Submit your response on the assignment page as text or a file.
`,
  },
  textbooks: {
    title: 'Textbooks',
    summary: 'Open and download textbooks and workbooks shared by your teacher',
    body: `
Open “Materials” → “Textbooks” to find textbooks, workbooks and other resources shared with you or your group. Each card shows a cover and title. Group resources also show the group’s name.

Search by title or use “All”, “Textbooks”, “Workbooks” and “Other” to filter the list.

Select a title to open the file in a new tab. Word documents download instead. Use the download button to save a copy.

A textbook disappears from this list if your teacher stops sharing it with you or you leave the group it was shared with.
`,
  },
  billing: {
    title: 'Payments',
    summary: 'Check your balance, lesson price and payment history',
    body: `
“Payments” shows your balance, lesson price and transaction history. Filter the history to see all transactions, payments only or lesson charges only.

- **Credit** is money you have paid towards future lessons.
- **Outstanding balance** is the amount still to pay for past lessons.
- **History** lists lesson charges and recorded payments, with dates and amounts. The latest 20 entries appear first; choose “Show more” for older entries.

A lesson is charged when your teacher marks it completed or missed without notice. Your teacher records payments after receiving them.

If a payment has a receipt, use its receipt button to open it. HEIC images download instead of opening in the browser.

Contact your teacher if a payment or charge does not look right.
`,
  },
  bot: {
    title: 'Messaging bots',
    summary: 'Get notifications and manage lessons through Telegram, VK or MAX',
    body: `
## Notifications in the portal

The bell at the top of the page opens your notifications. Its badge shows how many are unread. New notifications appear first; read notifications are grouped under “Read”. Open that group to see them.

Open a notification, mark it as read, or choose “Mark all as read”. On a phone, swipe a notification left or right to mark it as read.

## Connect a messaging app

Select your name → “Messengers” → “Connect” beside the app you use. You can also use the connection card on your home page. Open the bot chat and press “Start”, or send the code shown in the portal.

The bot uses your account language. Notifications include an “Open” button for the relevant portal page or a “Join” button for a lesson. If the messaging app cannot display a link button, the link appears as text.

## Use the bot

Send /menu to see the available actions:

- **Schedule:** upcoming lessons and meeting links;
- **Join lesson** and **My boards:** quick links;
- **Cancel a lesson** and **Reschedule a lesson:** send a request to your teacher, or report that you cannot attend a group lesson;
- **My requests:** pending requests, which you can withdraw, and resolved requests;
- **Payments:** your balance and recent payments.

The bot asks for confirmation before sending a request. Choose “Cancel” or send /cancel to stop an action. Enter times as 18:30 and dates as 05.10.

## Device notifications

You can receive lesson reminders, new assignments and teacher messages on your phone or computer even when the portal is closed. You can use these alongside messaging app notifications.

Select your name → “Device notifications” → “Turn on notifications on this device”, then allow notifications in your browser. Enable them separately on each device and browser. Choose “Turn off” in the device list to remove one.

On iPhone and iPad, first add the portal to your Home Screen using Share → Add to Home Screen, then open it from that icon. Device notifications require HTTPS. The portal explains if your browser does not support them.

Notifications pass through Google, Mozilla or Apple services. Their content is encrypted with your device’s key, so those services cannot read it. Your notification topics and quiet hours apply to both device and messaging app notifications.

## Turn notifications off

Send /stop to the bot or disconnect the app in “My account”. You can also choose notification topics and quiet hours there.
`,
  },
  appearance: {
    title: 'Mobile use, theme and language',
    summary: 'Use the portal on your phone and choose your theme and language',
    body: `
## Use the portal on your phone

The portal works in your phone’s browser. To give it its own app icon in Chrome on Android, open the browser menu (⋮) → “Add to Home screen” → “Install”. It will open in a separate window.

The bottom bar contains “Home”, “Schedule”, “Homework”, “Materials” and “Payments”. Open ☰ at the top left for Help and your account. On a computer, these sections are in the sidebar.

Your home page starts with your next lesson and “Join lesson”. Below it you will find assignments to submit, recent feedback, your lesson credit and materials. On wider screens these appear in two columns.

Select a list entry to open its details. Forms with several fields open full screen, with the main action at the top right. If you close a form with unsaved changes, choose “Discard” to lose them or “Cancel” to keep editing.

Errors appear below the relevant field. If a section fails to load, choose “Retry”. You can also use a keyboard: Tab moves between controls and Esc closes dialogs and panels.

## Choose a theme

Select your name → “Appearance”, then choose “Light”, “Dark” or “System”. Your choice is saved on this device.

## Choose a language

In the same Appearance section, choose “Русский” or “English”. You can also choose a language below the sign-in or invitation card before signing in.

Your choice is saved on the device and in your account. New notifications, bot replies and calendar subscriptions use that language. Your teacher’s messages and lesson content remain as they wrote them.
`,
  },
};
