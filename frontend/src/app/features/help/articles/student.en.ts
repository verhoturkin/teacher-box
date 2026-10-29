import { HelpArticleText } from '../help.models';
import { StudentTopic } from '../help-topics';

/** Help articles in English (ADR-0035): plain words, steps to click and short answers. */
export const STUDENT_ARTICLES: Readonly<Record<StudentTopic, HelpArticleText>> = {
  login: {
    title: 'Sign-in, password and profile',
    summary: 'How to sign in to the cabinet, change the password, the photo and the name',
    body: `
Pane headings stay above scrolling content, while search and help text fill the available width.
Focus rings appear during keyboard use, not automatically when opening a dialog with the pointer.

On a phone, the home page starts with the next lesson card; the briefing above it is hidden.

## First sign-in

The teacher sends an invitation link. Open it, choose a login and a password — and you are in your cabinet. After that, sign in on the sign-in page with this login and password.

## Forgot the password

Ask the teacher to send a password reset link. Set a new password with it.

## Change the password

The item with your name (at the bottom of the panel on the left, under ☰ on a phone) → «Change password».

If a link does not open or is out of date, ask the teacher to send a new one.

## Photo and name

The item with your name (at the bottom of the panel on the left, under ☰ on a phone): the photo is in the top card, the name in the «Name» card.

- **Photo** — «Upload photo» and choose a picture (JPEG, PNG or WebP). The portal cuts a square out of its centre and makes it smaller. You see the photo next to the item with your name, and the teacher sees it in the list of students, in payments, calls, the schedule and on the home page. The bin next to it removes the photo.
- **Name** — how the portal calls you in the cabinet. The teacher still sees you under the name they gave. Erase your name and save to go back to the teacher's name.
`,
  },
  schedule: {
    title: 'Schedule and moving',
    summary: 'Your lessons, cancelling and moving',
    body: `
Clicking a calendar lesson opens a centered window on a computer and a bottom sheet on a phone. It shows who teaches, the time, the topic, boards and the room; «Join lesson» is in the room row, «Move» and «Cancel» sit beside it. On a phone, upcoming lessons and calendar subscription use separate rounded sections.

«Schedule» shows a week or month calendar; today is marked by colour. On a computer, the mini calendar, upcoming lessons and «My requests» sit beside it. On a phone it opens with an agenda: a week strip and lessons of the selected day, with switches to week or month.

## Cancel or move a lesson

Next to the lesson click «Move» or «Cancel». On a phone, tap the lesson — a panel opens at the bottom with the buttons «Join lesson», «Move» and «Cancel». To move it, propose a convenient time. You can write a comment to the teacher.

In the calendar (week, month, list) the time when the teacher is busy or not working is greyed out with «Busy». Choose free time: a lesson cannot be moved to busy time, the portal tells you at once.

The teacher gets the request and answers — the answer comes as a notification, and its status is shown in «My requests». Until the teacher answers, the request can be withdrawn with «Withdraw» next to the lesson (on a phone — «Withdraw request» in the lesson's panel).

If you cancel late, the teacher may charge the lesson as missed.

Repeating lessons appear as individual occurrences. Your move or cancellation request concerns only the selected lesson.

## Lesson summary

When the teacher sends a summary, you get a «Lesson summary» notification. Read it in the lesson card («What we covered»); every held lesson is listed in «Lesson history» on the «Schedule» page. You can turn the notification topic off in «My account».

## Group lessons

If you cannot come to a group lesson, click «I won’t come». If you said so in advance, the teacher knows at once that you will not be there, and the lesson is not charged.

## Calendar on the phone

The «Calendar on the phone» card → «Get link» → add it to your phone's calendar as a subscription. The lessons appear there by themselves.

The same can be done through the bot in a messenger ([Bot](/cabinet/help/bot)).
`,
  },
  lesson: {
    title: 'Lesson and board',
    summary: 'How to join a call and open a board',
    body: `
On the home page, lesson material cards sit together with consistent gaps even on wide screens; on phones they wrap without horizontal scrolling.

## Join a lesson

Before the lesson click «Join lesson» — the next lesson is shown first on the home page, and the button is in the schedule too. The tile on the left of the card shows the day and the start time, an hour before the lesson — «in 25 min», and during the lesson — «Now» and how much is left (a running lesson can no longer be moved or cancelled).

The call runs right in the portal. A window opens before joining: check the camera and the microphone (the browser asks for permission — allow it) and click «Join». In the call you can turn the microphone or the camera off, drag the window with your camera to another corner, and «Minimize» keeps the call in a small window — open a board or homework and the talk goes on. «Leave the call» is the red button.

If the teacher has set a link to another video service (e.g. Telemost), the button opens it in a new tab.

## Boards

The boards the teacher opened to you or your group are in «Materials», the «Boards» tab: cards with the board's picture, the filters «All», «In the portal», «External» and a search by title. Tap a card to open the board. The boards of the next lesson are buttons right in its card on the home page: tap one to open it.

On both «Boards» and «Textbooks», search and filters share one row; on narrow screens they wrap and search fills the width. Cards keep a compact size even when the list contains a single material.

- **An Excalidraw board** opens right in the portal, full screen. Draw together with the teacher: the board saves itself, the teacher's strokes appear at once, and you see the teacher's cursor with the name. The board's menu (☰) has, at the bottom, the theme, the grid and what the mouse wheel does: «Zoom» or «Scroll (touchpad)». At the top you see whether it is saved («Saved», «Saving…», «Offline — will retry»). The board's pictures appear as they load — you can draw without waiting for them. To go back — «← Back» (where you opened the board from) or «← Boards» if the board was opened by a link; the same is in the board's menu (☰). Save the shapes you need to your library: right click → «Add to library»; open it with the «Library» button at the top right.
- **An external board** (e.g. Holst) opens in a new tab.

The links to the lesson and the boards are in the bot too: «Join lesson» and «My boards».
`,
  },
  homework: {
    title: 'Homework',
    summary: 'How to see and hand in homework',
    body: `
## See the homework

«Homework» — the list on the left and the chosen task on the right (on a phone the list and the task open one after another; the «back» arrow leads from the task to the list). Above the list are three buttons with numbers: «To hand in» (still to do, or returned by the teacher), «In review» (you handed it in and wait for the teacher) and «Done» (accepted). The one with something to do opens first. Search by title is always visible above the list. Status and overdue tags are stacked vertically. A row: the title, the deadline and the status; overdue ones are marked red. The number on the «Homework» icon in the menu is how many tasks wait for you to hand in. A reminder comes before the deadline.

On the home page the tasks to hand in are in the «To hand in» block (the nearest deadline first; a returned one has «Fix»), and the latest reviewed ones are in «Reviewed recently».

If the homework has a video, it plays right in the homework (a link to another site opens with «Open the video in a new tab»). If the teacher shows its transcript, there is a «Transcript» button under the video.

If a textbook is bound to homework, it is in the homework, in «Textbooks», with its pages. Click the title — only the pages you need open; the arrow button downloads them.

## Send work for review

1. Open the homework.
2. Write the answer and attach files if needed (photos, documents). A file that is too large or of a wrong type is rejected right when you pick it.
3. Click «Send for review».

The teacher reviews the work: accepts it with a grade or returns it for rework with a comment. If it was returned — fix it and hand it in again.

## A quiz in the homework

If the homework has questions, a «Quiz» block appears under the text. Click «Start the quiz» and answer: pick an option, type a short answer or a number, for «Matching» choose a pair for every line, and in «Ordering» put the items in order with the arrow buttons (if the order is already right, leave it: it counts as it is). On a phone the questions come one at a time («Back» / «Next»). Answers are saved by themselves. At the end click «Submit the quiz» and confirm — the attempt cannot be changed after that. You see «Result: N of M» at once. The teacher shows the correct answers and explanations right away, after the due date, or not at all. If there are several attempts, «Try again» starts a new one and the best counts. When you are done, click «Send for review» — the teacher will see your result.

## Homework on a board

If the teacher put the homework on your board, it has «Go to the board» at the top — the text of the homework and the textbook pages are already there. Still hand in your answer in the homework: as a text or a file.
`,
  },
  textbooks: {
    title: 'Textbooks',
    summary: 'Textbooks and workbooks from the teacher',
    body: `
Textbooks are a tab of the «Materials» section (next to «Boards»): the textbooks, workbooks and other materials the teacher opened to you or your group. Each is a card with a cover (the first page) and the title; the filters are «All», «Textbooks», «Workbooks», «Other»; a group's textbook shows the group's name.

Click the title to open the textbook in a new tab (a Word file is downloaded), and the arrow button downloads it. The «Search by title» field helps to find a textbook. A textbook disappears from the list if the teacher closes it to you or you leave the group.
`,
  },
  billing: {
    title: 'Payments',
    summary: 'Balance, lesson price and history',
    body: `
On a phone, balance, charges, payments and lesson price form a grid without sideways scrolling. History filters wrap to the next line.

«Payments» shows figures at the top and history below. History filters show all operations, only payments or only charges. The figures show:

- **Balance** — prepaid (you paid in advance) or debt;
- **Lesson price**;
- **History** — held lessons and your payments, a line for each: the date, the details and the amount. The latest 20 are shown first, the rest with «Show more».

A lesson is charged when the teacher marks it held (or missed without notice). The teacher records a payment when they receive it. If the teacher attached a receipt to a payment, its row has a receipt button that opens it (a HEIC photo is downloaded).

If something does not add up — write to the teacher.
`,
  },
  bot: {
    title: 'Bot in a messenger',
    summary: 'Notifications and actions in Telegram, VK or MAX',
    body: `
The notification heading stays visible on computers and phones; only the list inside the panel scrolls.

## Notifications in the cabinet

The bell in the header opens the notifications at the side (on a phone — full screen without a shadow or background dimming); its number is how many are unread, new ones are at the top. There is no separate «Notifications» section. Read ones (ticked, opened or after «Mark all read») move to «Read» at the bottom — that part is folded, click it to open. On a phone there is no tick: mark a notification read with a swipe — slide it left or right.

## Connect

The item with your name → the «Messengers» card → «Connect» next to a messenger (or «Connect» on the card on the home page). A chat with the bot opens — press «Start» or send it the code shown.

## Buttons under notifications

A notification has buttons: «Open» leads to the page of the portal, «Join» — to the lesson. If the messenger does not take such buttons, the link comes as text: «Open: …».

## What the bot can do

Send the bot /menu:

- **Schedule** — upcoming lessons and the lesson link;
- **Join lesson** and **My boards** — links;
- **Cancel lesson** and **Move lesson** — a request to the teacher (in a group — «I won’t come»);
- **My requests** — the requests waiting for an answer (they can be withdrawn); the resolved ones (approved, declined) are under «Resolved»;
- **Payments** — the balance and the latest payments.

Before sending a request the bot asks again. «Cancel» or /cancel stops an action. Write the time like 18:30 and the date like 05.10.

The bot speaks Russian.

## Notifications on the phone without a messenger

Lesson reminders, new homework and the teacher's messages can arrive as system notifications on your phone even when the cabinet is closed — without a messenger or together with one. The item with your name → «Notifications on devices» → «Turn on notifications on this device» (or «Turn on» in the card on the home page), then allow notifications in the browser prompt. «Turn off» in the list removes the device. The topics and quiet hours are the same as for messengers.

On iPhone and iPad notifications work only in the app on the Home Screen: Share → Add to Home Screen, then open the cabinet from the new icon. The portal address must be HTTPS; if notifications are unavailable, the card says why. The notification goes through a Google, Mozilla or Apple service — the text is encrypted with your device key, so the service cannot read it.

## Turn off

Send the bot /stop or disconnect the messenger in «My account» (the item with your name in the panel on the left). There, in the «What to send to messengers» card, you can also choose the topics and the quiet hours.
`,
  },
  appearance: {
    title: 'Phone, theme and language',
    summary: 'How to use the cabinet from a phone, turn on the dark theme and choose the language',
    body: `
Input fields are filled: the label sits inside the field and moves up when you type, and stays visible in light and dark themes. An error turns the label red.

## From a phone

The cabinet works in the phone's browser, nothing needs installing. If you want an icon of its own — in Chrome on Android: the browser menu (⋮) → «Add to Home screen» → «Install»: the cabinet opens in its own window, and the bars at the top and the bottom of the screen take the portal's colour.

- All five sections are in the bottom bar of the screen: «Home», «Schedule», «Homework», «Materials», «Payments»; the ☰ button at the top left opens «Help», and the section's name is next to it. On a computer all the sections are in the panel on the left, «Help» at its bottom. The chosen section's icon is filled, and «Homework» has a red number — how many tasks wait to be handed in.
- The main button of a screen is in the portal colour («Send for review», «Save»), the others are calm. A red button only confirms in a window what cannot be undone, such as «Ask to cancel». «Cancel» in a window just closes it and changes nothing.
- On a wide screen the home page has two columns: on the left the lesson, «To hand in» and «Reviewed recently», on the right «Paid» (N lessons) (how many lessons the balance covers at the lesson price) and the lesson's materials; on a narrow screen everything is one column in the same order.
- The next lesson and the «Join lesson» button come first on the home page: the tile with the day and the time on the left, the buttons under it across the width. «Join lesson» is the largest button of the portal.
- Lists are shown as cards. Forms open full screen with the action («Send») at the top right; if you close a form with unsaved changes, the portal asks «Discard changes?».
- If a field of a form is filled in wrong, the portal says so under the field; if a block did not load, it offers «Retry».
- The cabinet can be used from the keyboard: Tab moves between buttons and fields, Esc closes windows and panels.

## Dark theme

The item with your name → «Appearance» → «Light», «Dark» or «System». The choice is remembered on this device.

## Language

There, in «Appearance», — «Русский» or «English». On the sign-in page the languages are under the sign-in card. The choice is remembered on this device and in your account: notifications, the bot in the messenger and the calendar by link come in this language.
`,
  },
};
