import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/**
 * The one active indicator of a `<p-tabs class="tb-tabs" tbTabIndicator>` bar (M3 tabs, 413.1):
 * `styles/_sheets.scss` draws it as the `::after` of the tab list, this directive places it under the
 * label of the active tab through
 * `--tb-tab-start` / `--tb-tab-end` and names the way it moves in `data-tb-tab-move` (`left`, `right`, or
 * `none` for the first placement and resizes), so the leading edge goes first and the indicator stretches
 * on its way (the M3 video). PrimeNG's own bar spans the whole tab, so it stays hidden.
 */
@Directive({ selector: 'p-tabs[tbTabIndicator]' })
export class TabIndicator {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private start?: number;
  private end?: number;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const list = this.host.querySelector<HTMLElement>('.p-tablist-tab-list');
      if (!list) {
        return;
      }
      this.place(list, false);
      // the active class moves, tabs come and go, labels change: PrimeNG has no event for all of them
      const changes = new MutationObserver(() => {
        this.place(list, true);
      });
      changes.observe(list, {
        subtree: true,
        childList: true,
        characterData: true,
        attributeFilter: ['class'],
      });
      const sizes = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          this.place(list, false);
        });
      });
      sizes.observe(list);
      destroyRef.onDestroy(() => {
        changes.disconnect();
        sizes.disconnect();
      });
    });
  }

  private place(list: HTMLElement, moves: boolean): void {
    const label = list.querySelector<HTMLElement>('.p-tab-active .tb-tab-label');
    if (!label) {
      return;
    }
    const box = list.getBoundingClientRect();
    const rect = label.getBoundingClientRect();
    // in the coordinates of the list's padding box, scrolled or not
    const start = rect.left - box.left - list.clientLeft + list.scrollLeft;
    const end = list.clientWidth - start - rect.width;
    if (start === this.start && end === this.end) {
      return;
    }
    list.dataset['tbTabMove'] =
      !moves || this.start === undefined || start === this.start
        ? 'none'
        : start > this.start
          ? 'right'
          : 'left';
    list.style.setProperty('--tb-tab-start', `${String(start)}px`);
    list.style.setProperty('--tb-tab-end', `${String(end)}px`);
    this.start = start;
    this.end = end;
  }
}
