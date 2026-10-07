import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { FileSaver } from './file-saver';

/** What the browser shows by itself: PDF and pictures. */
const SHOWABLE = /^(application\/pdf|image\/(png|jpeg|webp|gif))$/;

/** How long an opened file stays addressable: the new tab has loaded it by then. */
export const OPENED_URL_TTL_MS = 60_000;

/**
 * Opens downloaded content in a new tab instead of saving it (e.g. a textbook). API files need the
 * Authorization header, so they are fetched as blobs: the tab is opened at once (still within the click, or
 * the browser blocks it) and shown the blob when it comes. What the browser cannot show is saved.
 */
@Injectable({ providedIn: 'root' })
export class FileOpener {
  private readonly document = inject(DOCUMENT);
  private readonly saver = inject(FileSaver);

  /**
   * @param showable the file is expected to be a PDF or a picture (a Word file is saved without a tab)
   * @param filename the name to save it under when it cannot be shown
   */
  open(content: Observable<Blob>, showable: boolean, filename: (blob: Blob) => string): void {
    const view = this.document.defaultView;
    const tab = showable ? (view?.open('', '_blank') ?? null) : null;
    content.subscribe({
      next: (blob) => {
        if (tab !== null && SHOWABLE.test(blob.type)) {
          const url = URL.createObjectURL(blob);
          tab.opener = null;
          tab.location.href = url;
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, OPENED_URL_TTL_MS);
          return;
        }
        tab?.close();
        this.saver.save(blob, filename(blob));
      },
      error: () => {
        tab?.close();
      },
    });
  }
}
