import { HelpArticleText } from '@features/help/help.models';

export const homeworkArticle: HelpArticleText = {
  title: 'Homework',
  summary: 'Create assignments, review submissions and give feedback',
  body: `
## Create an assignment

1. Choose “Create” → “Assignment”, or “Homework” → “New assignment” on a phone. The editor opens with just the essentials: recipients, the text, the \
due date and the material buttons.
2. Choose who gets the assignment and write the text; its first line becomes the title. Set the due date with “By the next lesson”, “In a week”, “No \
deadline” or “Pick a date…”. Add textbooks, files, a photo, videos, a quiz or a board with the buttons under “Materials”. As soon as you start \
typing, the assignment saves itself as a draft with the students you chose; if you leave without writing anything, nothing is created. Markdown \
supports bold text, lists and links; use Preview to check the result. The “AI assistant” button opens the assistant beside the text.
3. Under “To”, add students and groups. Students in more than one selected group receive the assignment once. Removing a group keeps any students \
also selected individually. “By the next lesson” sets the due date to the start of those students’ next lesson; pick another option if you prefer.
4. Textbooks, files, videos and a board appear in the assignment only once you add them. Add textbooks and files with the buttons under “Materials”; \
they show as one list. Select a name to open it (PDFs and images open in a new tab). Add a video or a board from the “Add” group in the menu on the \
left (on a tablet, or with the AI assistant open, use the “Video” and “Board” buttons under “Materials” instead). “Board” opens a list of your \
boards: the one you choose shows in the Board section (the × clears it), and once the assignment is given out the “Add to board” window opens with \
that board selected. A quiz is not a material: add questions on the Quiz tab. You can remove anything you added, and empty sections take up no room.
5. For a video, use “Video” (up to five) and paste a link: the video appears as a tile. YouTube, Rutube and VK videos play within the assignment; \
other links open in a new tab. Students see the videos in the order of the tiles, so drag them to reorder. Each tile shows whether it has a \
transcript and whether students can see it. Select the settings button on a tile to open the video in a window over the editor (full screen on a \
phone). There you can rename the video, import YouTube captions (if several tracks are available, choose one from the menu), load an .srt or .vtt \
file, edit the transcript or remove the video. The arrows move between the assignment’s videos without closing the window. Changes are saved straight \
away, so “Done” and Esc just close it. The AI uses the transcript; students see it only if “Show transcript to students” is enabled.
6. Choose “Assign”. Students are notified once the materials are ready and reminded before the due date. You return to where you opened the editor \
(the list or the assignment); “Open” in the “Assignment created” message takes you to the assignment. There is no separate draft button: once the \
assignment has a title, the draft saves itself a couple of seconds after each change, and the header shows when it was last saved. You can leave the \
editor at any time without losing anything.

“Assign and add to board” creates the assignment, then lets you place its text, images and textbook pages on a board. The assignment remembers the \
board and gives students a “Go to board” button. “Add to board” on the assignment page has the same effect.

## Manage assignments

“Edit” opens the editor. It has two tabs: Instructions, for recipients, the due date, the text and materials; and Quiz, for the questions and quiz \
settings. On a phone these are Instructions, Questions and Settings. If the assignment has a quiz, Instructions shows a summary: the first questions, \
the number of questions, points and attempts, and “Open quiz”. On a wide screen a list of sections on the left scrolls to the one you choose. A draft \
keeps its students under “To” and you can change them. You can also add or remove its textbooks and files in the editor, and it saves itself. An \
issued assignment shows its students without “×”, and “Assign to more” adds new ones. Its textbooks and files are updated on the details page, and \
“Save” keeps your changes; the portal checks before you leave without saving. “Back” returns to the page you opened the editor from.

“Make a copy” creates a draft with the original text, files, textbooks and videos, but no recipients or due date. The editor opens so you can adapt \
it.

The Homework page lists assignments on the full width. Search by assignment title or student name, and use “For” to select a student or group. Search \
and “For” are kept in the page address.

- **Active:** assignments with work still outstanding, grouped by due date: Overdue, This week, Later and No due date.
- **Drafts:** assignments you have not given to anyone yet.
- **Done:** assignments with all submissions accepted. Use “Show more” after the first 20.

Each row shows the materials in the assignment (textbooks, files, questions, videos, board), who it is for, the due date, how many submissions are in \
and the status. On a tablet the table becomes tiles with an icon, the title, who it is for and when it is due, a progress bar (“3 of 4”) and the \
status. On a phone it becomes cards and the views become chips.

Select an assignment to open it on its own page; the arrow returns you to the list.

## The “By student” view

The “List · By student” switch at the top of the Homework page shows a whole week at once: students are the rows and the assignments due that week \
are the columns. The arrows next to the dates move between weeks, and “For” narrows the grid to one student or group. The colour of a cell tells you \
what to do: green is accepted (with the grade), yellow is waiting for your review (a quiz shows its score), red is overdue or sent back, grey means \
the student has not handed it in yet, and a dashed cell means the assignment was not given to them. The last column counts the work handed in.

Select a yellow cell to review that piece of work, or a dashed one to open “Assign to more students” with the student already chosen. Any other cell, \
or a column title, opens the assignment. The view you pick is kept in the page address.

## Assignment details and textbooks

The header shows the title, the number of students with the deadline, “Edit” and “Review N submissions” (hidden when nothing is waiting). The review \
button opens the first submission; “Next” in the review panel moves on to the following one. The “⋮” menu holds “Create copy”, “Add to board”, “Open \
board” (once the assignment is on a board) and “Delete…”.

Each student has a card on the left: when they handed in (“Handed in today at 09:12”, “Accepted yesterday · grade 4”, “Sent back for revision on \
28.10”), the status, the start of the answer, the quiz score and the number of files. “Review” opens a submission that has been handed in; “Open” \
opens any other, and “Remind” (for students who have not handed in or are revising) sends the student a notification — no more than once an hour. \
Counts above the cards show how many are accepted, waiting for review and sent back. “Assign to more” gives the work to other students or groups.

On the right you will find the instructions (long text is folded to three lines until you choose “Show all”), videos, files and textbooks. Select a \
name to open a file or textbook in a new tab, or use the arrow button to download a file. Change the text, files and textbooks with “Edit”. For an \
assignment with a quiz, “Mistakes by question” appears below: each question has a bar and a count such as “3 of 4”, showing how many students got it \
wrong.

On a wide screen the instructions take the main column: the full text, the materials as one list and the quiz line. Students sit in a narrow column \
on the right, grouped under To review, Sent back, Not handed in and Accepted (empty groups are hidden). Each row has one button — “Review”, “Remind” \
or “Open” — and selecting a student’s name opens their work. “Assign to more” is the person icon at the top of the column, and “Mistakes by question” \
sits below the students.

On a phone these become the tabs “Students · Assignment · Mistakes” (“Mistakes” only with a quiz), and “Review N submissions” stays at the bottom of \
the screen.

In the assignment editor (“Edit” on the assignment page), choose “Textbook” under Materials to select a resource and pages, such as 12-14, 20. Leave \
pages blank for the whole textbook. Students can access the assigned pages even if the full textbook is not shared with them. Word documents are \
downloaded in full, with page numbers provided for reference. The pencil changes the pages; the cross removes the attachment. See \
[Textbooks](/teacher/help/textbooks).

“Open board” in the “⋮” menu opens a linked board. “Delete…” in the same menu removes the assignment, submissions and files; recovery requires a \
portal backup.

## Add a quiz

Questions are on the editor’s Quiz tab. The list on the left shows each question’s number, type and points. Select a question to open it on the \
right. To reorder, drag the handle or focus it and use the up and down arrow keys. “Question” below the list offers six types:

- **Single choice** and **Multiple choice:** mark the correct options.
- **Short answer:** list accepted answers; press Enter after each one. Capitalisation, extra spaces and the difference between ё and е are ignored.
- **Number:** enter a correct answer and an optional tolerance.
- **Matching:** enter pairs; the right-hand column is shuffled for students.
- **Ordering:** enter the correct order; students receive shuffled items.

“With AI” opens the AI assistant. In an open question you can change its type, duplicate it, move it or remove it. Options carry over between single \
choice, multiple choice and ordering; for other changes the portal asks first. Options can be dragged too, and pressing Enter in the last option adds \
another. Each question has points from 1 to 100 (1 by default) and an optional explanation; choose “Answer explanation” to add one. Matching and \
ordering award all points or none. “Student view” at the top opens the quiz the way your student takes it: full screen, one question at a time. You \
can try the answers; nothing is saved. On the right, “Quiz settings” sets when answers are revealed and how many attempts are allowed: 1, 2, 3 or \
unlimited. The best attempt counts. “Summary” shows the number of questions, the points and roughly how long the quiz takes. On a phone, the \
Questions tab shows only the list: tap a question to open it full screen, use the arrows at the bottom to move between questions, and use “Question” \
at the bottom to choose the type of a new one. A draft keeps unfinished questions as they are, but you can’t assign it until they are complete. The \
portal opens the Quiz tab, marks those questions in red and lists them under “Summary”. Once a student starts the quiz, questions are locked; the \
rest of the assignment remains editable. To change the questions, choose “Duplicate to edit”: the portal copies the assignment and opens the copy’s \
Quiz tab.

The AI assistant can draft questions. On the Quiz tab it prepares questions straight away; on Instructions it drafts the text. You can still switch \
with “What to prepare”. Append the draft or replace all questions, and review them before assigning.

Reviews show the best quiz attempt, incorrect answers first, with an answer key. Use “Mark correct” or “Mark incorrect” to override automatic \
marking. The score fills the grade field unless you enter a grade yourself. “Mistakes by question” on the assignment page highlights common errors. A \
completed quiz is enough for a student to submit the assignment for review.

## Review a submission

Submissions waiting for review sit in the “To review” strip at the top of the Homework page: each card shows the student, the assignment, when it was \
handed in, a “Late” tag and the quiz score. “Review” opens a submission; “Review them all” starts with the oldest and moves on to the next after each \
decision. When none are left you return to where you started and see “Nothing left to review”. “Review” on an assignment’s page goes through that \
assignment’s submissions only, and “Back” returns to the assignment. You will see the assignment, the student’s response and attached images. “Open \
on the board” opens the assignment’s board.

Add feedback and a grade, then choose “Accept” or “Return for revision”. Quick comments help with common responses. “Next: …” opens the next \
submission after your decision. If AI is enabled, “AI draft” suggests feedback and a grade; review them before choosing “Insert”.

On wide screens the review form sits beside the submission. On a phone, use the bottom toolbar; feedback, grades and AI drafts open in a bottom \
panel. Existing direct links to submissions and the review queue still work.
`,
};
