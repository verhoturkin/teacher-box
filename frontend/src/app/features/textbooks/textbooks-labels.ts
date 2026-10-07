import { formatFileSize } from '@shared/files/file-size';
import { MyTextbook, Textbook, TextbookFormat, TextbookKind } from './data-access/textbooks.models';

export const TEXTBOOK_KIND_LABELS: Readonly<Record<TextbookKind, string>> = {
  TEXTBOOK: 'Учебник',
  WORKBOOK: 'Рабочая тетрадь',
  OTHER: 'Другое',
};

export const TEXTBOOK_KIND_ICONS: Readonly<Record<TextbookKind, string>> = {
  TEXTBOOK: 'pi pi-book',
  WORKBOOK: 'pi pi-pencil',
  OTHER: 'pi pi-file',
};

export const TEXTBOOK_FORMAT_LABELS: Readonly<Record<TextbookFormat, string>> = {
  IMAGE: 'картинка',
  PDF: 'PDF',
  DOCUMENT: 'Word',
};

/** Files a textbook takes (the backend checks them by content). */
export const TEXTBOOK_FILES = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif';
/** The largest file, bytes. */
export const TEXTBOOK_MAX_SIZE = 100 * 1024 * 1024;

/** A Word file: the teacher gives its number of pages. */
export function isDocumentFile(name: string): boolean {
  return /\.docx?$/i.test(name);
}

/** «120 с.»; nothing when unknown. */
export function pagesText(pageCount: number | null): string | null {
  return pageCount === null ? null : `${String(pageCount)} с.`;
}

/** «PDF, 120 с., 4,2 МБ». */
export function fileText(textbook: Pick<Textbook, 'format' | 'pageCount' | 'size'>): string {
  return [
    TEXTBOOK_FORMAT_LABELS[textbook.format],
    pagesText(textbook.format === 'IMAGE' ? null : textbook.pageCount),
    formatFileSize(textbook.size),
  ]
    .filter((part) => part !== null)
    .join(', ');
}

/** The students and groups of a textbook in one line; those who are gone are skipped. */
export function textbookMembersText(textbook: Textbook): string {
  const names = textbook.members.flatMap((member) =>
    member.name === null ? [] : [member.type === 'GROUP' ? `группа «${member.name}»` : member.name],
  );
  return names.length === 0 ? 'ученикам не открыт' : names.join(', ');
}

/** «Учебник · Английский · PDF, 120 с., 4,2 МБ». */
export function textbookDetails(textbook: Textbook | MyTextbook): string {
  return [TEXTBOOK_KIND_LABELS[textbook.kind], textbook.course, fileText(textbook)]
    .filter((part) => part !== null)
    .join(' · ');
}
