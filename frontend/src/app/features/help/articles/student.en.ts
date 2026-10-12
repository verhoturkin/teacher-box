import { HelpArticleText } from '../help.models';
import { StudentTopic } from '../help-topics';

/** Help articles in English (ADR-0035): plain words, steps to click and short answers. */
export const STUDENT_ARTICLES: Readonly<Record<StudentTopic, HelpArticleText>> = {
  login: {
    title: 'Sign-in, password and profile',
    summary: 'How to sign in to the cabinet, change the password, the photo and the name',
    body: `
## First sign-in

The teacher sends an invitation link. Open it, choose a login and a password — and you are in your cabinet. After that, sign in on the sign-in page with this login and password.

## Forgot the password

Ask the teacher to send a password reset link. Set a new password with it.

## Change the password

The menu with your name (top right) → «My account» → «Change password».

If a link does not open or is out of date, ask the teacher to send a new one.

## Photo and name

The menu with your name → «My account»: the photo is in the top card, the name in the «Name» card.

- **Photo** — «Upload photo» and choose a picture (JPEG, PNG or WebP). The portal cuts a square out of its centre and makes it smaller. You see the photo at the top right, and the teacher sees it in the list of students, in payments, calls, the schedule and on the home page. The bin next to it removes the photo.
- **Name** — how the portal calls you in the cabinet. The teacher still sees you under the name they gave. Erase your name and save to go back to the teacher's name.
`,
  },
  schedule: {
    title: 'Schedule and moving',
    summary: 'Your lessons, cancelling and moving',
    body: `
«Schedule» shows the upcoming lessons — until the end of this week — and a calendar where the next weeks are visible too.

## Cancel or move a lesson

Next to the lesson click «Move» or «Cancel». On a phone, tap the lesson — a panel opens at the bottom with the buttons «Join lesson», «Move» and «Cancel». To move it, propose a convenient time. You can write a comment to the teacher.

In the calendar (week, month, list) the time when the teacher is busy or not working is greyed out with «Busy». Choose free time: a lesson cannot be moved to busy time, the portal tells you at once.

The teacher gets the request and answers — the answer comes as a notification, and its status is shown in «My requests». Until the teacher answers, the request can be withdrawn with «Withdraw» next to the lesson (on a phone — «Withdraw request» in the lesson's panel).

If you cancel late, the teacher may charge the lesson as missed.

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
## Join a lesson

Before the lesson click «Join lesson» — the next lesson is shown first on the home page, and the button is in the schedule too. The home page also has the «Video call» card: your room and your groups' rooms, and whether the teacher has already joined.

The call runs right in the portal. A window opens before joining: check the camera and the microphone (the browser asks for permission — allow it) and click «Join». In the call you can turn the microphone or the camera off, drag the window with your camera to another corner, and «Minimize» keeps the call in a small window — open a board or an assignment and the talk goes on. «Leave the call» is the red button.

If the teacher has set a link to another video service (e.g. Telemost), the button opens it in a new tab.

## Boards

The boards the teacher opened to you or your group are in «My boards» (the latest are on the home page too).

- **An Excalidraw board** opens right in the portal, full screen. Draw together with the teacher: the board saves itself, the teacher's strokes appear at once, and you see the teacher's cursor with the name. The board's menu (☰) has, at the bottom, the theme, the grid and what the mouse wheel does: «Zoom» or «Scroll (touchpad)». At the top you see whether it is saved («Saved», «Saving…», «Offline — will retry»). The board's pictures appear as they load — you can draw without waiting for them. To go back — «← My boards» or «Back to boards» in the board's menu (☰). Save the shapes you need to your library: right click → «Add to library»; open it with the «Library» button at the top right.
- **An external board** (e.g. Holst) opens in a new tab.

The links to the lesson and the boards are in the bot too: «Join lesson» and «My boards».
`,
  },
  homework: {
    title: 'Assignments',
    summary: 'How to see and hand in homework',
    body: `
## See the assignments

«Assignments» — all assignments with their deadlines. Overdue ones are marked. A reminder comes before the deadline.

If a textbook is bound to an assignment, it is in the assignment, in «Textbooks», with its pages. Click the title — only the pages you need open; the arrow button downloads them.

## Send work for review

1. Open the assignment.
2. Write the answer and attach files if needed (photos, documents).
3. Click «Send for review».

The teacher reviews the work: accepts it with a grade or returns it for rework with a comment. If it was returned — fix it and hand it in again.
`,
  },
  textbooks: {
    title: 'Textbooks',
    summary: 'Textbooks and workbooks from the teacher',
    body: `
«Textbooks» holds the textbooks, workbooks and other materials the teacher opened to you or your group. Under the title — the kind, the course, the file and the number of pages; a group's textbook shows the group's name.

Click the title to open the textbook in a new tab (a Word file is downloaded), and the arrow button downloads it. The «Search by title» field helps to find a textbook. A textbook disappears from the list if the teacher closes it to you or you leave the group.
`,
  },
  billing: {
    title: 'Payments',
    summary: 'Balance, lesson price and history',
    body: `
«Payments» shows:

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
## Notifications in the cabinet

New notifications are at the top of «Notifications». Read ones (ticked, opened or after «Mark all read») move to «Read» at the bottom — that part is folded, click it to open. The «Notifications» card on the home page shows only unread ones: the tick next to a notification and «Mark all read» remove them from there.

## Connect

«Notifications» (the bell in the header opens it) → «Connect» next to a messenger. A chat with the bot opens — press «Start» or send it the code shown.

## What the bot can do

Send the bot /menu:

- **Schedule** — upcoming lessons and the lesson link;
- **Join lesson** and **My boards** — links;
- **Cancel lesson** and **Move lesson** — a request to the teacher (in a group — «I won’t come»);
- **My requests** — the teacher's answers; a request without an answer can be withdrawn;
- **Payments** — the balance and the latest payments.

Before sending a request the bot asks again. «Cancel» or /cancel stops an action. Write the time like 18:30 and the date like 05.10.

The bot speaks Russian.

## Turn off

Send the bot /stop or disconnect the messenger in «Notifications». There you can also choose the topics and the quiet hours.
`,
  },
  appearance: {
    title: 'Phone, theme and language',
    summary: 'How to use the cabinet from a phone, turn on the dark theme and choose the language',
    body: `
## From a phone

The cabinet works in the phone's browser, nothing needs installing. If you want an icon of its own — in Chrome on Android: the browser menu (⋮) → «Add to Home screen» → «Install»: the cabinet opens in its own window, and the bars at the top and the bottom of the screen take the portal's colour.

- The sections are in the bottom bar of the screen: «Home», «Schedule», «My boards», «Payments», and «Assignments» and «Textbooks» are under «More»; on a computer all of them are in the panel on the left.
- Green buttons confirm («Send for review», «Save»), red ones cancel a lesson («Ask to cancel», «I won’t come»). «Cancel» in a window just closes it and changes nothing.
- The next lesson and the «Join lesson» button come first on the home page.
- Lists are shown as cards, forms open full screen.
- If a field of a form is filled in wrong, the portal says so under the field; if a block did not load, it offers «Retry».
- The cabinet can be used from the keyboard: Tab moves between buttons and fields, Esc closes windows and panels.

## Dark theme

The menu with your name (top right) → «Light theme», «Dark theme» or «System theme». The choice is remembered on this device.

## Language

The menu with your name → «Русский» or «English» (under the theme). On the sign-in page the languages are under the sign-in card. The choice is remembered on this device and in your account: notifications, the bot in the messenger and the calendar by link come in this language.
`,
  },
};
