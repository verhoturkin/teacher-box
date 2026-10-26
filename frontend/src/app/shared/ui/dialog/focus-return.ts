/**
 * Gives the focus back to what opened a dialog or a drawer (ADR-0024). `remember` when it opens,
 * `restore` when it closes: unless the focus already moved on to something else (another dialog),
 * the opener gets it again.
 */
export class FocusReturn {
  private opener: HTMLElement | null = null;

  constructor(private readonly document: Document) {}

  /** Notes the element that has the focus now, if it is outside the `container` that opens. */
  remember(container: HTMLElement): void {
    const active = this.document.activeElement;
    if (
      active instanceof HTMLElement &&
      active !== this.document.body &&
      !container.contains(active)
    ) {
      this.opener = active;
    }
  }

  /** The focus goes back to the opener once the closing has settled (a task later). */
  restore(container: HTMLElement | null | undefined): void {
    const opener = this.opener;
    this.opener = null;
    setTimeout(() => {
      const active = this.document.activeElement;
      const lost = active === null || active === this.document.body || container?.contains(active);
      if (opener?.isConnected === true && lost === true) {
        opener.focus();
      }
    });
  }
}
