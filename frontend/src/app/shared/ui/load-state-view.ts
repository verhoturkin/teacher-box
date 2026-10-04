import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { LoadState } from './load-state';

/**
 * What a page or a section shows while it loads (ADR-0025): the M3 Expressive loading indicator in
 * the place of the content, the error with «Повторить» when the load failed, the content when it is
 * loaded. `compact` — a widget or a panel: less room for the indicator.
 *
 * `<tb-load-state [state]="state" what="задания" (retry)="load()">…</tb-load-state>`
 */
@Component({
  selector: 'tb-load-state',
  imports: [Button, ProgressSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.tb-load-state--compact]': 'compact()' },
  template: `
    @switch (state().status()) {
      @case ('loading') {
        <div class="tb-load-state__loading" role="status">
          <p-progressspinner ariaLabel="Загрузка" />
          <span class="tb-sr-only">Загрузка…</span>
        </div>
      }
      @case ('error') {
        <div class="tb-load-state__error" role="alert">
          <i class="pi pi-exclamation-circle tb-load-state__icon" aria-hidden="true"></i>
          <p class="tb-load-state__title">Не удалось загрузить {{ what() }}</p>
          @if (state().error(); as error) {
            <p class="tb-load-state__detail">{{ error }}</p>
          }
          <p-button
            label="Повторить"
            icon="pi pi-refresh"
            severity="secondary"
            (onClick)="retry.emit()"
          />
        </div>
      }
      @default {
        <ng-content />
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .tb-load-state__loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 12rem;
    }

    :host(.tb-load-state--compact) .tb-load-state__loading {
      min-height: 5rem;
    }

    .tb-load-state__error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--tb-space-2);
      padding: var(--tb-space-6) var(--tb-space-4);
      text-align: center;
    }

    :host(.tb-load-state--compact) .tb-load-state__error {
      padding-block: var(--tb-space-3);
    }

    .tb-load-state__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-error-container);
      color: var(--p-md-on-error-container);
      font-size: 1.25rem;
    }

    .tb-load-state__title {
      margin: 0;
      font: var(--tb-type-title-m);
    }

    .tb-load-state__detail {
      max-width: 32rem;
      margin: 0 0 var(--tb-space-2);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
      overflow-wrap: break-word;
    }
  `,
})
export class LoadStateView {
  readonly state = input.required<LoadState>();
  /** What failed to load, in the accusative: «задания», «расписание». */
  readonly what = input('данные');
  /** A widget or a panel: less room while loading. */
  readonly compact = input(false);
  readonly retry = output();
}
