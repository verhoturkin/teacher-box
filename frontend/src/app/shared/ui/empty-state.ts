import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * An empty list or section (ADR-0015, ADR-0017): an icon in a tonal circle, what is missing and, as
 * content, the button of the first action.
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

    .tb-empty-state__title {
      margin: 0;
      font: var(--tb-type-title-m);
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
}
