import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** Windows over the page: dialogs, confirmations, drawers, popup menus. */
const OVERLAY = '.p-dialog-mask, .p-dialog, .p-drawer, .p-drawer-mask, .p-menu-overlay';

/**
 * Gives the focus back after a window closes (ADR-0024, WCAG 2.4.3): when a dialog, a confirmation,
 * a drawer or a menu leaves the page and the focus fell on `body`, it returns to the element of the
 * page that had it last — the button that opened the window. One listener for all windows.
 */
@Injectable({ providedIn: 'root' })
export class FocusReturn {
  private readonly document = inject(DOCUMENT);
  private last: HTMLElement | null = null;
  private observer: MutationObserver | null = null;

  start(): void {
    if (this.observer !== null) {
      return;
    }
    this.document.addEventListener('focusin', (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest(OVERLAY) === null) {
        this.last = target;
      }
    });
    this.observer = new MutationObserver((records) => {
      const closed = records.some((record) =>
        Array.from(record.removedNodes).some(
          (node) => node instanceof HTMLElement && node.matches(OVERLAY),
        ),
      );
      if (closed) {
        setTimeout(() => {
          this.restore();
        });
      }
    });
    this.observer.observe(this.document.body, { childList: true, subtree: true });
  }

  /** Back to the last element of the page, if the focus was lost. */
  restore(): void {
    const active = this.document.activeElement;
    if ((active === null || active === this.document.body) && this.last?.isConnected === true) {
      this.last.focus();
    }
  }
}
