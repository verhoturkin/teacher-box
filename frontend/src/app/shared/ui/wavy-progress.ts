import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * The M3 Expressive wavy linear progress indicator (determinate; PrimeNG 21.1 has only the flat bar):
 * the active part a wave of 3 dp amplitude, 40 dp wavelength and 4 dp thickness, 10 dp high
 * (`LinearProgressIndicator` tokens), primary; 4 dp of space, then the flat 4 dp track in
 * secondary-container ending in a 4 dp primary stop. The wave drifts slowly (ours: one wavelength in
 * 2 s; M3 publishes no speed); with reduced motion it stands still.
 */
@Component({
  selector: 'tb-wavy-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-valuenow]': 'percent()',
    '[attr.aria-label]': 'label()',
  },
  template: `
    <span class="tb-wavy__active" [style.inline-size.%]="percent()"></span>
    @if (percent() < 100) {
      <span class="tb-wavy__track"></span>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      block-size: 0.625rem;
    }

    .tb-wavy__active {
      block-size: 100%;
      background: var(--p-md-primary);
      /* one wavelength 40 × 10: the centre line at 5, peaks 3 above and below, a 4 wide round stroke */
      mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='10'%3E%3Cpath d='M0 5Q10-1 20 5T40 5' fill='none' stroke='%23000' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E")
        0 0 / 2.5rem 100% repeat-x;
      transition: inline-size var(--tb-spring-default-spatial);
      animation: tb-wavy-drift 2s linear infinite;
    }

    .tb-wavy__track {
      flex: 1;
      block-size: 0.25rem;
      margin-inline-start: var(--tb-space-1);
      border-radius: var(--tb-shape-full);
      /* the stop indicator: a 4 dp primary dot at the end of the track */
      background:
        radial-gradient(circle closest-side, var(--p-md-primary) 99%, transparent) right / 0.25rem
          100% no-repeat,
        var(--p-md-secondary-container);
    }

    @keyframes tb-wavy-drift {
      to {
        mask-position: 2.5rem 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .tb-wavy__active {
        animation: none;
        transition: none;
      }
    }
  `,
})
export class WavyProgress {
  /** Done, 0–100. */
  readonly value = input.required<number>();
  /** What is measured, e.g. «Прошло 35 из 60 мин». */
  readonly label = input.required<string>();

  protected readonly percent = computed(() => Math.round(Math.min(100, Math.max(0, this.value()))));
}
