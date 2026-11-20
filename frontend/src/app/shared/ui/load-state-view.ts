import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { LoadingIndicator } from '@shared/ui/loading-indicator';
import { LoadState } from './load-state';

/**
 * What a page or a section shows while it loads (ADR-0025): the M3 Expressive loading indicator in
 * the place of the content, the error with «Повторить» when the load failed, the content when it is
 * loaded. `compact` — a widget or a panel: less room for the indicator. `skeleton` — a list section
 * (ADR-0066, 417.1): the shape of its rows instead of the indicator, a pulse running over them from
 * top left to bottom right; the content fades in over them when it arrives.
 *
 * `<tb-load-state [state]="state" what="задания" [skeleton]="true" (retry)="load()">…</tb-load-state>`
 */
import { SHARED_T } from '@shared/i18n/texts';
@Component({
  selector: 'tb-load-state',
  imports: [Button, LoadingIndicator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.tb-load-state--compact]': 'compact()',
    '[class.tb-load-state--skeleton]': 'skeleton()',
  },
  template: `
    @switch (state().status()) {
      @case ('loading') {
        @if (skeleton()) {
          <div
            class="tb-load-state__skeleton"
            role="status"
            animate.leave="tb-load-state__skeleton--leave"
          >
            <ul class="tb-list" aria-hidden="true">
              @for (row of rows(); track row) {
                <li>
                  <span class="tb-list__lead tb-load-state__bone"></span>
                  <span class="tb-list__text">
                    <span class="tb-load-state__bone tb-load-state__line"></span>
                    <span class="tb-load-state__bone tb-load-state__line--short"></span>
                  </span>
                </li>
              }
            </ul>
            <span class="tb-sr-only">{{ t.common.loading }}</span>
          </div>
        } @else {
          <div class="tb-load-state__loading" role="status">
            <tb-loading-indicator [ariaLabel]="t.load.loading" />
            <span class="tb-sr-only">{{ t.common.loading }}</span>
          </div>
        }
      }
      @case ('error') {
        <div class="tb-load-state__error" role="alert">
          <i class="tb-i tb-i-error tb-load-state__icon" aria-hidden="true"></i>
          <p class="tb-load-state__title">{{ t.load.failed(what()) }}</p>
          @if (state().error(); as error) {
            <p class="tb-load-state__detail">{{ error }}</p>
          }
          <p-button
            [label]="t.common.retry"
            icon="tb-i tb-i-refresh"
            severity="secondary"
            (onClick)="retry.emit()"
          />
        </div>
      }
      @default {
        <div class="tb-load-state__content" animate.enter="tb-load-state__content--enter">
          <ng-content />
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    /* the wrapper of the content takes no box: the caller's layout of the host reaches the content */
    .tb-load-state__content {
      display: contents;
    }

    /*
     * Ours, not M3 (M3 shows skeletons only in its video of transition patterns, 8-3): the rows are
     * tiles of the list with bones in the place of their content, a lighter band crosses them
     * diagonally (a mask, so it runs over all rows as one), and the content fades in over them on
     * the default effects spring while they fade out under it. Less motion: the global rule stops
     * the band at its end, off the rows, so the skeleton stands still.
     */
    .tb-load-state__skeleton > ul {
      mask-image: linear-gradient(120deg, #000 40%, rgb(0 0 0 / 55%) 50%, #000 60%);
      mask-size: 300% 300%;
      animation: tb-load-state-pulse 1.6s linear infinite;
    }

    @keyframes tb-load-state-pulse {
      from {
        mask-position: 100% 100%;
      }

      to {
        mask-position: 0 0;
      }
    }

    .tb-load-state__skeleton .tb-list__text {
      gap: var(--tb-space-2);
    }

    .tb-load-state__bone {
      background: var(--p-md-surface-container-highest);
    }

    .tb-load-state__line,
    .tb-load-state__line--short {
      display: block;
      height: 0.75rem;
      border-radius: var(--tb-shape-full);
    }

    .tb-load-state__line {
      width: 60%;
    }

    .tb-load-state__line--short {
      width: 35%;
    }

    .tb-load-state__skeleton--leave {
      position: absolute;
      inset: 0 0 auto;
      animation: tb-motion-fade-out var(--tb-spring-default-effects) forwards;
    }

    /* the rows take the width of the section even in a flex parent that does not stretch them */
    /* positioned only here, for the leaving rows: elsewhere absolute content (the board) anchors
       to the caller's box */
    :host(.tb-load-state--skeleton) {
      position: relative;
      align-self: stretch;
    }

    :host(.tb-load-state--skeleton) .tb-load-state__content {
      display: inherit;
      flex-direction: inherit;
      gap: inherit;
    }

    :host(.tb-load-state--skeleton) .tb-load-state__content--enter {
      animation: tb-motion-fade-in var(--tb-spring-default-effects);
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
      letter-spacing: var(--tb-tracking-title-m);
    }

    .tb-load-state__detail {
      max-width: 32rem;
      margin: 0 0 var(--tb-space-2);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
      letter-spacing: var(--tb-tracking-body-m);
      overflow-wrap: break-word;
    }
  `,
})
export class LoadStateView {
  protected readonly t = SHARED_T;
  readonly state = input.required<LoadState>();
  /** What failed to load, in the accusative: «задания», «расписание». */
  readonly what = input(SHARED_T.load.data);
  /** A widget or a panel: less room while loading. */
  readonly compact = input(false);
  /** A list section: the shape of its rows while it loads (two in a compact one, else three). */
  readonly skeleton = input(false);
  protected readonly rows = computed(() => (this.compact() ? [0, 1] : [0, 1, 2]));
  readonly retry = output();
}
