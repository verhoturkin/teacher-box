import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

/**
 * A sine of 40 dp wavelength and 3 dp amplitude around the centre line at 5, from x −40 to 3970: a
 * cubic per quarter wave (the standard sine fit), so the curvature has no breaks — a chain of quadratic
 * halves read as a row of arcs.
 */
const WAVE = `M-40 5c3.261-1.537 6.381-3 10-3${'s6.739 1.463 10 3s6.381 3 10 3s6.739-1.463 10-3s6.381-3 10-3'.repeat(100)}`;

/**
 * The M3 Expressive wavy linear progress indicator (determinate; PrimeNG 21.1 has only the flat bar):
 * the active part a wave of 3 dp amplitude, 40 dp wavelength and 4 dp thickness with round ends, 10 dp
 * high (`LinearProgressIndicator` tokens); 4 dp of space, then the flat 4 dp track ending in a 4 dp stop.
 * Colours: primary, secondary-container; a container overrides them with `--tb-wavy-active` and
 * `--tb-wavy-track`. The wave drifts toward the end (ours: one wavelength in 2 s; M3 publishes no
 * speed); with reduced motion it stands still.
 *
 * The wave is a dash of a long path, so both its ends are round caps that ride the wave (the M3
 * motion spec); the dash takes the active part's width from a ResizeObserver.
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
    <svg class="tb-wavy__active" [style.inline-size.%]="percent()" aria-hidden="true">
      <path
        class="tb-wavy__wave"
        [attr.d]="wave"
        pathLength="4010"
        [style.stroke-dasharray]="dash()"
      />
    </svg>
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
      flex: none;
      /* at 0 % the wave is a dot (M3) */
      min-inline-size: 0.25rem;
      block-size: 100%;
      overflow: visible;
      transition: inline-size var(--tb-spring-default-spatial);
    }

    .tb-wavy__wave {
      fill: none;
      stroke: var(--tb-wavy-active, var(--p-md-primary));
      stroke-width: 4;
      stroke-linecap: round;
      /* the path starts a wavelength early: the dash starts 2 in, after the round cap */
      stroke-dashoffset: -42;
      animation: tb-wavy-drift 2s linear infinite;
    }

    .tb-wavy__track {
      flex: 1;
      block-size: 0.25rem;
      margin-inline-start: var(--tb-space-1);
      border-radius: var(--tb-shape-full);
      /* the stop indicator: a 4 dp dot at the end of the track */
      background:
        radial-gradient(
            circle closest-side,
            var(--tb-wavy-active, var(--p-md-primary)) 99%,
            transparent
          )
          right / 0.25rem 100% no-repeat,
        var(--tb-wavy-track, var(--p-md-secondary-container));
    }

    /* the wave moves a wavelength on while the dash stays put */
    @keyframes tb-wavy-drift {
      to {
        transform: translateX(40px);
        stroke-dashoffset: -2;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .tb-wavy__active,
      .tb-wavy__wave {
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

  protected readonly wave = WAVE;
  protected readonly percent = computed(() => Math.round(Math.min(100, Math.max(0, this.value()))));
  /** The active part's width in px. */
  private readonly width = signal(0);
  /** The visible wave: the width less the two 2 px caps. */
  protected readonly dash = computed(() => `${String(Math.max(0, this.width() - 4))} 8000`);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // the box from the observer: `clientWidth` of an <svg> is 0 in some browsers (the wave a dot)
    const observer = new ResizeObserver(([entry]) => {
      this.width.set(entry?.contentRect.width ?? 0);
    });
    afterNextRender(() => {
      const active = host.querySelector('.tb-wavy__active');
      if (active !== null) {
        this.width.set(active.getBoundingClientRect().width);
        observer.observe(active);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      observer.disconnect();
    });
  }
}
