import { MAX_BOARD_PAGES, parsePages, textbookPageUrl } from '@features/textbooks/parts';
import { AssignmentDetails, BoundTextbook } from '../data-access/homework.models';

/** What «На доску» of a written assignment puts in its frame after the text. */
export interface AssignmentBoard {
  /** «Дроби · 12.10.2026». */
  readonly frame: string;
  /** API addresses: pictures among the files, then the pages of the textbooks; at most `MAX_BOARD_PAGES`. */
  readonly pictures: readonly string[];
}

/** Pictures a board can show; other files (PDF, documents) stay in the assignment. */
const BOARD_PICTURES = /^image\/(png|jpeg|webp|gif)$/;

export function assignmentBoard(assignment: AssignmentDetails, today: Date): AssignmentBoard {
  const files = assignment.attachments
    .filter((file) => BOARD_PICTURES.test(file.contentType))
    .map((file) => `/api/teacher/homework/attachments/${file.id}`);
  const pages = assignment.textbooks.flatMap(textbookPictures);
  return {
    frame: `${assignment.title} · ${dayText(today)}`,
    pictures: [...files, ...pages].slice(0, MAX_BOARD_PAGES),
  };
}

/** The bound pages of a PDF (the whole one — from its first pages), the picture of an image; a document has none. */
function textbookPictures(textbook: BoundTextbook): string[] {
  switch (textbook.format) {
    case 'IMAGE':
      return [textbookPageUrl(textbook.textbookId, 1)];
    case 'PDF': {
      const count = textbook.pageCount ?? 1;
      const pages = textbook.pages ?? `1-${String(Math.min(count, MAX_BOARD_PAGES))}`;
      const parsed = parsePages(pages, textbook.pageCount, Number.MAX_SAFE_INTEGER);
      return (parsed?.pages ?? []).map((page) => textbookPageUrl(textbook.textbookId, page));
    }
    case 'DOCUMENT':
      return [];
  }
}

function dayText(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${String(date.getFullYear())}`;
}
