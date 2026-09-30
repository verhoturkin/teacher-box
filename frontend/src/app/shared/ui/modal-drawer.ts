import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Drawer } from 'primeng/drawer';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let nextId = 0;

/**
 * A drawer that is a dialog (ADR-0024): the bottom sheet of a lesson, the help panel. It is
 * `role="dialog"` and `aria-modal`, named by its title, takes the focus to its first action when it
 * opens (its focus trap keeps it there) and gives it back to what opened it when it closes.
 *
 * `<p-drawer tbModalDrawer [(visible)]="open" header="…">`
 */
@Directive({ selector: 'p-drawer[tbModalDrawer]' })
export class ModalDrawer {
  private readonly drawer = inject(Drawer);
  private readonly document = inject(DOCUMENT);
  private readonly titleId = `tb-drawer-title-${String(nextId++)}`;
  private opener: HTMLElement | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.drawer.onShow.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      this.opened();
    });
    this.drawer.onHide.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      this.closed();
    });
    // closed by the page (e.g. an action of the sheet): the drawer does not tell about it
    this.drawer.visibleChange.pipe(takeUntilDestroyed(destroyRef)).subscribe((visible) => {
      if (!visible) {
        this.closed();
      }
    });
  }

  private opened(): void {
    const container = this.drawer.container;
    if (container === null || container === undefined) {
      return;
    }
    const active = this.document.activeElement;
    if (
      active instanceof HTMLElement &&
      active !== this.document.body &&
      !container.contains(active)
    ) {
      this.opener = active;
    }
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-modal', 'true');
    const title = container.querySelector('.p-drawer-title');
    if (title !== null) {
      title.id = this.titleId;
      container.setAttribute('aria-labelledby', this.titleId);
    }
    const first =
      container.querySelector<HTMLElement>(`.p-drawer-content :is(${FOCUSABLE})`) ??
      container.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }

  /** The focus goes back to what opened the drawer, unless it already moved on (a dialog). */
  private closed(): void {
    const opener = this.opener;
    this.opener = null;
    setTimeout(() => {
      const active = this.document.activeElement;
      const lost =
        active === null || active === this.document.body || this.drawer.container?.contains(active);
      if (opener?.isConnected === true && lost === true) {
        opener.focus();
      }
    });
  }
}
