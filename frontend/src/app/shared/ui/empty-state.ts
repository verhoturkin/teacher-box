import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * An empty list or section (ADR-0015): an icon, what is missing and, as content, the button of the first action.
 *
 * `<tb-empty-state icon="pi-users" title="Учеников пока нет"><p-button label="Добавить" /></tb-empty-state>`
 */
@Component({
  selector: 'tb-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <i class="pi {{ icon() }} tb-empty-state__icon" aria-hidden="true"></i>
    <p class="tb-empty-state__title">{{ title() }}</p>
    @if (hint(); as hint) {
      <p class="tb-empty-state__hint">{{ hint }}</p>
    }
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
      font-size: 2rem;
      color: var(--p-text-muted-color);
      opacity: 0.6;
    }

    .tb-empty-state__title {
      margin: 0;
      font-weight: 600;
    }

    .tb-empty-state__hint {
      margin: 0;
      max-width: 32rem;
      color: var(--p-text-muted-color);
    }
  `,
})
export class EmptyState {
  /** PrimeIcons class, e.g. `pi-inbox`. */
  readonly icon = input('pi-inbox');
  readonly title = input.required<string>();
  readonly hint = input<string | null>(null);
}
