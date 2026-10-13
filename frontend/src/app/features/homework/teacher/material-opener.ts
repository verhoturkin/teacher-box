import { Injectable, inject } from '@angular/core';
import { TextbooksApi } from '@features/textbooks/parts';
import { FileOpener, isShowable } from '@shared/files/file-opener';
import { HomeworkApi } from '../data-access/homework-api';
import { Attachment, BoundTextbook } from '../data-access/homework.models';
import { boundTextbookFilename } from '../ui/textbook-list';

/** The lowest page of `12-14, 20`; none for the whole textbook. */
export function firstPage(pages: string | null): number | null {
  const numbers = (pages ?? '').match(/\d+/g)?.map(Number) ?? [];
  return numbers.length === 0 ? null : Math.min(...numbers);
}

/**
 * Teacher: opens the materials of an assignment by their names — a PDF or a picture in a new tab, anything else is
 * saved. A bound textbook opens whole, a PDF at its first bound page.
 */
@Injectable({ providedIn: 'root' })
export class MaterialOpener {
  private readonly homework = inject(HomeworkApi);
  private readonly textbooks = inject(TextbooksApi);
  private readonly opener = inject(FileOpener);

  textbook(textbook: BoundTextbook): void {
    this.opener.open(
      this.textbooks.file(textbook.textbookId),
      textbook.format !== 'DOCUMENT',
      (blob) => boundTextbookFilename({ ...textbook, pages: null }, blob.type),
      firstPage(textbook.pages),
    );
  }

  file(file: Attachment): void {
    this.opener.open(
      this.homework.teacherFile(file.id),
      isShowable(file.contentType),
      () => file.filename,
    );
  }
}
