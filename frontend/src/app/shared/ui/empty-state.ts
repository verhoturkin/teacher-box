import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * An empty list or section (ADR-0015, ADR-0017, ADR-0018): an icon in a tonal circle, what is missing,
 * a line that explains what will be here and, as content, the button of the first action — none if the
 * same button is already on the page as the FAB. The compact variant (a widget, a calendar, a dialog)
 * is a row: the icon of 40 px and the text beside it.
 *
 * `<tb-empty-state icon="pi-users" title="Учеников пока нет"><p-button label="Добавить" /></tb-empty-state>`
 */
@Component({
  selector: 'tb-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.tb-empty-state--compact]': 'compact()' },
  template: `
    <i class="pi {{ icon() }} tb-empty-state__icon" aria-hidden="true"></i>
    <div class="tb-empty-state__text">
      <p class="tb-empty-state__title">{{ title() }}</p>
      @if (hint(); as hint) {
        <p class="tb-empty-state__hint">{{ hint }}</p>
      }
    </div>
    <ng-content />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--tb-space-2);
      padding: var(--tb-space-6) var(--tb-space-4);
      text-align: center;
      white-space: normal;
    }

    .tb-empty-state__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 4rem;
      height: 4rem;
      margin-bottom: var(--tb-space-2);
      border-radius: var(--tb-shape-full);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
      font-size: 1.75rem;
    }

    .tb-empty-state__text {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--tb-space-1);
      min-width: 0;
    }

    .tb-empty-state__title {
      margin: 0;
      font: var(--tb-type-title-m);
    }

    /* compact: a row with a 40 px icon, for widgets, the calendar and dialogs */
    :host(.tb-empty-state--compact) {
      flex-direction: row;
      justify-content: flex-start;
      gap: var(--tb-space-3);
      padding: var(--tb-space-2) 0;
      text-align: left;

      .tb-empty-state__icon {
        flex: none;
        width: 2.5rem;
        height: 2.5rem;
        margin: 0;
        font-size: 1.25rem;
      }

      .tb-empty-state__text {
        align-items: flex-start;
      }

      .tb-empty-state__title {
        font: var(--tb-type-body-l);
      }

      .tb-empty-state__hint {
        margin: 0;
      }
    }

    .tb-empty-state__hint {
      max-width: 32rem;
      margin: 0 0 var(--tb-space-2);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }
  `,
})
export class EmptyState {
  /** PrimeIcons class, e.g. `pi-inbox`. */
  readonly icon = input('pi-inbox');
  readonly title = input.required<string>();
  readonly hint = input<string | null>(null);
  /** A row with a small icon: in a widget, the calendar or a dialog. */
  readonly compact = input(false);
}
