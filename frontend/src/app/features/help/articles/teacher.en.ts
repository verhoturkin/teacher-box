import { HelpArticleText } from '../help.models';
import { TeacherTopic } from '../help-topics';

/** English help, written for teachers alongside the Russian edition. */
export const TEACHER_ARTICLES: Readonly<Record<TeacherTopic, HelpArticleText>> = {
  'first-steps': {
    title: 'Getting started',
    summary: 'Set up your teaching space and invite your first students',
    body: `
Teacher Box brings your students, schedule, assignments, payments and notifications together.

The first time you sign in, [initial setup](/teacher/help/setup) takes you through your password, name, portal address and lesson price.

## Your first four steps

1. **Add a student.** Choose “Create” → “Student”, or “Students” → “Add student” on a phone. Send the invitation link by email or through a messaging app. The student uses it to choose a username and password.
2. **Check the price.** Open the student’s “Profile” tab and set “Lesson price”. This determines how much is charged for their lessons.
3. **Schedule a lesson.** Choose “Create” → “Lesson”. Set “Repeat” to once or every one to four weeks.
4. **Connect a messaging app.** Open “Settings” → “Notifications and messengers” → “Connect”. The wizard helps you create a bot for Telegram, VK or MAX so you can receive reminders and student requests.

The “Getting started” checklist under “To do” on your home page tracks these steps and hides completed ones.

## Your Today page

Your next lesson appears first, with its time, duration, topic, boards and “Start lesson” button. The button changes to “Join lesson” while the lesson is running. Before and during a lesson, the card shows a countdown or the time remaining. After it ends, the next lesson appears automatically.

- **Lessons today** lists the day’s lessons and their status, with the next one highlighted.
- **To do** brings together lessons awaiting an outcome, student requests, submissions to review and outstanding balances. Choose “Completed” or “Missed” to record an outcome; for groups, record attendance. Long lists show a count of additional items.
- **The monthly summary** shows payments received this month and outstanding balances.
- **Week** summarises completed lessons, absences, assignments set and work submitted on time, from Monday to Sunday.

Use “Create” in the sidebar for common actions. On a phone, the + button on Today offers the same choices; other sections have their own action button.

Next: [Students and invitations](/teacher/help/students), [Schedule and requests](/teacher/help/schedule), [Payments](/teacher/help/billing).
`,
  },
  setup: {
    title: 'Initial setup',
    summary: 'Choose your password, portal details and default lesson price',
    body: `
Initial setup opens the first time you sign in. Apart from replacing a generated password, you can skip the steps and return to them later in Settings.

1. **Password:** replace the initial password if the portal generated it. That password was written to the server log, so you must choose your own.
2. **About you:** enter the name students will see and a name for your portal. The portal name appears in navigation, browser tabs, the sign-in page and the calendar.
3. **Address:** enter the public URL students will use, such as https://school.example.com. Invitations, bot links and calendar subscriptions use this address. “Use current address” copies the address you are using now.
4. **Lessons:** set the default price for new students and groups. Individual prices can be changed later.
5. **Finish:** review optional connections, including messaging apps, video meetings and Google Calendar.

## Address warnings

- A localhost address works only on the computer running the portal.
- A home or office network address works only within that network. Students need an address they can reach over the internet.
- An HTTP address sends passwords without encryption. Ask the server administrator to enable HTTPS.

To change details later, use “Settings” → “Portal” for the name, logo and colours, “My account” for your name and photo, and “Settings” → “Payments” for the default price. Contact the portal administrator to change the public address.
`,
  },
  students: {
    title: 'Students and invitations',
    summary: 'Add students, manage their details and control portal access',
    body: `
## Add a student

1. Choose “Create” → “Student”, or “Students” → “Add student” on a phone.
2. Select “Student” and enter their name. Email and phone are optional and visible to you and the student.
3. Copy the invitation link and send it to the student. Their Profile tab opens so you can add a private note, default topic, colour, lesson price and video meeting link.

The student chooses a username and password using the invitation. Links expire after a few days; generate a new one if needed.

## Find a student or group

Students and groups share one list. Search by name or filter by “All”, “Groups” or “Deactivated”. Archived groups also appear under Deactivated.

A student’s entry shows their photo or initials, name, next lesson and balance. Outstanding amounts are highlighted in red. “Invited” and “Deactivated” identify accounts that are not active. Hover over an invitation status to see its expiry date.

Select an entry to open its details on the right. On a phone, details replace the list; use the back arrow to return.

## Student details

The header shows the student’s name, when they joined, connected messaging apps and balance. “Message”, “Payment” and “Lesson” let you contact them, record a payment or schedule a lesson.

- **Overview:** upcoming lessons, outstanding assignments, recent transactions, messaging apps and the video meeting link. If no messaging app is connected, send a connection reminder.
- **Lessons:** individual and group lessons, split into upcoming and past. Recurring lessons are grouped; choose “Show all dates” to expand them. Rescheduled and cancelled lessons appear separately. Past lessons show the outcome and, for groups, the student’s attendance. Upcoming lessons cover the next six months. History loads 20 lessons at a time; choose “Show more” for older entries.
- **Homework:** assignments and their status, with outstanding work first and accepted work below. Select a title to open it.
- **Payments:** balance, total charges, total payments and transaction history. See [Payments](/teacher/help/billing).
- **Profile:** name, email, phone, private note, default topic and colour. Save these fields together. The lesson price has its own Save button; video meeting changes apply immediately. “Portal access” shows the read-only username and invitation or reset link details.

You always see the name you entered for the student, even if they choose a different display name for their account.

## Invitations and access

Open the student’s Profile tab to manage access:

- **New invitation** creates another link before the student has activated their account.
- **Reset password** creates a reset link for an existing account.
- **Deactivate account…** prevents sign-in while keeping lesson, payment and homework history.
- **Restore access** lets a deactivated student sign in again.

## Student colours

Choose one of ten colours, or “No colour”, on the Profile tab. The colour marks avatars, calendar lessons and selection chips throughout your view of the portal. Students do not see it.

Scheduled lessons use the student’s colour. Completed, missed and cancelled lessons use their status colour, with the student’s colour as a stripe along the edge.

For shared teaching, see [Groups](/teacher/help/groups). Boards are under [Materials](/teacher/help/boards).
`,
  },
  groups: {
    title: 'Groups',
    summary: 'Teach several students together and manage their shared lessons',
    body: `
A group brings together students who attend the same lessons. Its lesson price is charged separately to each member.

## Create and manage a group

1. Choose “Create” → “Student”, or the add button in Students on a phone, then select “Group”.
2. Enter a name, select the students and choose “Create”.
3. Set the price per student on the group’s Profile tab. You can also add a default topic and colour.

Groups appear in the Students list with a group icon, member count and next lesson. Use the Groups filter to find them.

Select a group to open its details. “Message” contacts every member and “Lesson” schedules a group lesson. The ⋮ menu contains “Archive” or “Restore from archive”.

- **Overview:** upcoming lessons and the room link.
- **Lessons:** upcoming and past group lessons and their outcomes.
- **Homework:** members’ assignments, with each student’s name and status.
- **Members:** add or remove students. Select a name to open that student’s details.
- **Profile:** name, default topic, colour, price per member and video meeting link.

## Attendance and membership

Choose the group when scheduling a lesson. All members will see it. After the lesson, record who attended and who missed it. Students who attended or were absent without notice are charged. Students who reported an absence in advance are not charged.

Membership changes apply to upcoming lessons. Past lessons keep their original participants.

Archive a group when you stop teaching it. Upcoming lessons are cancelled and the history is kept. Find archived groups under the Deactivated filter.
`,
  },
  schedule: {
    title: 'Schedule and requests',
    summary: 'Schedule lessons, set time off, record outcomes and respond to requests',
    body: `
## Schedule a lesson

Choose “Create” → “Lesson”, or “Schedule” → “Lesson” on a phone. Select a student or group, date, time and duration. A title, topic and video meeting link are optional.

If the title is blank, the student or group’s name is used. A default topic from their Profile tab fills the title when you select them; you can change or clear it. The separate Topic field describes that particular lesson and is not copied across a recurring schedule.

Set “Repeat” to once or every one to four weeks. The selected date determines the weekday. An end date is optional. By default, you can see the next 12 weeks of recurring lessons; later dates appear automatically.

## Use the calendar

On a computer, choose a week or month view and use the mini calendar to jump to another day. Student requests and time off appear beside it. Filter lessons by student or group above the calendar; additional filters appear under “N more”.

On a phone, the schedule starts in agenda view with a week strip and the selected day’s lessons. Switch to Week, Month or Time off above the calendar.

Drag a lesson to suggest a new time, then choose “Reschedule” to save or “Undo reschedule” to put it back. The portal warns about conflicts before saving. In month view, selecting an empty day opens a lesson form at 10:00 with the default duration; adjust both as needed.

## Time off

Open “Time off” to mark a one-off period, such as a holiday, or weekly hours, such as lunch breaks and days off. Weekly periods can have start and end dates. Use 00:00–00:00 for a whole day.

Time off is hatched in the calendar. Edit or delete it from its ⋮ menu. Private labels, such as “Lunch”, are visible only to you.

Students see these periods as “Busy” and cannot request a lesson then. They cannot see your labels or other students’ details. You can still schedule a lesson during your own time off.

## Record outcomes and attendance

Open a lesson and choose “Completed” or “Missed”. The outcome is saved immediately and the lesson is charged accordingly. For groups, choose “Mark attendance” and record each student’s attendance.

An Undo message appears for six seconds after recording an outcome. Choose “Undo” to reverse the outcome and its charge. You can also select the same outcome again to clear it, or select another to change it. For groups, use “Clear outcome” in the ⋮ menu.

Past lessons without an outcome are outlined in red. You can record outcomes from the calendar, the phone agenda or “To do” on your home page.

## Share a lesson summary

Once a lesson has started, add a summary in its details. Summaries are unavailable for cancelled lessons and individual lessons marked Missed.

“What we covered” is visible to the lesson’s students and initially shows the lesson topic. “Next lesson topic” fills the next lesson’s topic if that field is empty. “Save” keeps your changes; “Send to student” or “Send to students” also sends a Lesson summary notification.

If AI is enabled, “Generate draft” uses the lesson topic, assignments and your notes to suggest a summary. Review it before sending. Completed lessons with summaries appear in the student or group’s lesson history. In the bot, choose “Add summary” after recording a completed lesson.

## Cancel, restore or delete

Use “Cancel lesson…” in the lesson’s ⋮ menu to enter a reason, say whether the student requested it and decide whether to charge. The lesson remains in the calendar, crossed out, and the student is notified. “Restore” reinstates it and notifies the student again; a conflict warning appears if the time is now occupied.

Deleting removes a lesson from the schedule, calendars and reports. Only scheduled or cancelled lessons can be deleted; clear a completed or missed outcome first. Deleting an upcoming scheduled lesson sends a cancellation notification.

When editing, cancelling or deleting a recurring lesson, choose “Only this lesson” or “This and future lessons”. The portal shows how many lessons will change. The boundary follows the original date, even if a lesson has been rescheduled. Completed, charged, cancelled and individually edited occurrences are preserved. Deleted occurrences are not generated again.

## Respond to student requests

Students can request a reschedule or cancellation in the portal or bot. Requests appear in “Student requests” and arrive as notifications with “Approve” and “Decline” buttons. In the portal, open a request to respond.

- **Reschedule:** approve the suggested time or enter another. The portal warns about lessons, time off or Google Calendar events at that time; you can choose to proceed.
- **Late cancellation:** decide whether to mark the lesson as missed and charge for it.
- **Decline:** include a reply, for example to suggest another time.

A group member’s advance notice that they cannot attend is approved automatically.
`,
  },
  calls: {
    title: 'Calls',
    summary: 'Run video lessons in the portal with permanent student and group rooms',
    body: `
Each student and group has a permanent call room. Calls run in the browser without installing an app. Check availability under “Settings” → “Calls”; room links appear in student and group details.

## Join a call

Choose “Start lesson”, follow a room link or open a reminder. In the preview, check your camera and microphone, choose devices or turn them off, then select “Join”. Allow camera and microphone access when your browser asks.

## Call controls

- **Microphone and camera:** turn either on or off. A red, crossed-out control means it is off.
- **Your preview:** in a two-person call, drag your camera preview to another corner. The portal remembers the position.
- **Share screen:** on a computer, share a window, browser tab or entire screen.
- **Settings:** change devices or adjust echo cancellation, noise suppression and automatic gain control. These are on by default; try turning them off if audio sounds clipped or muffled. Your choices are saved.
- **Connection details:** inspect each participant’s connection quality, protocol, ports, delay and audio loss. Share these details with the administrator when investigating poor audio.
- **Minimise:** keep the call in a small movable window while using boards, assignments or other portal pages. On a phone it becomes a bar above the bottom navigation. “Expand” restores the full window.
- **Leave call:** leave using the red button.

## External meeting links

An external link, such as Telemost or Zoom, takes precedence over the portal room. To use portal calls again, remove it from the student or group’s Profile tab under “Video meeting”. See [Video meetings](/teacher/help/meetings).

The administrator must configure the call server before portal calls are available.
`,
  },
  meetings: {
    title: 'Video meetings',
    summary: 'Use an external video service for a student or group',
    body: `
You can give a student or group a permanent Telemost, Zoom or other meeting link. Lessons, reminders and “Join lesson” will use it instead of the built-in [call room](/teacher/help/calls).

## Add or remove a link

Open “Students”, select the student or group, then open “Profile” → “Video meeting”. Create a meeting in your video service, paste its link and choose “Add link”. Changes in this section are saved immediately.

“Send to student” sends the link to the student’s account and connected messaging app. Without an external link, it sends the portal room link. Remove the external link to return to portal calls.

## Open a meeting

Choose “Start lesson” in the lesson details. On Windows, Telemost can open in its app. Use the arrow beside the button to choose “Open in browser” instead. This preference is saved on your computer and can be changed under “Settings” → “Calls” → “Video meetings”.

You can override the permanent link for a single lesson in its details.
`,
  },
  boards: {
    title: 'Boards',
    summary: 'Create shared boards, draw together and add lesson materials',
    body: `
Open “Materials” → “Boards” to see your boards. Search by title, student or group, filter by “All”, “In the portal” or “External”, and change the sort order.

- **Excalidraw boards** run in the portal, support live collaboration and save automatically.
- **External boards**, such as [Holst](https://app.holst.so), are links to another service and open in a new tab.

## Create and share a board

1. Choose “Create” → “Board”, or “Materials” → “New board” on a phone.
2. Choose a type and enter a title. For an external board, paste its link and enable link sharing in that service.
3. Select students and groups. Remove a selection chip to revoke that selection. All current group members can access a shared group board; students who leave the group lose that access.

Board cards show a preview, title, recipients and last update. Select a card to open it. Use its ⋮ menu to edit or delete it. Deleting an Excalidraw board also deletes its content, images and board backups. Lesson cards link to the relevant student or group’s boards.

## Draw together

An Excalidraw board opens full screen. Participants see each other’s drawings, cursors and names live. If two people edit the same shape, the latest change wins. Images load gradually so you can start drawing immediately.

The top status shows “Saved”, “Saving…” or “Offline — reconnecting…”. If the live connection drops, the portal retries and checks for changes periodically.

The board menu (☰) contains:

- **Theme:** Light, Dark or System, shared with the portal theme setting;
- **Grid:** visible to everyone on this board;
- **Mouse wheel:** Zoom, or Scroll (touchpad). In scroll mode, pinch or use Ctrl to zoom. This preference is saved on your device.

Use “Back” to return to the page you came from, or “Back to boards” after opening a direct link. The portal waits for unsaved changes and the preview to be saved before returning. If you are offline, it asks whether to leave without saving. Closing the browser or tab may interrupt saving.

## Reuse shapes

Select shapes, right-click and choose “Add to library”. Open the library at the top right and drag saved shapes onto any board. Each user has a separate library, available across their devices. To import an .excalidrawlib file, use the library’s ⋯ menu → “Open”. The external library catalogue is not available within the portal.

## Board backups

Changed boards are backed up daily; the last seven daily backups are kept. Before major edits, open “Backups” from the board menu or card’s ⋮ menu and choose “Make a backup”. You can keep up to 20 manual backups per board.

Restoring a backup saves the current board first, so you can restore it later. Students with the board open see the restored content automatically.

## Add materials to a board

Choose “Add to board” from an assignment, its editor or a submission review. Search for a board and choose “Text” for editable text or “Image” for a fixed rendering, useful for formulae and tables. Assignments offer boards shared with their students or groups.

Excalidraw boards open in a new tab with the material already added. An assignment is placed in a frame with its title and today’s date, followed by attached images and textbook pages. PDF and Word attachments remain on the assignment page.

For external boards, the material is copied to the clipboard. Paste it with Ctrl+V, or Cmd+V on a Mac. Copying images requires HTTPS.

You can also add [textbook pages](/teacher/help/textbooks) from Materials or an attached textbook. Pages are arranged in a framed row on an Excalidraw board.
`,
  },
  homework: {
    title: 'Homework',
    summary: 'Create assignments, review submissions and give feedback',
    body: `
## Create an assignment

1. Choose “Create” → “Assignment”, or “Homework” → “New assignment” on a phone. A quick dialog opens so you can assign work in a minute; “Open full screen” (or “Quiz”) carries everything you have entered into the full editor.
2. In the dialog, choose who gets the assignment and write the text; its first line becomes the title. Set the due date with “By the next lesson”, “In a week”, “No deadline” or “Pick a date…”. Add textbooks, files, videos or a board with the buttons under the text, and use “Save draft” to keep the assignment unassigned; the students you chose are remembered and already ticked when you choose “Add” on the draft’s page. The full editor follows the same order: recipients, text, due date, materials. Markdown supports bold text, lists and links; use Preview to check the result.
3. Under “To”, add students and groups. Students in more than one selected group receive the assignment once. Removing a group keeps any students also selected individually. “By the next lesson” sets the due date to the start of those students’ next lesson; pick another option if you prefer.
4. Textbooks, files, videos, a quiz and a board appear in the assignment only once you add them: use the buttons under “Materials”. Textbooks and files show as cards; select a name to open it (PDFs and images open in a new tab). You can remove anything you added, and empty sections take up no room.
5. For a video, use “Video” (up to five). YouTube, Rutube and VK videos play within the assignment; other links open in a new tab. Import YouTube captions, import an .srt or .vtt file, or enter a transcript yourself. If several caption tracks are available, choose the language and track you need. The AI uses the transcript; students see it only if “Show transcript to students” is enabled.
6. Choose “Assign”. Students are notified once the materials are ready and reminded before the due date. “Save draft” keeps the assignment with you.

“Assign and add to board” creates the assignment, then lets you place its text, images and textbook pages on a board. The assignment remembers the board and gives students a “Go to board” button. “Add to board” on the assignment page has the same effect.

## Manage assignments

“Edit” opens the editor for the instructions (their first line is the title), videos, quiz and due date. Update the textbooks and files of a saved assignment on its details page. The portal checks before discarding unsaved changes.

“Make a copy” creates a draft with the original text, files, textbooks and videos, but no recipients or due date. The editor opens so you can adapt it.

The Homework page lists assignments on the full width. Search by assignment title or student name, and use “For” to select a student or group. Search and “For” are kept in the page address.

- **Active:** assignments with work still outstanding, grouped by due date: Overdue, This week, Later and No due date.
- **Drafts:** assignments you have not given to anyone yet.
- **Done:** assignments with all submissions accepted. Use “Show more” after the first 20.

Each row shows the materials in the assignment (textbooks, files, questions, videos, board), who it is for, the due date, how many submissions are in and the status. On a phone the table becomes cards and the views become chips.

Select an assignment to open it on its own page; the arrow returns you to the list.

## The “By student” view

The “List · By student” switch at the top of the Homework page shows a whole week at once: students are the rows and the assignments due that week are the columns. The arrows next to the dates move between weeks, and “For” narrows the grid to one student or group. The colour of a cell tells you what to do: green is accepted (with the grade), yellow is waiting for your review (a quiz shows its score), red is overdue or sent back, grey means the student has not handed it in yet, and a dashed cell means the assignment was not given to them. The last column counts the work handed in.

Select a yellow cell to review that piece of work, or a dashed one to open “Assign to more students” with the student already chosen. Any other cell, or a column title, opens the assignment. The view you pick is kept in the page address.

## Assignment details and textbooks

The page contains the instructions, videos, files, textbooks and student progress. Open or download a file from its row; remove files or textbooks with the cross button. Choose “Add” in the Students section to assign the work to more students or groups.

Use “Attach a textbook” to select a resource and pages, such as 12-14, 20. Leave pages blank for the whole textbook. Students can access the assigned pages even if the full textbook is not shared with them. Word documents are downloaded in full, with page numbers provided for reference. The pencil changes the pages; the cross removes the attachment. See [Textbooks](/teacher/help/textbooks).

“Open board” opens a linked board. “Delete…” removes the assignment, submissions and files; recovery requires a portal backup.

## Add a quiz

In the editor, choose “Quiz” under “Materials” to add the Questions section; “Remove” takes it out again. It supports six types:

- **Single choice** and **Multiple choice:** mark the correct options.
- **Short answer:** list accepted answers. Capitalisation, extra spaces and the difference between ё and е are ignored.
- **Number:** enter a correct answer and an optional tolerance.
- **Matching:** enter pairs; the right-hand column is shuffled for students.
- **Ordering:** enter the correct order; students receive shuffled items.

Each question has points and an optional explanation. Matching and ordering award all points or none. In “Quiz settings”, choose when answers are revealed and how many attempts are allowed. The best attempt counts. Once a student starts the quiz, questions are locked; the rest of the assignment remains editable.

The AI assistant can draft questions. Select Questions under “What to prepare”, then append the draft or replace all questions. Review and save the assignment yourself.

Reviews show the best quiz attempt, incorrect answers first, with an answer key. Use “Mark correct” or “Mark incorrect” to override automatic marking. The score fills the grade field unless you enter a grade yourself. “Mistakes by question” on the assignment page highlights common errors. A completed quiz is enough for a student to submit the assignment for review.

## Review a submission

Submissions waiting for review sit in the “To review” strip at the top of the Homework page: each card shows the student, the assignment, when it was handed in, a “Late” tag and the quiz score. “Review” opens a submission; “Review them all” starts with the oldest and moves on to the next after each decision. You will see the assignment, the student’s response and attached images. “Open on the board” opens the assignment’s board.

Add feedback and a grade, then choose “Accept” or “Return for revision”. Quick comments help with common responses. “Next: …” opens the next submission after your decision. If AI is enabled, “AI draft” suggests feedback and a grade; review them before choosing “Insert”.

On wide screens the review form sits beside the submission. On a phone, use the bottom toolbar; feedback, grades and AI drafts open in a bottom panel. Existing direct links to submissions and the review queue still work.
`,
  },
  textbooks: {
    title: 'Textbooks',
    summary: 'Upload resources, share them with students and use selected pages',
    body: `
“Materials” → “Textbooks” stores textbooks, workbooks and other resources, with one file per entry. Supported files are PDF, Word (DOC or DOCX) and images, up to 100 MB.

## Add a textbook

1. Choose “Create” → “Textbook”, or open the Textbooks tab and choose “New textbook”.
2. Select a file. The filename provides an initial title; edit it as needed.
3. Choose Textbook, Workbook or Other, and optionally enter a course. Existing course names are suggested.
4. PDF pages are counted automatically and an image counts as one page. You can enter a page count for a Word document.
5. Select students and groups to share it with. Remove a chip to deselect a recipient, or clear the selection. Group sharing includes all current members.

## Open and manage resources

Search by title and select a resource to open it. PDFs and images open in the browser; Word files download. The ⋮ menu provides:

- **Download:** save the original file.
- **Edit:** change its type, title, course, Word page count and sharing.
- **Add to board:** place PDF pages or an image on an Excalidraw board. Enter a range such as 12-14, up to 30 pages at once. Pages appear in a frame to the right of existing content; move the frame to move them together. Word documents cannot be added this way. From an assignment, only its students’ boards are offered; from Textbooks, you can choose any board.
- **Replace file:** upload a corrected version. PDF pages are counted again.
- **Delete…:** remove the textbook and its file, including its attachments to assignments.

Students find shared resources under Materials and can download them. For assignment-specific page access, see [Homework](/teacher/help/homework).
`,
  },
  ai: {
    title: 'AI assistant',
    summary: 'Draft assignments, quiz questions, feedback and lesson summaries',
    body: `
The AI assistant produces drafts for you to review. You decide what to save and send.

## Create a draft

In the assignment editor, open “AI assistant” and describe what you need. Choose “Generate”, then review the result. “Replace” uses the draft title and text; “Append” adds the text after your own; “Discard” dismisses it; “Regenerate” requests another version. Drafts are not saved automatically.

On wide screens, the assistant opens beside the editor. On smaller screens it opens in a dialog. Closing it or resizing the window preserves your instructions, selected sources and draft. The Text/Preview switch changes the view of the same Markdown field.

## Choose source materials

Use “Source materials” to select attached textbook pages, PDFs and images: up to five files and 20 pages at once. Files selected for a new assignment can be used before saving it. Word documents are not supported as sources.

Videos with transcripts are also available as sources. The AI reads the transcript, rather than watching the video, and can refer to timestamps such as [1:05]. Import YouTube captions or upload a transcript first if the video is not listed.

Select “Questions” under “What to prepare” to draft quiz questions. Review them in the editor before saving.

## Reuse prompts and draft feedback

Open “Prompts” to find saved instructions. “Save as prompt” adds your current instructions to the library. Rename, edit or delete entries under “Settings” → “AI assistant” → “Prompt library”, or use “Manage prompts”.

When reviewing a submission, “AI draft” suggests feedback, a grade and whether to accept it or request revisions. Check the suggestion before inserting it. Lesson summaries also offer AI drafts in the lesson details.

## Customise system prompts

Open “Settings” → “AI assistant” → “System prompts”. Edit the instructions for assignment or review drafts to set the tone, language and structure you prefer. Saved overrides are marked “Custom” and apply to future drafts.

The portal handles the response format and sends assignment and student response content separately. “Restore default” removes your custom instructions.

## Usage and limits

The AI settings show your model, tokens used this month and remaining allowance. Recent requests show the result, time, model, token count and any error. The latest ten appear first; choose “Show more” for other requests this month. Once the monthly allowance is exhausted, AI actions become unavailable until the next month.

The portal administrator configures the provider, such as Claude, Gemini, DeepSeek, OpenRouter or another supported service. Ask them to enable AI if the assistant is unavailable.
`,
  },
  billing: {
    title: 'Payments',
    summary: 'Track balances, record payments and review monthly totals',
    body: `
## How balances work

Completed lessons and absences without notice are charged at the student or group’s lesson price. Recorded payments add to the balance.

- **Credit:** money paid towards future lessons.
- **Outstanding balance:** the amount still due for lessons already charged.

## Payments overview

Use the arrows beside the month to move through your history. The summary shows payments received, lesson charges, outstanding balances and credit.

Transactions list payments, lessons and absences. A payment adds to the balance; a charge reduces it; an excused absence has no charge. Filter by All, Payments, Lessons or Absences, and optionally choose a student. The month and filters are kept in the address, so reloading or going back preserves them.

“By student” lists outstanding balances with “Send reminder”, students whose credit covers two lessons or fewer, and weekly payment totals. Select a name to open their Payments tab, or choose “View all students”. On a phone, these sections appear below the monthly figures.

## Record a payment

Choose “Create” → “Payment”, the Payment button in a student’s details, or “Payments” → “Payment” on a phone. Enter the student, amount, date and an optional comment. If you record a payment incorrectly, void it from the student’s Payments tab.

## Attach a receipt

A payment can include an image or PDF receipt up to 10 MB. Attach it in the payment form, or later using the paperclip beside the payment in the student’s history. You can replace or remove it there too. The student can open the receipt from their own payment history.

You can also send a receipt to the bot. It asks for the student and amount, then records the payment with the receipt attached. See [What the bot can do](/teacher/help/bot).

## Lesson prices and history

Change a student or group’s price on their Profile tab. Past lessons keep the price they were charged at.

The Payments tab shows balance, total charges, total payments and history. Use the cross beside a transaction to remove a lesson charge or void a payment. The record remains in the history. The latest 20 entries appear first; choose “Show more” for older entries.

For a lesson outside the schedule, add it with its original date and mark it Completed, or use “Add a lesson” in the bot.

## Monthly report

Choose “Monthly report” for income, completed lessons and totals by student. “Download CSV” exports the month’s full ledger for a spreadsheet application.
`,
  },
  notifications: {
    title: 'Notifications and bots',
    summary: 'Read notifications, connect messaging apps and message students',
    body: `
The bell at the top of the page opens notifications. Its badge counts unread items. On wide screens the panel stays beside your work while you move between pages; on smaller screens it opens over the page.

## Inbox and sent messages

- **Inbox:** new notifications appear first. Opening one or marking it as read moves it to the expandable Read group. Choose “Mark all as read” to clear the unread list. On a phone, swipe an item left or right to mark it as read.
- **Sent:** messages you have sent to students, with the date and recipient count. Choose “Message students” to write another.

Close the panel with ×, Esc or the bell. On smaller screens it also closes when a notification opens another page. Existing links to Notifications open this panel.

## Connect messaging apps

Open “Settings” → “Notifications and messengers” → “Messenger bots” and choose “Connect” beside Telegram, VK or MAX. The wizard walks you through creating a bot, checks the connection and sends a test message.

Choose the app your students use; one is enough. Students connect their own accounts under “My account”. The “Students’ messengers” card shows connections and failed deliveries. Send a reminder to selected students or everyone who has not connected an app.

## Message students

Choose “Create” → “Message”, or open the bell → “Sent” → “Message students”. Write your message and choose all students, individual students or groups. The message form opens over your current page and the result appears in Sent.

## Notification preferences

All notifications appear in the portal. In “Notification preferences”, choose which topics also reach your devices and messaging apps. During quiet hours, those deliveries wait until quiet hours end.

New server notifications and bot replies use each recipient’s account language. Existing notifications keep their original text.

## Device notifications

Under “Device notifications”, choose “Turn on notifications on this device” and allow browser notifications. Enable this separately on each device and browser. These notifications work even when the portal is closed and can be used alongside messaging apps. “Turn off” removes a device.

On iPhone and iPad, add the portal to the Home Screen first using Share → Add to Home Screen, then open it from that icon. HTTPS and a supported browser are required. The portal explains when notifications are unavailable.

Delivery uses Google, Mozilla or Apple services, with content encrypted using the device key. Your topic preferences and quiet hours apply to both device and messaging app notifications.

The bot also supports [actions from the chat](/teacher/help/bot).
`,
  },
  bot: {
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

Students can view their schedule, join a lesson, open boards, request a cancellation or reschedule, report a group absence, check requests and view payments.

## Using the bot

The bot asks for confirmation before changing data. Choose “Cancel” or send /cancel to stop at any point. Search for students using part of their name. Enter times as 18:30 and dates as 05.10.

Notification buttons open the relevant portal page or lesson. Where link buttons are unavailable, the bot sends a text link instead.

## Disable teacher actions

If someone else can access your messaging account, turn off “Allow teacher actions in the bot” under “Settings” → “Notifications and messengers” → “What the bot can do”. You will still receive notifications.

VK communities need “Bot features” enabled for buttons to work.
`,
  },
  calendars: {
    title: 'Calendars',
    summary: 'Subscribe to your schedule or connect Google Calendar',
    body: `
## Calendar subscriptions

Open “Settings” → “Schedule and calendar” → “Calendar subscription” and choose “Get subscription link”. Add the link as a subscription in your phone or computer’s calendar app. Lessons update automatically.

Keep this link private: anyone with it can view the schedule. Generate a new link if it has been shared accidentally; the previous one stops working.

Students can create their own subscription links, which include only their lessons.

## Google Calendar

Open “Settings” → “Schedule and calendar” → “Google Calendar” and connect your account. Portal lessons appear in a separate calendar in Google Calendar. The portal also shows when you are busy with other Google Calendar events so you can avoid scheduling conflicts.
`,
  },
  settings: {
    title: 'Settings',
    summary: 'Manage your portal, integrations, prices, AI and backups',
    body: `
Open Settings from the sidebar or the ☰ menu on a phone. Select a category to open it beside the list; on a phone, use the back arrow to return. Each category has its own address and can be bookmarked.

- **My account:** your photo, display name, password, theme and language. You can also open it by selecting your name in navigation.
- **Portal:** name, logo and appearance. See [Appearance](/teacher/help/appearance).
- **Schedule and calendar:** portal time zone, Google Calendar and subscriptions. See [Calendars](/teacher/help/calendars).
- **Calls:** built-in [calls](/teacher/help/calls) and [external video meetings](/teacher/help/meetings).
- **Notifications and messengers:** device notifications, bots, account connections, student connections and notification preferences. Failed deliveries appear first when present; the administrator can retry them. See [Notifications and bots](/teacher/help/notifications).
- **Payments:** default lesson price for new students and groups. See [Payments](/teacher/help/billing).
- **AI assistant:** model, monthly usage, recent requests, prompt library and system prompts. See [AI assistant](/teacher/help/ai).
- **Data:** scheduled and manual backups, downloads, restoration, Google Drive storage and full reset. See [Backups](/teacher/help/backups).

The portal asks before you leave settings with unsaved changes. File size and type are checked as soon as you select a file.

The portal address is entered during initial setup. Contact the administrator to change it later.
`,
  },
  appearance: {
    title: 'Appearance, language and mobile use',
    summary: 'Choose your portal’s appearance and use it comfortably on any device',
    body: `
## Portal branding

Open “Settings” → “Portal” to change the name, logo and appearance. Preview shows your choices before saving; on a wide screen it appears beside the settings.

- **Colour:** choose a base colour or “Custom colour”. Use the swatch to open the colour picker, or enter a HEX code such as #0f766e. Buttons, links and highlights use shades of this colour. The portal adjusts shades for readable contrast and warns if a colour needs a large adjustment or resembles delete buttons.
- **Colour scheme:** choose a style from the gallery, from Original to Monochrome.
- **Contrast:** choose Lower, Standard, Higher or Maximum. Text remains readable at every level.
- **Preview:** check the light and dark themes. Save applies the appearance to everyone; Cancel restores the saved values.
- **Logo:** upload a PNG, JPEG, WebP or SVG up to 1 MB. It appears in navigation, on sign-in and in the browser tab. Use the bin to restore the default icon. Logo changes apply immediately.

## Personal theme and language

Select your name → “Appearance” to choose Light, Dark or System. This preference is saved on your device; each student chooses their own theme.

Choose Русский or English in the same section. The portal reloads in that language and saves the choice on the device and account. Language buttons are also below the sign-in and invitation cards.

New notifications, bot replies and calendar subscriptions use the recipient’s language. Existing notifications keep their original text. Student names, topics and messages remain as entered.

## Use the portal on your phone

The portal works in the browser. In Chrome on Android, choose the browser menu → “Add to Home screen” → “Install” to open it in its own window with your name and logo. Android may take time to refresh app colours after a theme change.

On a phone, use the bottom navigation for Home, Schedule, Homework, Students and Payments. Open ☰ for Materials, Settings and Help. The current section is highlighted. On larger screens, sections appear in a sidebar, with Create near the top and Settings and Help near the bottom.

The main action, such as “Add student” or “New assignment”, appears at the bottom right on phones. Forms with several fields open full screen with Save or Create at the top. Lesson details open in a bottom panel and confirmations in a dialog. Use the back arrow on detail pages to return to the list.

## Find things quickly

Use the search at the top to find students, groups, assignments, boards and textbooks. It searches lists already loaded in this session and groups matching results. Use ↑ and ↓ to select a result, Enter to open it and Esc to close search. Ctrl+K, or ⌘+K on a Mac, opens search from any page. On a phone, use the magnifying glass.

The bell opens notifications. Help is available through ? beside page or section headings, or under ☰ on a phone.

## Forms and keyboard access

Field labels remain visible while you type. Required fields have an asterisk. If a value is invalid, the portal explains below the field and focuses the first error when you save. Closing an edited form asks “Discard changes?”: choose Discard to leave or Cancel to keep editing.

If content fails to load, choose Retry. Confirmation dialogs explain the action before you commit it; red buttons are used for deletion. Cancel closes a dialog without applying its action.

Use Tab to move through controls and Esc to close dialogs and panels. A visible focus outline shows where you are, and focus returns to the control that opened a dialog. Browser text-size settings enlarge the text.
`,
  },
  backups: {
    title: 'Backups and full reset',
    summary: 'Protect your data, restore a backup or clear the portal',
    body: `
The portal backs up its database and files every night, including students, lessons, payments, assignments and current board content. Individual board backups are excluded: after restoring a portal backup, each board has only its saved current content.

## Create and download a backup

Open “Settings” → “Data” → “Backups” and choose “Back up now”. Use a backup’s ⋮ menu → “Download” to keep a copy away from the server.

Each entry shows its date, type, size and Google Drive status. Scheduled, manual, pre-restore and pre-reset backups are all subject to the retention period. The default is two weeks; the administrator can change it. Older backups are removed after a new one is created.

## Connect Google Drive

Open “Settings” → “Data” → “Google Drive”. Set up a Google OAuth client once; the panel includes instructions and your redirect URL.

1. In [Google Cloud Console](https://console.cloud.google.com/), create and select a project using the account that will store the backups.
2. Under “APIs & Services” → “Library”, enable Google Drive API.
3. Open “Google Auth Platform” → “Get started”. Enter the app name, support email and contact email, choose an External audience, accept the policy and create the configuration.
4. Under “Data Access”, add the .../auth/drive.file scope and save.
5. Under “Audience”, publish the app. Otherwise access expires after seven days. This scope does not require Google verification.
6. Under “Clients”, create a Web application client. Add the redirect URL from the portal under “Authorized redirect URIs”.
7. Copy the Client ID and Client secret into the portal’s Google Drive panel and save. The secret is shown only once.

Choose “Connect Google Drive” and grant access. The portal creates a folder named after your portal and uploads scheduled and manual backups. It can access only files it creates. Retention matches the server; pre-restore and pre-reset backups remain on the server only.

Use “Send to Google Drive” in a backup’s menu to upload it manually. The Drive panel shows the latest upload and any error.

If the server is lost, install the portal again, connect the same Drive account and choose “Download to server” beside a cloud backup. Once it appears in the server list, restore it.

## Restore a backup

1. Open its ⋮ menu and choose “Restore…”.
2. Read the warning: the backup replaces all current portal data.
3. Enter your password and confirm.

The portal creates a backup of its current state, restarts and shows the result after about a minute. Keep the page open. Afterwards, sign in with the password in use when the restored backup was created. If restoration fails, the current data is kept and an error explains why.

## Full reset

“Settings” → “Data” → “Full reset” removes students, groups, lessons, payments, assignments, notifications, connections and portal details. Teacher and administrator accounts, their passwords, existing backups and the backup connection to Google Drive are kept.

Choose “Reset all data…”, then enter your password and RESET. A backup is created first, so you can recover the data if needed. Initial setup opens again afterwards.

If asked to remove a leftover Google Calendar, delete the portal calendar in Google Calendar manually.
`,
  },
  faq: {
    title: 'Frequently asked questions',
    summary: 'Quick answers to common sign-in, payment and scheduling questions',
    body: `
**A student cannot open their invitation.**
Check the public portal address. It must be reachable over the internet, not just on your home network. Contact the administrator if it needs changing.

**The invitation has expired.**
Open the student’s Profile tab and create a new invitation. The old link stops working.

**A student cannot sign in.**
Check that the account is active. If needed, send a reset link from “Students” → the student → “Profile” → “Reset password”.

**How do I recover something deleted by mistake?**
Restore a [backup](/teacher/help/backups) from “Settings” → “Data” → “Backups”.

**Messaging app notifications are not arriving.**
Check the bot connection under “Settings” → “Notifications and messengers”. The student must also connect their own messaging account. Check Failed deliveries for rejected messages.

**I recorded the wrong lesson outcome.**
Open the lesson and select the active outcome again to clear it and reverse the charge. For a group, use “Clear outcome” in the ⋮ menu.

**A student paid, but still has an outstanding balance.**
Check that the payment was recorded for the correct student and amount. Open their Payments tab and review the history.

**How do I reschedule all recurring lessons?**
Open a lesson, choose Edit and “This and future lessons”, then change the date and time. Choose Once to stop repetition: the selected lesson stays and untouched later occurrences are removed. Completed, charged and individually edited lessons are preserved.

**How do I download all my data?**
Choose “Settings” → “Data” → “Backups” → “Back up now”, then download the backup.
`,
  },
};
