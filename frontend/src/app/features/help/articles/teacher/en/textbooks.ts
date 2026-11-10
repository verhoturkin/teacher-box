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
3. Choose Textbook, Workbook or Other, and optionally enter a course. Existing course names are suggested.
4. PDF pages are counted automatically and an image counts as one page. You can enter a page count for a Word document.
5. Select students and groups to share it with. Remove a chip to deselect a recipient, or clear the selection. Group sharing includes all current \
members.

## Open and manage resources

Search by title and select a resource to open it. PDFs and images open in the browser; Word files download. The ⋮ menu provides:

- **Download:** save the original file.
- **Edit:** change its type, title, course, Word page count and sharing.
- **Add to board:** place PDF pages or an image on an Excalidraw board. Enter a range such as 12-14, up to 30 pages at once. Pages appear in a frame \
to the right of existing content; move the frame to move them together. Word documents cannot be added this way. From an assignment, only its \
students’ boards are offered; from Textbooks, you can choose any board.
- **Replace file:** upload a corrected version. PDF pages are counted again.
- **Delete…:** remove the textbook and its file, including its attachments to assignments.

Students find shared resources under Materials and can download them. For assignment-specific page access, see [Homework](/teacher/help/homework).
`,
};
