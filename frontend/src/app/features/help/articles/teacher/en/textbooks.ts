import { HelpArticleText } from '@features/help/help.models';

export const textbooksArticle: HelpArticleText = {
  title: 'Textbooks',
  summary: 'Upload resources, share them with students and use selected pages',
  body: `
“Materials” → “Textbooks” stores textbooks, workbooks and other resources, with one file per entry. Supported files are PDF, Word (DOC or DOCX) and \
images, up to 100 MB.

## Add a textbook

1. Choose “Create” → “Textbook”, or open the Textbooks tab and choose “New textbook”.
2. Select a file. The filename provides an initial title; edit it as needed.
3. Choose Textbook, Workbook or Other, and pick a **Course** from the list, or “No course”. Courses are managed in the Courses dialog (see below).
4. PDF pages are counted automatically and an image counts as one page. You can enter a page count for a Word document.
5. Select students and groups to share it with. Remove a chip to deselect a recipient, or clear the selection. Group sharing includes all current \
members. Choose **Students of a course** to share it with everyone whose current course it is and with the members of groups on that course; a \
student who joins the course sees it straight away. Setting the textbook’s course alone shares it with nobody.

## Courses

A course is a programme such as “English A2” or “GCSE Maths”. Textbooks, assignments, students and groups can be marked with one. Below the \
search field in Materials, the course chips “All · <courses> · No course” filter the textbooks; the chosen course stays in the page address. Choose \
⋮ next to the chips → **Courses** (or the Courses button while there are none) to:

- add a course: type its name and choose “Add”; it goes to the end of the list;
- rename it with ✎ (Enter saves, Esc cancels);
- drag it by its handle, or use ↑ and ↓ on the handle, to set the order of the chips and lists;
- delete it after confirming: its textbooks, assignments, students and groups stay without a course, and textbooks shared with its students \
close to them.

Set a student’s or a group’s current course on their Profile tab → “Course” ([Students and invitations](/teacher/help/students)).

## Open and manage resources

Search by title or course, filter by course and select a resource to open it. PDFs and images open in the browser; Word files download. The ⋮ menu provides:

- **Download:** save the original file.
- **Edit:** change its type, title, course, Word page count and sharing, including students of a course.
- **Add to board:** place PDF pages or an image on an Excalidraw board. Enter a range such as 12-14, up to 30 pages at once. Pages appear in a frame \
to the right of existing content; move the frame to move them together. Word documents cannot be added this way. From an assignment, only its \
students’ boards are offered; from Textbooks, you can choose any board.
- **Replace file:** upload a corrected version. PDF pages are counted again.
- **Delete…:** remove the textbook and its file, including its attachments to assignments.

Students find shared resources under Materials and can download them. For assignment-specific page access, see [Homework](/teacher/help/homework).

## Lesson plans

The **Plans** tab of Materials is the bank of lesson plans: the originals a lesson takes its own copy from. Each card shows the title, the course \
and how many times it was used. The course chips and the search work here too.

1. Choose “New plan” to open the plan editor: a title, a **Course** and the plan text (Markdown, with “Text · Preview”).
2. **Textbooks**: choose “Attach a textbook”, then the textbook and its pages (leave blank for the whole textbook). When the plan has a course, \
only that course’s textbooks are offered. ✎ changes the pages, ✕ removes the textbook; up to 20 textbooks.
3. **Videos**: paste a link (up to 5 videos). A YouTube video gets its transcript automatically, in the video’s language; “Change language” picks \
other captions. Students see a transcript only when “Show transcript to students” is on.
4. The plan saves itself a moment after each change (“saved · HH:MM”). **Done** saves the rest and takes you back to Materials.

The card’s “⋮” menu has **Edit**, which opens the editor, and **Delete…**, which removes the plan from the bank after you confirm (lesson plans \
made from it stay). Editing a bank original does not change the copies on lessons.

Lesson plans are made from a lesson’s details (Write or From bank; see Schedule and requests). A plan written for a lesson goes into \
the bank automatically the first time you choose Done. Its editor’s “⋮” menu has **Save to bank** (no \
original yet) or **Update in bank** (the original is replaced with this plan after you confirm).
`,
};
