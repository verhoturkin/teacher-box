import { HelpArticleText } from '@features/help/help.models';

export const textbooksArticle: HelpArticleText = {
  title: 'Textbooks',
  summary: 'Upload resources, share them with students and use selected pages',
  body: `
“Materials” → “Textbooks” stores textbooks, workbooks and other resources, with one file per entry. Supported files are PDF, Word (DOC or DOCX) and \
images, up to 100 MB.

Materials has a list on the left: All materials, your courses, No course and Boards, each with the number of items in it. The right side shows \
the selected item: the tabs “Textbooks · Plans · Assignments” and one row with the search, the Filter menu and the sort. On a phone these are \
two screens: select an item in the list, and the back arrow returns to it.

## Add a textbook

1. Choose “Create” → “Textbook”, or “Create” → “Textbook” in Materials: the course selected on the left is filled in.
2. Select a file. The filename provides an initial title; edit it as needed.
3. Choose Textbook, Workbook or Other, and pick a **Course** from the list, or “No course”. Courses are managed in the list of Materials (see below).
4. PDF pages are counted automatically and an image counts as one page. You can enter a page count for a Word document.
5. Select students and groups to share it with. Remove a chip to deselect a recipient, or clear the selection. Group sharing includes all current \
members. Choose **Students of a course** to share it with everyone whose current course it is and with the members of groups on that course; a \
student who joins the course sees it straight away. Setting the textbook’s course alone shares it with nobody.

## Courses

A course is a programme such as “English A2” or “GCSE Maths”. Textbooks, plans, assignments, students and groups can be marked with one. \
Courses are listed on the left of Materials: select one to see only its textbooks, plans and assignments; the chosen course stays in the page \
address.

- **+ New course** below the courses: type a name and press Enter; it goes to the end of the list (Esc cancels);
- a course’s “⋮” → **Rename** (Enter saves, Esc cancels);
- drag a course by its handle, or use ↑ and ↓ on the handle, to set the order used everywhere; on a phone, use the course’s “⋮” → Move up or Move down;
- a course’s “⋮” → **Delete…**, after confirming: its textbooks, plans, assignments, students and groups stay without a course, and textbooks \
shared with its students close to them.

Set a student’s or a group’s current course on their Profile tab → “Course” ([Students and invitations](/teacher/help/students)).

## Open and manage resources

Search by title or course, pick a type in the Filter menu and select a resource to open it. PDFs and images open in the browser; Word files download. The ⋮ menu provides:

- **Download:** save the original file.
- **Edit:** change its type, title, course, Word page count and sharing, including students of a course.
- **Add to board:** place PDF pages or an image on an Excalidraw board. Enter a range such as 12-14, up to 30 pages at once. Pages appear in a frame \
to the right of existing content; move the frame to move them together. Word documents cannot be added this way. From an assignment, only its \
students’ boards are offered; from Textbooks, you can choose any board.
- **Replace file:** upload a corrected version. PDF pages are counted again.
- **Delete…:** remove the textbook and its file, including its attachments to assignments.

Students find shared resources under Materials and can download them. For assignment-specific page access, see [Homework](/teacher/help/homework).

## Lesson plans

The **Plans** tab of Materials holds lesson plan templates: a lesson takes its own copy of one. Each card shows the title, the course \
and how many times it was used. The course on the left and the search work here too.

1. Choose “Create” → “Lesson plan” to open the plan editor: a title, a **Course** (the course selected on the left is filled in) and the plan \
text (Markdown, with “Text · Preview”).
2. **Textbooks**: choose “Attach a textbook”, then the textbook and its pages (leave blank for the whole textbook). When the plan has a course, \
only that course’s textbooks are offered. ✎ changes the pages, ✕ removes the textbook; up to 20 textbooks.
3. **Videos**: paste a link (up to 5 videos). A YouTube video gets its transcript automatically, in the video’s language; “Change language” picks \
other captions. Students see a transcript only when “Show transcript to students” is on.
4. The plan saves itself a moment after each change (“saved · HH:MM”). **Done** saves the rest and takes you back to Materials.

The card’s “⋮” menu has **Edit**, which opens the editor, and **Delete…**, which deletes the template after you confirm (lesson plans \
made from it stay). Editing a template does not change the copies on lessons.

**With AI** in the editor header (and in the lesson card’s Plan section while it has no plan) opens the assistant: describe the lesson, tick \
what it should draw on — the textbook pages and videos with a transcript in the plan — and a draft comes back. The AI knows the lesson’s topic, \
the summary of the previous lesson and the AI tags of the lesson’s students. “Replace the plan” or “Insert at the end” moves the draft into the plan \
(a replace also narrows the attached textbooks to the pages the AI chose); nothing changes until you press it. The button appears only \
when a model is connected (Settings → AI assistant).

Lesson plans are made from a lesson’s details (+ Plan, then Write or From templates; see Schedule and requests). A plan written for a lesson becomes \
a template automatically the first time you choose Done. Its editor’s “⋮” menu has **Save as template** (no \
template yet) or **Update template** (the template is replaced with this plan after you confirm).
`,
};
