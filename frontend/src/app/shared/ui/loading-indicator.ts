import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { SHARED_T } from '@shared/i18n/texts';
import { loadingFrame } from './loading-motion';

/** M3 Expressive loading indicator. Destroying it cancels both its 200 ms delay and animation. */
@Component({
  selector: 'tb-loading-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'visible() ? "progressbar" : null',
    '[attr.aria-label]': 'visible() ? ariaLabel() : null',
  },
  template: `
    <svg
      viewBox="0 0 1 1"
      aria-hidden="true"
      focusable="false"
      [style.visibility]="visible() ? null : 'hidden'"
    >
      <g #shape><path #path /></g>
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 48px;
      height: 48px;
      flex-shrink: 0;
    }
    svg {
      width: 100%;
      height: 100%;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-primary-container);
      fill: var(--p-md-on-primary-container);
    }
  `,
})
export class LoadingIndicator {
  readonly ariaLabel = input(SHARED_T.load.loading);
  protected readonly visible = signal(false);
  private readonly path = viewChild.required<ElementRef<SVGPathElement>>('path');
  private readonly shape = viewChild.required<ElementRef<SVGGElement>>('shape');
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);

  constructor() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    let media: MediaQueryList | undefined;
    let reduced = false;
    let ready = false;
    let started = 0;
    const stop = (): void => {
      cancelAnimationFrame(frame);
    };
    const draw = (elapsed: number): void => {
      const result = loadingFrame(elapsed);
      this.path().nativeElement.setAttribute('d', result.path);
      this.shape().nativeElement.setAttribute('transform', result.transform);
    };
    const animate = (now: number): void => {
      this.visible.set(true);
      draw(now - started);
      frame = requestAnimationFrame(animate);
    };
    const start = (): void => {
      stop();
      draw(0);
      if (reduced) this.visible.set(true);
      else {
        started = performance.now();
        frame = requestAnimationFrame(animate);
      }
    };
    const preferenceChanged = (event: MediaQueryListEvent): void => {
      reduced = event.matches;
      if (ready) start();
    };
    afterNextRender(() => {
      this.zone.runOutsideAngular(() => {
        media = this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
        reduced = media?.matches ?? false;
        media?.addEventListener('change', preferenceChanged);
        timer = setTimeout(() => {
          ready = true;
          start();
        }, 200);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(timer);
      stop();
      media?.removeEventListener('change', preferenceChanged);
    });
  }
}
