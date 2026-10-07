/**
 * Parts of the textbooks feature that other features embed: the API, types and labels for homework.
 * Pages are in index.ts.
 */
export { TextbooksApi } from './data-access/textbooks-api';
export type {
  MyTextbook,
  Textbook,
  TextbookFormat,
  TextbookKind,
} from './data-access/textbooks.models';
export { TEXTBOOK_KIND_ICONS, TEXTBOOK_KIND_LABELS } from './textbooks-labels';
export { TextbookToBoardDialog } from './teacher/textbook-to-board-dialog';
export type { BoardTextbook } from './teacher/textbook-to-board-dialog';
