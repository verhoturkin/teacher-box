import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * Saves downloaded content as a file. API downloads need the Authorization header, so they are
 * fetched as blobs and handed to the browser through a temporary object URL.
 */
@Injectable({ providedIn: 'root' })
export class FileSaver {
  private readonly document = inject(DOCUMENT);

  save(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    this.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}
