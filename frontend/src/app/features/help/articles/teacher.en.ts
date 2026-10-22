import { HelpArticleText } from '../help.models';
import { TeacherTopic } from '../help-topics';

/** Help articles in English (ADR-0035): plain words, steps to click and short answers. */
export const TEACHER_ARTICLES: Readonly<Record<TeacherTopic, HelpArticleText>> = {
  'first-steps': {
    title: 'First steps',
    summary: 'Where to start with the portal',
    body: `
The portal is your workplace: students, schedule, homework, payments and notifications in one place.

After the first sign-in the portal opens the [initial setup](/teacher/help/setup): the password, your name, the portal's name and address, the lesson price.

## Four steps

1. **Add students.** «Create» → «Student» (on a phone — «Students» → «Add student»). The portal shows an invitation link — send it to the student in a messenger or by email. With the link the student chooses a login and a password.
2. **Check the lesson price.** «Students» → the student → the «Profile» tab of their card → «Lesson price». Debts and prepayments are counted from it.
3. **Plan lessons.** «Create» → «Lesson» for a one-off lesson, «Recurring lessons» if you meet every week at the same time.
4. **Connect a messenger.** «Settings» → «Messengers» → «Connect». The wizard helps to create a bot, and reminders and students' requests reach you in Telegram, VK or MAX.

On the «Today» page the «Getting started» list sits at the end of the «To do» card — only the steps not done yet stay in it, and the bar shows how many are done.

## The «Today» page

This is the teacher's home page. At the top — how many lessons, works to review and requests there are today. On a wide screen the cards go in three columns, on a medium one in two, on a phone one under another.

- **«Create»** — the button at the top of the sections panel on a computer and a tablet: «Lesson», «Homework», «Payment», «Student», «Board», «Message». An item opens the form in its section, and «Message» opens the new message window right over the page; the item of the section you are in comes first. On a phone this page keeps the same items behind the «+» button at the bottom right, other sections have their own button.
- **Next lesson** — the first card of the home page. A tile on the left: the day, the start time and the length; an hour before the start — «in 25 min», during the lesson — «Now» and how much is left. Next to it — with whom and the topic, the boards of the student or the group and the «Start lesson» button («Join lesson» while it runs) — the largest button of the portal. When the lesson ends, the card shows the next one by itself.
- **Lessons today** — a list under the next-lesson card: the time, with whom and the status; the nearest lesson is highlighted. There is no list on a phone.
- **To do** — unmarked lessons («Held» or «Missed» right in the row), students' requests, work to review and debts. A row opens the section or does the action; if one group has more than five items, the rest are counted («3 more»). On a phone a row is one line with an arrow: a tap does the action, and for an unmarked lesson it opens a window with two buttons.
- **Finance** — income of the month and students' debts.
- **Week** — lessons held, absences, homework given and handed in on time for the current week (Monday to Sunday).

What else to read: [Students and invitations](/teacher/help/students), [Schedule and requests](/teacher/help/schedule), [Payments](/teacher/help/billing).
`,
  },
  setup: {
    title: 'Initial setup',
    summary:
      'The wizard after the first sign-in: password, name, portal name and address, lesson price',
    body: `
After the first sign-in the portal opens a short setup wizard. It can be skipped — all of it can be changed later.

## Steps

1. **Password.** If the portal made up the password for the first sign-in itself, replace it with your own: that password is written to the server log. This step cannot be skipped.
2. **About you.** Your name — this is how students see you. The portal's name is shown at the top of the sections panel, the browser tab, on the sign-in page and in the calendar.
3. **Address.** The address at which students open the portal, e.g. \`https://school.example.com\`. Invitation links, links in bot messages and the calendar subscription start with it. «As in the browser» fills in the address the portal is open at now.
4. **Lessons.** The lesson price for new students and groups. Each student's price can be changed separately.
5. **Done.** The portal suggests what to connect later: messengers, video meetings, Google Calendar.

## If the portal warns about the address

- **«Opens only on the computer where the portal runs»** — an address like \`localhost\`: students cannot reach it.
- **«A home network address»** — it works only at home or in the office. Students need an address that opens from the internet.
- **«The address has no https»** — passwords go unencrypted. Ask whoever set up the server to turn on https.

## How to change it later

- Name, logo and colour — «Settings» → «Portal».
- Address — with the portal administrator.
- Your name and photo — «My account».
- Price for new students — «Settings» → «Payments».

Headings, search and filters stay above scrolling lists. Assignment actions are in the detail card,
without a separate row menu. In Payments, operations scroll while the month and summary stay above them.
The monthly report follows the same pane layout. Help search and article text fill the pane width,
with the article heading above the scrolling text. Static rows have no hover highlight.
Focus rings appear during keyboard use, not automatically when opening a dialog with the pointer.
`,
  },
  students: {
    title: 'Students and invitations',
    summary: 'How to add a student, give access and turn it off',
    body: `
## Add a student

1. Click «Create» → «Student» (on a phone — «Students» → «Add student»).
2. Choose «Student» and enter the name. Email and phone are optional, you and the student see them.
3. The portal opens the student's card on the «Profile» tab and shows an invitation link. Copy it and send it to the student. Fill in the rest on «Profile»: the note, the default topic, the colour, the lesson price, the video meeting.

The student opens the link, chooses a login and a password and gets to their cabinet. The link is valid for a few days — if it is out of date, issue a new one.

## List of students and groups

Students and groups are in one list. A student's row shows the photo (if the student uploaded one, otherwise the initials), the name, the nearest lesson and the prepaid amount; on the right — the debt in red and the tag «Invited» or «Turned off». Hover over an invited student's tag to see until when the link is valid. A group's row shows its students and the nearest lesson.

Above the list are the search by name and the filters: **All**, **Groups**, **In debt**, **No messenger** (students who connected no messenger) and **Turned off** (students without access and archived groups). «In debt» and «No messenger» show a number.

Click a row — the card of the student or the group opens on the right (on a phone the card replaces the list, the «back» arrow returns to it).

The top of a student's card shows the photo, the name, since which month they study with you and the tags: the messenger (or «No messenger»), the prepayment or the debt. Next to them are three buttons: **Write** — a message to this student only, **Payment** — record their payment, **Lesson** — plan a lesson with them (the default topic is filled in). The **Overview** tab gathers the main things: the next lessons, the open homework (each opens by its title), the balance with the last operations and «Contact» — the connected messengers (with none, «Remind» sends the student a link to connect one) and the video meeting link.

The **Lessons** tab lists all the student's lessons, group ones too: «Upcoming» (nearest first) and «Past» (latest first) with the outcome — conducted, missed, cancelled; for a group lesson — whether this student was there. Half a year back and ahead is shown, «Show earlier» adds the year before. **Homework** — every task of the student with its status: the open ones first, then the accepted ones with the grade; the title opens the task. **Payments** — the balance, charged and paid in total, the lesson price and the history (see [Payments](/teacher/help/billing)).

The name in the list is the one you gave: the student can choose how the portal calls them in the cabinet, but their name does not change for you.

The **Profile** tab is everything you know about the student, changed right there. «Student details»: the name, email, phone, note (only you see it), default topic and colour — change the fields and press «Save» under them («Cancel» brings back the saved ones). Below are the lesson price (with its own «Save»), the **video meeting** (actions in it are saved at once, [Video meetings](/teacher/help/meetings)) and «Cabinet sign-in»: the login (the student chooses it, so it is read-only), until when the link works and the button for a new link — «New invitation» or «Reset password».

The student's groups are rows of the same list ([Groups](/teacher/help/groups)), their boards in «Materials», the «Boards» tab ([Boards](/teacher/help/boards)).

## Links and access

The «⋮» button in the student's card (right of the buttons, on a phone at the top next to the name) opens the menu:

- **New invitation** (if the student has not signed in yet) or **Reset password** (if they forgot it) — a new link for the student.
- **Turn off access** — the student can no longer sign in. The history of lessons, payments and homework stays.
- **Give access back** — for students whose access is off (the «Turned off» filter).

## Student colour

On the «Profile» tab pick a **Colour** from the list (ten colours or «No colour»). The colour helps you find the student at a glance: it highlights their avatar: the initials background or a ring around their photo in every list — students, billing, homework, schedule, video meetings, messengers — their lessons in the calendar and their chip in the student pickers. Only you see the colour; the student does not.

In the calendar a planned lesson is filled with the colour. A conducted, missed or cancelled lesson keeps the colour of its status, with the student's colour as a stripe on the left.
`,
  },
  groups: {
    title: 'Groups',
    summary: 'Lessons with several students at once',
    body: `
A group is students who study together. A group has its own lesson price: it is charged to each member.

## Create a group

1. «Create» → «Student» (on a phone, the add button in «Students»), then choose «Group».
2. Enter the name, tick the students and click «Create».
3. The group's card opens on the «Profile» tab: set the price of one lesson for each member. A default topic and a colour are optional: the group's colour highlights its icons in lists, its lessons in the calendar and its chip in the group pickers.

## Groups in the list

Groups are rows of the students' list with a group icon: the name, the students and the nearest lesson; the «Groups» filter keeps only them. Archived groups are under the «Turned off» filter, marked «Archived».

## The group's card

Click a group's row to open its card, built as a student's. At the top — the name, the number of members and the month the group started; the buttons «Write» (a message to every member), «Lesson» (a new lesson with the group) and «⋮» with «Archive» («Restore from archive» for an archived group). The tabs:

- **Overview** — the group's next lessons and the link to its room.
- **Lessons** — every lesson of the group: upcoming and past with the outcome.
- **Homework** — the tasks of every member with the status; the student's name next to each task.
- **Members** — the students of the group; a name opens the student's card. The «remove» icon in a row takes the student out of the group; below, choose students and click «Add».
- **Profile** — the name, the default topic and the colour («Save» under the fields), the lesson price for each member and the video meeting.

## Group lessons

When creating a lesson in the schedule, choose the group instead of a student. All members see the lesson.

After the lesson mark the attendance: who came, who missed. The lesson is charged to those who came or missed without notice. Whoever said «I won’t come» in advance does not pay.

## If the members change

Change the members on the «Members» tab — new members appear in future lessons, those who left disappear from them. Past lessons do not change.

Archive a group you no longer teach: its future lessons are cancelled, the history stays.
`,
  },
  schedule: {
    title: 'Schedule and requests',
    summary: 'Lessons, recurring lessons, time off, marks and students’ requests',
    body: `
## Plan a lesson

- **One-off:** «Create» → «Lesson» (on a phone — «Schedule» → «Lesson»). Choose a student or a group, the day, the time and the duration. You can add a topic and a separate meeting link.
- **Recurring:** «Recurring lessons» → choose the days of the week and the time. The portal creates the lessons a few weeks ahead by itself.

**Default topic.** If a student or a group has a default topic (on the «Profile» tab of the student or the group), it is filled in for a new lesson or series as soon as you choose them. You can change or clear it; a topic you typed yourself is never replaced.

**How the section is laid out.** On a computer the calendar (week or month) is the main area; on the right are a mini-month for jumping between days, «Students’ requests» and the «Recurring» and «Time off» tabs. On a phone the section opens as the «Agenda»: a strip of the week's days and the list of the chosen day's lessons; «Week», «Month», «Recurring» and «Time off» are in the «⋮» menu.

A lesson can be dragged in the calendar to another time. It takes the new place with two buttons on its card: ✓ «Move» saves the move, ✕ «Undo the move» puts the lesson back. If the time is busy, the portal asks again.

In the month view, click a day to plan a lesson on it: it starts at 10:00 and lasts the default duration — change them in the form.

## Time off

Mark the time you do not work: «Schedule» → «Time off».

- **Once** — from when to when, e.g. a holiday from Monday to Friday or a visit to the doctor.
- **Every week** — days of the week and hours, e.g. lunch from 13:00 to 14:00 or a day off on Saturday (00:00–00:00 is the whole day). You can set from which date and until which it applies.

Time off is hatched in the calendar, and listed in the «Time off» tab, where it can be edited or deleted: «⋮» in the row → «Edit» or «Delete…». Only you see the label (e.g. «Lunch»).

Students see this time as «Busy» and cannot ask to move a lesson to it. You can still put a lesson in your time off — the portal does not stop you.

## After the lesson

Click the lesson and choose «Held» or «Missed». For a group — «Mark attendance». The portal charges the lesson by the mark.

If you made a mistake — «Remove the mark», the charge is undone.

A past lesson without a mark is outlined in red in the calendar; open it and mark the result. Their number is also on the home page, in «To do». On a phone such lessons sit in the agenda under the row — each has the «Held» and «Missed» buttons, a group — «Mark»; the «Lessons not marked» link above the list leads to them.

## Cancel, delete, restore

- **Cancel** — the lesson stays in the schedule crossed out, the student gets a notification. A cancelled lesson can be **restored**: open it and click «Restore» — it is back in the schedule and the student gets a notification. If the time is already taken by another lesson, the portal asks.
- **Delete** — the lesson disappears from the schedule, calendars and reports as if it never existed. Only a planned or cancelled lesson can be deleted; remove the mark of a held or missed one first. If the lesson was planned and has not passed yet, the student gets a cancellation notification.

## Students' requests

A student can ask to cancel or move a lesson — in the cabinet or through the bot. The request appears in «Students’ requests», comes as a notification, and in a messenger — with «Accept» and «Decline» buttons right away. On the site click «Answer» — then «Approve» or «Decline» in the window.

- **Approve a move** — the lesson moves to the proposed time (or set your own). If you have another lesson, time off or Google Calendar events at that time, the portal warns — you can move it anyway.
- **Approve a late cancellation** — decide whether to charge it as missed (then the lesson is paid).
- **Decline** — write an answer, e.g. propose another time.

If a group's student said «I won’t come» in advance, the request is accepted by itself — no answer is needed.

The student sees in their calendar when you are busy or not working (without other students' names and without your labels) and cannot ask to move a lesson to that time.
`,
  },
  calls: {
    title: 'Calls',
    summary: 'Video calls right in the portal: a room for each student and group',
    body: `
Each student and each group has its own permanent call room in the portal. The call runs right in the browser — nothing needs installing.

Whether calls are on in the portal is shown in «Settings» → «Calls». The room link is in the card of the student or the group.

## How to join

«Start lesson» at a lesson, the room link from the card of the student or the group, or the link from a reminder. A window opens before joining: check the camera and the microphone, turn them off or choose others if needed, and click «Join». The browser asks for permission for the camera and the microphone — allow it.

## During the call

- **Microphone, camera** — turn on and off; a turned-off button becomes red, turns from a circle into a rounded square and its icon is crossed out.
- **Your picture** — in a call of two, your camera is in a small window in a corner. Drag it to any other corner — the portal remembers the choice.
- **Share screen** — on a computer: share a window, a tab or the whole screen; while you share it, the button is square.
- **Settings** (the gear) — another microphone or camera; sound processing: echo cancellation, noise suppression and automatic gain (on by default; turn them off if the voice is chopped or muffled — the portal remembers the choice); «Connection details» — the connection quality of each participant, the protocol (UDP or TCP), ports, delay and sound loss. If the sound stutters, open the details and pass them to the administrator.
- **Minimize** — the call goes on in a small window in a corner while you work in the portal: open a board, homework, the schedule. The window can be dragged to another corner. «Expand» brings the big window back.
- **Leave the call** — the red button.

On a phone a minimized call is a bar above the bottom menu.

## External link

If a student or a group has a link to an external video service (Telemost, Zoom), lessons and reminders lead there, not to the portal room. To hold lessons in the portal, delete the link: «Students» → the student → the «Profile» tab → «Video meeting» (for a group — the same, on the «Profile» tab of its card).

The administrator turns calls in the portal on (a call server is needed). If they are off, the section says so.
`,
  },
  meetings: {
    title: 'Video meetings',
    summary: 'An external video service instead of the portal room',
    body: `
If calls in the portal are on, lessons are held in the portal room — see [Calls](/teacher/help/calls). Instead of it, a student or a group can have a permanent link to an external video service (Telemost, Zoom and others). The link goes into the lesson card, the reminders and the student's «Join lesson» button.

## Set the link

«Students» → the student → the «Profile» tab of their card → «Video meeting»; for a group — the same, the «Profile» tab of its card. Actions in this block are saved at once, without «Save».

Create a meeting in Telemost, Zoom or another service, paste the link and click «Add link».

«Send to the student» sends the link to the cabinet and the messenger. Without an external link the same button sends the link of the portal room. To go back to the portal room, click «Delete link».

## Start a lesson

In the lesson card click «Start lesson». On Windows the meeting opens in the Telemost app; to open it in the browser, click the arrow on the right of the button — the menu has «Open in the browser». The choice is kept on your computer: «Settings» → «Calls» → «Video meetings».

One lesson can have another link — in the lesson window.
`,
  },
  boards: {
    title: 'Boards',
    summary: 'Excalidraw boards and external boards of students and groups',
    body: `
Boards are a tab of the «Materials» section (next to the «Textbooks» tab, [Textbooks](/teacher/help/textbooks)): all boards in one place, as cards with the board's picture. The search above the cards finds a board by its title or a student's name (a group's name). A board is of one of two kinds:

Search fills the pane width; filters and sorting are below it. The «Textbooks» tab uses the same layout. Cards keep a compact size even when the list contains a single material.

- **Excalidraw board** — the portal's own board: you draw together with students right here, and the board saves itself.
- **External board** — a board in another service (e.g. [Holst](https://app.holst.so)): the portal keeps only the title and the link and opens it in a new tab.

## Create a board

1. «Create» → «Board» (on a phone — «Materials» → «New board»).
2. Choose the kind and enter the title. For an external board paste the link and open the board by link in its service.
3. Choose students and groups — as many as you like. All students of a group see its board; a student who left the group no longer sees it.

The lesson card and the «Next lesson» card have links to the boards of its student or group.

Each board is a card: a picture on top (an Excalidraw board's latest view, refreshed when it saves; an external board has a tile with the service's icon and name), under it the title, who it is open to and when it changed. The filters above the cards are «All», «In the portal», «External» and «Student or group» (pick a student or a group to keep their boards); the sort button changes the order. Tap a card to open the board. To change the title, the link or the students — «⋮» in the card → «Edit». To delete — «⋮» → «Delete…»: an Excalidraw board is deleted with its drawing, pictures and backups.

## Draw together

An Excalidraw board opens full screen. At the top — «← Back» (or «← Boards»), the title and the state: «Saved», «Saving…» or «Offline — will retry» (the portal retries by itself). Everything works live: students' strokes appear for you at once, yours for them; you see the cursors and names of those on the board now (their icons at the top right). If two people change the same shape at the same time, the last change wins. If the connection to the portal drops, the board keeps saving, and others' changes come every few seconds until the connection is back. The board's pictures load a few at a time and appear as they load — you can draw without waiting for them.

The board's menu (☰) has the settings at the bottom:

- **Theme** — «Light», «Dark» or «System» (the same setting as the whole portal's);
- **Grid** — turns on the grid of the board; it is shared — everyone on this board sees it;
- **Mouse wheel** — «Zoom» (the default: the wheel zooms in and out) or «Scroll (touchpad)» (the wheel and two fingers move the board, zoom with a pinch or with Ctrl). Remembered on this device.

To go back — «← Back» (where you opened the board from: the home page, a lesson, a task) or «← Boards» if the board was opened by a link; the same is in the board's menu (☰): everything unsaved is saved before leaving. Without a connection, the portal asks whether to leave without saving.

## Library

Save the shapes you need often to the library: select them, right click → «Add to library». The library opens with the «Library» button at the top right, and a shape can be dragged from it onto any board. Everyone has their own library — you and each student — and it is kept in the portal, so it is available on any device. A ready library from an .excalidrawlib file can be added through «⋯» in the library → «Open»; the libraries.excalidraw.com catalogue does not open from the portal.

## Board backups

Once a day the portal backs up every changed board (the last 7 daily backups are kept). Before big changes make your own backup: «⋮» in the board's card → «Backups», or «Backups» in the board's menu (☰) → «Make a backup» (up to 20 per board).

«Restore» brings back the backup's drawing; the current drawing is saved as a backup first, so the restore can be undone. Boards open at students' are updated by themselves.

## Put material on a board

The «To a board» button is on the homework's page, in the homework editor and when reviewing work. Choose a board in the list (it has a search by title) — from the homework only the boards of its students and their groups are offered — and the way:

- **As text** — it can be edited on the board;
- **As a picture** — as it is, handy for formulas and tables.

An Excalidraw board opens in a new tab with the material already at the centre. Homework (from its page or with «Assign and put on a board» in the editor) goes into a frame named after it and today's date: the text first, then the pictures among its files and the pages of its textbooks, left to right (PDF and Word files stay in the homework). For an external board the material is copied and the board opens in a new tab — press Ctrl+V there (Cmd+V on a Mac); a picture can be copied this way only when the portal is open at a secure address (https).

Pages of a textbook can be put on a board too — from the «Textbooks» tab or from a textbook of the homework ([Textbooks](/teacher/help/textbooks)): they go in a row inside a frame. Only an Excalidraw board takes such pages.
`,
  },
  homework: {
    title: 'Homework',
    summary: 'How to give homework, review work and return it',
    body: `
## Give homework

1. «Create» → «Homework» (on a phone — «Homework» → «New homework») — the homework editor opens.
2. Write the title and the text. The text can have **bold**, lists and links — the «Text / Preview» switch shows what the student sees.
3. Choose students and groups — several groups can be ticked, their students join the list (untick a group and they leave it). The due date becomes the start of their next lesson by itself — you can change it.
4. Bind textbooks and add files right here — they show as cards; click a name to open the textbook or the file (PDF files and pictures open in a new tab).
5. Need a video — in «Video» click «Add a video» and paste a link (up to 5 videos). YouTube, Rutube and VK Video play right in the homework, other links open in a new tab. Below is «Transcript»: «Take captions from YouTube» fills it with the video's captions (if it has any; when there are several — in different languages, by the author and automatic — the portal asks which to take), «Load subtitles» — from an .srt or .vtt file, or paste the text yourself. The AI assistant relies on the transcript; the student sees it only with «Show the transcript to the student» on.
6. Click «Assign». Students are notified once the homework has all its materials, and reminded before the deadline.

«Assign and put on a board» gives the homework out first, then offers a board of its students: the text, pictures and textbook pages go on it in a frame. The portal remembers the board — the students get «Go to the board» in the homework. «To a board» on the homework's page does the same.

«Edit» on the homework's page opens the same editor — the title, the text, the videos and the due date; the textbooks and files of saved homework change on its page. Leaving the editor without saving asks first. Homework is one list with a switch «To review / Active / Done» and a search by the title or a student's name. A row: the title, who has it and the due date, a badge of the progress («To review», «Accepted»…), the actions under «⋮»; a click opens the homework to the right of the list.

## The homework's page

The text, «Video» (the player and a «Transcript» button), «Materials» (files) and «Textbooks» are cards; a name opens the file or the textbook in a new tab (a textbook at its first bound page, a Word file is downloaded), the arrow button downloads a file, the cross in a row removes a file or a textbook. «Open the board» leads to the board the homework is already on, «To a board» puts it on a board. «Students» has a card for each: the name (click it to open or review the work), when it was handed in and the status. «Add» at the top right of the block gives the homework to more students and groups.

## Delete homework

«Delete…» on the homework's page or in the «⋮» menu of the list. The homework is deleted with the students' answers and the files — it can be brought back only from a backup.

## A textbook for the homework

On the homework's page, in «Textbooks», click «Bind a textbook», choose a textbook from «Textbooks» ([Textbooks](/teacher/help/textbooks)) and enter the pages — e.g. «12-14, 20». An empty field is the whole textbook. The student sees the textbook in the homework and downloads only these pages (a Word file in full, with the pages as a hint), even if the textbook itself is not open to them. The pencil in the row changes the pages, the cross removes the textbook from the homework, and the board button puts the bound pages on a board ([Textbooks](/teacher/help/textbooks)).

## Review work

«Homework» is a list on the left and the opened item on the right. A switch at the top of the list: **To review** (handed-in work, and under it «Waiting for hand-in» — who has not handed in yet), **Active** (given homework where not everything is accepted; below it «Not given» — drafts) and **Done** (everything accepted). The filter button opens a search by the homework title or a student's name. A work in the list shows the student, the homework and when it was handed in; the «Overdue» tag means it was handed in after the due date.

Press a work and it opens on the right: the task (it collapses), the student's answer and the picture files. «Open on the board» leads to the homework's board. On a wide screen the review is a separate panel at the right:

- **Comment to the student** with quick phrases under it;
- **Accept** — the work counts;
- **Return** — the student fixes it and hands it in again;
- «Next: …» — after the decision the next work of the queue opens.

On a medium screen the review form goes under the answer. On a phone the work opens full screen and a floating toolbar sits at the bottom: the AI and comment buttons, «Return» and «Accept». The comment, the AI draft and the grade open in a bottom sheet.

If the AI assistant is on, «AI draft» suggests a comment and a grade — check them and press «Insert» ([AI assistant](/teacher/help/ai)). Old links to the review queue and to the work's page keep working.
`,
  },
  textbooks: {
    title: 'Textbooks',
    summary: 'Textbooks and workbooks: files, access for students, pages',
    body: `
Textbooks are a tab of the «Materials» section (next to the «Boards» tab, [Boards](/teacher/help/boards)): textbooks, workbooks and other materials, one file each. A file is a PDF, a Word file (DOC, DOCX) or a picture, up to 100 MB.

## Add a textbook

1. «Create» → «Textbook» (or «Materials» → the «Textbooks» tab → «New textbook»).
2. «Choose file». The title is taken from the file name — correct it.
3. Choose the kind — «Textbook», «Workbook» or «Other» — and the course (e.g. «English, grade 5»): the portal suggests the courses of other textbooks.
4. The portal counts the pages of a PDF itself; a picture is one page. For a Word file enter the number of pages yourself (optional).
5. Choose the students and groups the textbook is open to. All students of a group see its textbook.

## List

A line per textbook: the kind's icon, the title, the kind, the course, the file and the number of pages, who it is open to. The «Search by title» field above the list finds a textbook quickly. Click the title to open the textbook in a new tab (PDFs and pictures open in the browser, a Word file is downloaded). The row's «⋮» menu:

- **Download** — the textbook's file;
- **Edit** — kind, title, course, Word pages, students and groups;
- **To a board** — pages of the textbook as pictures on an Excalidraw board: for a PDF enter the pages (e.g. «12-14», at most 30 at a time), a picture goes whole. Choose a board in the list with a search (from «Textbooks» — any board, from homework — a board of its students). The board opens in a new tab, the pages go in a row to the right of everything already on the board, inside a frame named with the textbook's title and the page numbers — the frame moves together with the pages, and you can draw right over them. A Word file cannot go on a board;
- **Replace file** — choose a new file (e.g. a corrected scan); the PDF pages are recounted;
- **Delete…** — the textbook is deleted with its file and disappears from homework.

A student sees the textbooks open to them in their «Materials» section and can download them.
`,
  },
  ai: {
    title: 'AI assistant',
    summary: 'Drafts of homework and reviews',
    body: `
The AI assistant saves time, but you always decide: it only suggests a draft.

## What it can do

- **Homework draft** — the AI assistant bar above the «Homework text» field of the editor (in «Text» mode). Write in your own words what you need and click «Generate». The draft appears between the request and the text: «Replace» takes its title and text, «Add to the end» adds its text after yours, «Discard» drops it, «Once more» asks for a new one.
- **From a textbook and files** — the «Base it on» button in the assistant bar: tick the bound textbooks (their pages) and the materials of the homework — PDF files and pictures, up to 5 of them and 20 pages at once. Files of a new homework can be ticked as soon as they are picked, without saving it; the AI does not read Word files.
- **From a video** — «Base it on» also lists the homework's videos with a transcript: the AI reads it (it does not watch the video) and writes tasks on what the video says, with the time of the fragment — «[1:05]». A video without a transcript is not listed: take the captions from YouTube or load a file first.
- **Prompt library** — the «Prompts» button: search the saved prompts and «Save the request as a prompt» for a request that worked. Rename, edit and delete prompts in «Settings» → «AI assistant», the «Prompt library» card («Manage the library» in the same menu).
- **Review draft** — on the page of a work under review. The AI suggests a comment, a grade, and whether to accept the work or return it.

## System prompts

The rules the AI follows in its drafts (tone, language, the layout of a task, how strict a review is) are in «Settings» → «AI assistant», the «System prompts» card. Click the pencil next to «Homework draft» or «Review draft», rewrite the text and save: the next drafts follow your rules, and the prompt is marked «Changed». The portal sets the answer format itself, and the AI gets the task and the student answer separately — no need to mention them in the prompt. «Restore the standard one» in the same window brings the original text back.

## Limit and costs

«Settings» → «AI assistant» shows how many tokens were spent this month and how many are left before the limit. «Recent requests» are cards: what was asked, the result, the time, the model and how many tokens it took; a failed one shows its error. The 10 newest come first, the rest of the month — with «Show more». When the limit is used up, the AI buttons stop working until the next month.

The AI assistant is connected when the portal is installed (by whoever set up the server): Claude, Gemini, DeepSeek, OpenRouter — models of many companies with one key — or another service. If there are no AI buttons, it is not connected.
`,
  },
  billing: {
    title: 'Payments',
    summary: 'Students’ balances, payments, monthly report',
    body: `
## How the balance is counted

Each held lesson (and each one missed without notice) is charged at the student's or the group's price. Each payment tops up the balance.

- **Prepaid** — the student paid in advance.
- **Debt** — more lessons were held than paid for.

## The «Payments» page

The page shows one month; the ‹ › arrows next to the title switch months.

- **Four figures:** «Received», «Charged for lessons», «Debt» (the red tile — how many students owe) and «Prepaid».
- **Operations** — the month's list: payments, lessons and absences; the amount on the right (a payment with «+», a charge with «−», an absence without a charge — «0»). The buttons «All · Payments · Lessons · Absences» and the «Student» select keep only what you need. A student's name opens the «Payments» tab of their card.
- **By students** (on the right on a wide screen): «Debtors» with the «Remind» button — it sends the student a reminder, «Prepaid running out» — whose prepayment covers 2 lessons or fewer, and «By weeks» — what came in each week. «All in Students» opens the students list.
- **Monthly report** — the button in the header.

On a phone the top shows the month with an arrow to the previous one and the «⋮» menu (next month and the report), the figures scroll sideways and the «Payment» button at the bottom records a payment. Each student's balance is in «Students» and on the «Payments» tab of their card.

## Record a payment

«Create» → «Payment» (on a phone — «Payments» → «Payment»; or the «Payment» button in the student's card) → amount, date and comment. A wrong payment can be voided on the «Payments» tab of the student's card.

## Payment receipt

A payment can have a receipt — a photo or a PDF up to 10 MB: in the «Payment» window («Choose a file») or later in the history on the «Payments» tab of the student's card — the paperclip button in the payment's row → «Attach a receipt» («Replace the receipt», «Remove the receipt»). The receipt button in the row opens it. The student sees the receipt in their payments and can open it.

The easiest way is to forward the receipt to the bot: send a photo or a PDF, the bot asks who paid and how much and records the payment with the receipt ([What the bot can do](/teacher/help/bot)).

## Lessons outside the schedule

Lessons are charged when you mark them in the schedule. If a lesson took place but is not in the schedule, add it to «Schedule» backdated and mark it «Held» — or record it through the bot («Add lesson»).

## Price and history

Click a student's name to open the «Payments» tab of their card in «Students»: lessons, payments and the lesson price (it is changed on the «Profile» tab; past lessons keep the old price). The history is a list, a line per lesson or payment: the date and details under the title, the amount on the right; the cross removes a charge or voids a payment. The latest 20 are shown first, the rest with «Show more».

## Monthly report

«Monthly report» — income, held lessons and the total for each student.

Payments and lessons can be recorded through the bot too ([What the bot can do](/teacher/help/bot)).
`,
  },
  notifications: {
    title: 'Notifications and bots',
    summary: 'The bell, messengers and messages to students',
    body: `
Notifications are always under the bell at the top of the page. To get them in a messenger, connect a bot.

## The bell

The bell opens the notifications at the side, on a phone — full screen; its number is how many are unread. There is no separate «Notifications» section. At the top there are two tabs:

- **Inbox** (with the number of unread ones) — new notifications are at the top. Read ones (ticked, opened or after «Mark all read») move to «Read» at the bottom — that part is folded, click it to open. On a phone there is no tick: mark a notification read with a swipe — slide it left or right.
- **Sent** — your messages to students: the text, when it was sent and how many recipients; «Write to students» starts a new one.

On a wide screen the notifications open as a third column on the right and do not cover the page: you can keep working and move between sections — the column stays until you press «×» (or Esc) or the bell again. On a narrower screen and on a phone they close when you open a notification that leads to another page. Old links to the «Notifications» section open the bell.

Bots, your messengers, students' messengers and what to send are in «Settings» → «Messengers».

## Connect a bot

«Settings» → «Messengers» → «Messenger bots» → «Connect» next to a messenger. The wizard shows step by step how to create a bot, checks it and sends you a test message.

One messenger is enough — the one your students use. Students connect a messenger themselves, in their «My account».

## Who is connected

The «Students’ messengers» card («Settings» → «Messengers») shows who has a messenger connected and whether deliveries failed. «Remind everyone without a messenger» (or «Remind the selected») asks the others to connect.

## Message to students

«Create» → «Message» on any page (or the bell → «Sent» → «Write to students») → write the text and choose the recipients (everyone, separate students or a group). The window opens over the page you were on; the message sent appears in «Sent».

## What to send

«Settings» → «Messengers» → «What to send to messengers»: choose the topics for the messenger and the quiet hours — at night messages wait until the morning.

Notifications and bot messages are written by the server in Russian.

The bot does more than send notifications — [What the bot can do](/teacher/help/bot).
`,
  },
  bot: {
    title: 'What the bot can do',
    summary: 'Actions with the portal right from a messenger',
    body: `
Send the bot /menu — buttons with actions appear. The bot speaks Russian.

## For you

- **Today** — the day's lessons; started ones can be marked: «Held», «Missed», for a group — who came.
- **Unmarked** — past lessons without a mark.
- **Requests** — accept or decline students' requests with an answer. The buttons are right under the request notification too.
- **Record payment** — choose a student and the amount (1, 4 or 8 lessons at their price, or any).
- **Receipt** — send the bot a photo or a PDF of a receipt (up to 10 MB); it asks for the student and the amount and records the payment with this receipt.
- **Add lesson** — one held outside the schedule, with a student or a group.

## For students

The schedule and the lesson link, cancelling and moving a lesson (in a group — «I won’t come»), their requests, payments and boards.

## How to use it

- Before any change the bot asks again — press «Yes».
- Links in notifications are buttons: «Open» leads to the page of the portal, «Join» — to the lesson. If the messenger does not take such buttons (Telegram and a portal on a local address), the link comes as text: «Open: …».
- «Cancel» or /cancel stops an action at any step.
- A student can be found by part of the name.
- Write the time like 18:30 and the date like 05.10.

## Turn management off

«Settings» → «Messengers» → «What the bot can do» → turn off «Manage the portal through the bot» if other people can access your messenger. Notifications keep coming.

In VK the buttons need «Bot features» turned on in the community settings.
`,
  },
  calendars: {
    title: 'Calendars',
    summary: 'The schedule in Google Calendar and other calendars',
    body: `
## Calendar subscription (any calendar)

«Settings» → «Schedule and calendar» → the «Calendar on the phone» card → «Get link». Add the link to the calendar of your phone or computer as a subscription: the lessons appear there and update by themselves.

The link is secret: whoever knows it sees the schedule. If it got to the wrong place, create a new one — the old one stops working.

Students can make such a link too — it has only their lessons.

## Google Calendar

«Settings» → «Schedule and calendar» → «Google Calendar» → connect the account. Then:

- the portal's lessons appear in your Google Calendar;
- the portal's schedule shows when you are busy in Google Calendar — handy not to put a lesson on busy time.
`,
  },
  settings: {
    title: 'Settings',
    summary: 'Account, portal, calendar, calls, messengers, payments, AI assistant, data',
    body: `
«Settings» (at the bottom of the sections panel on the left, on a phone — under ☰) gathers what concerns the whole portal: connections, appearance and data. On the left is the list of setting groups, on the right — the chosen group. On a phone the list comes first; the chosen group opens in its place, and the back arrow returns to the list. Each group has its own address — you can bookmark it.

- **My account** — photo, name and password. The same section opens from the menu under your photo at the top right.
- **Portal** — the portal's name, address, colour and logo ([Look, language and phone](/teacher/help/appearance)).
- **Schedule and calendar** — the portal's time zone, Google Calendar and the schedule subscription ([Calendars](/teacher/help/calendars)).
- **Calls** — calls in the portal ([Calls](/teacher/help/calls)) and video meetings ([Video meetings](/teacher/help/meetings)).
- **Messengers** — bots, your messengers, what the bot can do, students' messengers and what to send ([Notifications and bots](/teacher/help/notifications)). If messages did not reach a messenger, the group shows their number in the list, and the «Failed deliveries» card comes first; the portal administrator can resend them.
- **Payments** — the lesson price for new students and groups ([Payments](/teacher/help/billing)).
- **AI assistant** — the model, tokens spent this month, recent requests, the prompt library and the system prompts ([AI assistant](/teacher/help/ai)).
- **Data** — backups: the portal makes a backup every night, here you can back up now, download a backup, restore it and connect Google Drive for the backups ([Backups and full reset](/teacher/help/backups)); full reset — delete all data and start again.

The portal address is set during the initial setup; later the portal administrator changes it.
`,
  },
  appearance: {
    title: 'Look, language and phone',
    summary:
      'Portal colour and logo, dark theme, language, sections on a computer, tablet and phone',
    body: `
## Colour and logo

«Settings» → «Portal»:

- **Colour** — choose one of the ready colours or «Own colour»: a palette or a code like #0f766e. The colour sets the buttons, links, highlights and a light tint of the background — in the light and the dark theme. Under the palette you see how the buttons look in both themes. The portal picks the tones of the text itself so that buttons and links stay readable in any colour; if the colour is too light or dark, the portal warns that it will be changed noticeably. A red portal colour also gets a warning: red buttons delete, and the main action would look like them. Click «Save».
- **Logo** — «Upload»: a PNG, JPEG, WebP or SVG picture up to 1 MB. The logo appears at the top of the sections panel (in a circle), on the sign-in page and on the browser tab. The bin next to it brings back the default icon.

The portal's name is there too — it is shown next to the logo at the top of the sections panel.

## Dark theme

The menu under your photo (top right) → «Light theme», «Dark theme» or «System theme». The choice is remembered on this device; students have their own setting.

## Language

The same menu → under the theme — «Русский» or «English». The portal reloads in the chosen language; the choice is remembered on this device. On the sign-in and invitation pages the languages are under the card, so a student chooses theirs before signing in.

The chosen language is also kept in the account: notifications in the «Inbox» and in messengers, the bot's answers and the calendar by link come in it. Each student gets them in their own language. Notifications already received are not translated. Group names, lesson topics and your messages to students stay as you wrote them.

## The portal as an app on the phone

In Chrome on Android: the browser menu (⋮) → «Add to Home screen» → «Install». The portal opens in its own window without the address bar, with the portal's name and logo. The bars at the top and the bottom of the screen (time, battery and navigation buttons) take the colour of the portal's header and change with the theme. If the portal colour or the theme was changed after installing, Android may update the colour of the bottom bar not at once — until the browser updates the app.

## Sections

- **Wide screen** (from 1600 pixels) — the sections panel on the left: the icon and the label on one line, the chosen section highlighted.
- **Computer and tablet** — a narrow panel on the left: the section's icon with the label under it.
- **Phone** — the bottom bar: «Home», «Schedule», «Homework», «Students», «Payments». The ☰ button at the top left opens a panel with the other sections («Materials»), «Settings» and «Help»; it closes when you pick a section, with the button in its corner, a tap beside it or Esc.

The top of the sections panel holds the portal's logo and name with «Create» under them, its bottom — «Settings» and «Help». «Create» is the only such button on the screen: on a computer and a tablet the sections have no «Add…» buttons in their headers, they stay only on a phone.

Icons are Material Symbols, as in Android; the chosen section's icon is filled, the others are outlined.

The search is at the top centre: start typing a student's or group's name, or the title of an assignment, board or textbook, and matches appear under the bar in groups (up to five in each, the rest counted as «N more»). Pick a result with ↑ ↓ and Enter or click it; Esc closes the list. Open the search from the keyboard with Ctrl K (⌘ K on a Mac) on any page. It searches the lists already loaded, so it finds what you have opened in this session; on a phone the magnifier icon at the top opens a full-screen search. The bell and your photo (or a person in a circle) are always at the top right: the photo opens the menu — «My account», the theme, the language and «Sign out». A page's title starts its content, and a «?» next to the title of a page or a block opens help about it. On a phone the top has ☰ and the section's name, and the page itself shows no section title and no «?»: help is under ☰.

Lists in blocks (students, payments and payment history, boards, lessons, notifications) are separate tiles, a line per record, not tables: on the left the student's photo (or initials) or an icon, in the middle the name and details, on the right an amount, a status or buttons. The buttons of all rows of a list stand on one line.

The blocks of each section go one under another, in one column, on a computer the same as on a phone: on top what needs an action, below — the calendar, lists and settings. The home page has «Needs attention» and «Finance»; the notifications are under the bell in the header. Sections take the full width of the window. The exceptions are the help and «Settings»: on a wide screen the list (of articles or setting groups) is on the left and the chosen one on the right, each scrolling on its own; on a phone the list comes first, the chosen one opens in its place and the back arrow returns to the list. On a tablet the help works as on a phone, and «Settings» split the screen in half.

Input fields have their label on the outline, as in Material 3; in focus the outline and the label take the portal's colour, on an error — red. Search is a «pill» line with a magnifier.

## Button colours

- **The portal colour** — the main action of a section or a window: «Create», «Save», «Accept», «Held». There is one such button on a screen.
- **Calm tonal and text buttons** — the other actions, «Missed», «Return for rework» and «Cancel lesson…» included: the status of the lesson or the homework shows what happened. «Cancel» in a window just closes it.
- **Red** — deleting only: the bin or «×» in a list row, «Delete…» in a menu and the button that confirms deleting in a window.
- Green and yellow are colours of statuses («Held», «Accepted», «To review»), not of buttons.

Before deleting, the portal asks again: the red button in the window does the action, «Cancel» changes nothing.

## Forms, loading and keyboard

- The «Save» button of a form can always be pressed. If a field is filled in wrong, the portal says so in red under the field and puts the cursor in the first such field. Required fields are marked with a star.
- If a block did not load, it says «Could not load…» and has a «Retry» button — an empty list is shown only when there really is no data.
- The portal's messages appear at the bottom of the screen for 5 seconds, errors for 8; a message can be closed with the cross.
- The portal can be used from the keyboard: Tab moves between buttons and fields, the focused element has a visible outline. Windows and bottom panels keep the focus inside, Esc closes them and returns the focus to where they were opened from.
- A large font in the browser settings makes the text bigger, not the panels around it.

## From a phone

- The main action of a section is a big labelled button at the bottom right: «Add student», «Lesson», «New homework», «Payment».
- Lists (students, payments, homework) are shown as cards, the action buttons at the bottom of a card. Students and groups are a list: the name on the left, the debt or the status on the right; tap a row to open the card with the «⋮» menu.
- On nested pages (homework, a student's work, the report) the «←» arrow left of the title goes back to the list.
- The schedule is a list by days by default.
- Forms with several fields open full screen, with «Save» and «Cancel» at the bottom; short windows (password, link) are in the middle of the screen. The bottom of the screen has «Home», «Schedule», «Homework», «Students» and «Payments», the other sections are under ☰.
- The portal's messages («Saved», errors) appear at the bottom of the screen.
`,
  },
  backups: {
    title: 'Backups and full reset',
    summary: 'How to make a backup, restore it and start all over',
    body: `
Every night the portal backs up all the data: students, schedule, payments, homework with its files, the current drawing of every board. The copies of the boards themselves (daily and yours) are not in this backup — after it is restored, boards keep only their current drawing.

## Make and download a backup

«Settings» → «Data» → «Backups» → «Back up now». To download a backup, click «⋮» in its row → «Download» — keep the backup not only on the server.

Under the date of a backup you see where it comes from (scheduled, manual, before a restore or before a reset), its size and whether it is in Google Drive. Backups of every kind are kept for two weeks (the administrator sets the period); the portal deletes older ones after making a new one.

## Backups in Google Drive

So that the backups are not lost with the server, connect Google Drive: «Settings» → «Data» → «Google Drive». The portal needs its own Google OAuth client — free, done once. The steps are in the panel too (with the redirect address and a copy button):

1. Open [Google Cloud Console](https://console.cloud.google.com/) with the Google account whose Drive will keep the backups. Click the project picker at the top → «New project», enter a name → «Create» and select the new project.
2. «APIs & Services» → «Library»: find «Google Drive API» → «Enable».
3. Menu ☰ → «Google Auth Platform» → «Get started»: the app name and your address → «Next»; «Audience» — «External» → «Next»; a contact address → «Next»; agree to the policy → «Continue» → «Create».
4. «Data Access» → «Add or remove scopes»: tick .../auth/drive.file → «Update» → «Save».
5. «Audience» → «Publish app» → «Confirm» — otherwise Google withdraws the access after 7 days. This access needs no verification by Google.
6. «Clients» → «Create client»: type «Web application», under «Authorized redirect URIs» → «Add URI» paste the address from the panel → «Create».
7. Copy the Client ID and the Client secret from the dialog (the secret is shown only once) into the «Google Drive» panel → «Save».

Then click «Connect Google Drive» and allow the access.

The portal creates a folder named after the portal in the Drive and sends every scheduled and manual backup there; they are kept there as long as on the server (two weeks by default). The portal does not see other files of the Drive. Any backup can be sent by hand: «⋮» in its row → «Send to Google Drive». The «Google Drive» panel shows when the last backup went there, and the error if it did not.

**After a disaster:** install the portal again, connect the same Google Drive, click «Bring to the server» next to a backup in «Backups in Google Drive» — it appears among the «Backups» and can be restored.

## Restore a backup

1. Click «⋮» in the row of the backup → «Restore…».
2. Read the warning: everything added after the backup is lost.
3. Enter your password and click «Restore».

The portal backs up its current state, restarts and shows the result in about a minute. Then sign in again — with the password that was valid at the time of the backup.

If the restore fails, the data stays as it was, and the window shows the reason.

## Full reset

«Settings» → «Data» → «Full reset» deletes everything: students and groups, lessons, payments, homework, notifications, connections, the portal's name and address. Your sign-in, the administrator's sign-in, all backups and their Google Drive connection stay.

1. Click «Reset all data…».
2. Enter your password and the word «RESET».

Before the reset the portal makes a backup — if you change your mind, restore it. After the reset the [initial setup](/teacher/help/setup) opens again.

If after the reset the portal asks you to delete the calendar in Google, open Google Calendar and delete the portal's calendar by hand.
`,
  },
  faq: {
    title: 'Frequent questions',
    summary: 'Answers to the most frequent questions',
    body: `
**The invitation link does not open for the student.**
Check the portal address: «Settings» → «Portal». The address must open from the internet, not only at your home.

**How to get data back if something was deleted by mistake?**
Restore a backup: «Settings» → «Data» → «Backups» ([more](/teacher/help/backups)).

**A student cannot sign in.**
Check that their access is not turned off. Issue a password reset link: «Students» → the student → «⋮» in the card → «Reset password».

**The invitation link is out of date.**
Issue a new one in the same place — the old one stops working.

**Notifications do not reach the messenger.**
Check «Settings» → «Messengers»: the bot must be connected. The student must connect the messenger in their cabinet themselves. Undelivered messages are there too, in the «Failed deliveries» card (the number next to «Messengers» in the settings list).

**A lesson was marked by mistake.**
Open the lesson and click «Remove the mark» — the charge is undone.

**The student paid, but the debt stayed.**
Check that the payment is recorded for the right student with the right amount: «Payments» → the student's name → «History» on the «Payments» tab.

**How to move all recurring lessons to another time?**
«Schedule» → the «Recurring» tab → «⋮» next to the recurring lessons → «Edit». Future lessons move, past ones stay. «⋮» → «End…» ends the recurring lessons: lessons from today on are removed from the schedule.

**Where to download all the data?**
«Settings» → «Data» → «Backups» → «Back up now» → download the file.
`,
  },
};
