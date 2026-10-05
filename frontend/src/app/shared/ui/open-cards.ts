import { signal } from '@angular/core';

/**
 * Which cards of a compact list (`tb-cards--wide`) show their details: a card shows its main line, the
 * rest opens with «Подробнее» in its corner.
 *
 * ```html
 * <p-button [icon]="cards.icon(item.id)" [tbAttributes]="{ 'aria-expanded': cards.isOpen(item.id) ? 'true' : 'false' }" (onClick)="cards.toggle(item.id)" />
 * @if (cards.isOpen(item.id)) { <td data-label="…">…</td> }
 * ```
 */
export class OpenCards {
  private readonly ids = signal<ReadonlySet<string>>(new Set());

  isOpen(id: string): boolean {
    return this.ids().has(id);
  }

  /** The chevron of the toggle: down while closed, up while open. */
  icon(id: string): string {
    return this.isOpen(id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down';
  }

  toggle(id: string): void {
    this.ids.update((ids) => {
      const next = new Set(ids);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }
}
