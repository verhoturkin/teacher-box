/** What a textbook is (ADR-0033). */
export type TextbookKind = 'TEXTBOOK' | 'WORKBOOK' | 'OTHER';

/** The file: a PDF and an image have pages to cut out and show; a Word file has none. */
export type TextbookFormat = 'IMAGE' | 'PDF' | 'DOCUMENT';

/** `COURSE` — the students of the course and the members of its groups (ADR-0071). */
export type TextbookMemberType = 'STUDENT' | 'GROUP' | 'COURSE';

/** A student, a group or a course of a textbook; `name` is `null` when it is gone. */
export interface TextbookMember {
  readonly type: TextbookMemberType;
  readonly id: string;
  readonly name: string | null;
}

export interface Textbook {
  readonly id: string;
  readonly kind: TextbookKind;
  readonly title: string;
  /** The course of the textbook (ADR-0071); `null` — none. */
  readonly courseId: string | null;
  readonly courseName: string | null;
  /** Counted for a PDF, 1 for an image, the teacher's number (or none) for a Word file. */
  readonly pageCount: number | null;
  readonly format: TextbookFormat;
  readonly filename: string;
  readonly contentType: string;
  readonly size: number;
  /** A PDF and a picture have a cover (`GET …/cover`), a Word file has none. */
  readonly hasCover: boolean;
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
  readonly courseName: string | null;
  readonly pageCount: number | null;
  readonly format: TextbookFormat;
  readonly filename: string;
  readonly size: number;
  readonly hasCover: boolean;
  /** The student's groups the textbook is shared with; empty when it is only the student's own. */
  readonly groupNames: readonly string[];
  readonly updatedAt: string;
}

export interface TextbookInput {
  readonly kind: TextbookKind;
  readonly title: string;
  readonly courseId: string | null;
  /** Used only for a Word file. */
  readonly pageCount: number | null;
  readonly studentIds: readonly string[];
  readonly groupIds: readonly string[];
  /** Courses whose students get the textbook. */
  readonly courseIds: readonly string[];
}

/** A textbook chosen for a material (an assignment, a lesson plan) with its pages. */
export interface PickedTextbook {
  readonly textbookId: string;
  readonly kind: TextbookKind;
  readonly title: string;
  readonly courseName: string | null;
  readonly format: TextbookFormat;
  readonly pageCount: number | null;
  /** Normalized pages («3, 12-14»); `null` — the whole textbook. */
  readonly pages: string | null;
}
