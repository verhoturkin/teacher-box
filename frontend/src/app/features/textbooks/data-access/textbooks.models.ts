/** What a textbook is (ADR-0033). */
export type TextbookKind = 'TEXTBOOK' | 'WORKBOOK' | 'OTHER';

/** The file: a PDF and an image have pages to cut out and show; a Word file has none. */
export type TextbookFormat = 'IMAGE' | 'PDF' | 'DOCUMENT';

export type TextbookMemberType = 'STUDENT' | 'GROUP';

/** A student or a group of a textbook; `name` is `null` when the student or group is gone. */
export interface TextbookMember {
  readonly type: TextbookMemberType;
  readonly id: string;
  readonly name: string | null;
}

export interface Textbook {
  readonly id: string;
  readonly kind: TextbookKind;
  readonly title: string;
  readonly course: string | null;
  /** Counted for a PDF, 1 for an image, the teacher's number (or none) for a Word file. */
  readonly pageCount: number | null;
  readonly format: TextbookFormat;
  readonly filename: string;
  readonly contentType: string;
  readonly size: number;
  readonly members: readonly TextbookMember[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

/** A textbook of the student: their own or their groups'. */
export interface MyTextbook {
  readonly id: string;
  readonly kind: TextbookKind;
  readonly title: string;
  readonly course: string | null;
  readonly pageCount: number | null;
  readonly format: TextbookFormat;
  readonly filename: string;
  readonly size: number;
  /** The student's groups the textbook is shared with; empty when it is only the student's own. */
  readonly groupNames: readonly string[];
  readonly updatedAt: string;
}

export interface TextbookInput {
  readonly kind: TextbookKind;
  readonly title: string;
  readonly course: string | null;
  /** Used only for a Word file. */
  readonly pageCount: number | null;
  readonly studentIds: readonly string[];
  readonly groupIds: readonly string[];
}
