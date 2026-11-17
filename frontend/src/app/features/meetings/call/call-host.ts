import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CallPrejoin } from './call-prejoin';
import { CallSession } from './call-session';
import { CallWindow } from './call-window';
import { elapsedText } from './call-layout';

/** The page under the full call window does not scroll. */
const EXPANDED_CLASS = 'tb-call-expanded';

/**
 * The call above every page (mounted once in the root component, ADR-0030): the pre-join sheet and
 * the call window, in the tab or floating over everything (Picture-in-Picture). Lives across routes,
 * the board editor included.
 */
@Component({
  selector: 'tb-call-host',
  imports: [CallPrejoin, CallWindow],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (session.prejoin(); as target) {
      <tb-call-prejoin [target]="target" [switching]="switching()" />
    }
    @if (session.phase() !== 'idle') {
      <tb-call-window [elapsed]="elapsed()" />
    }
  `,
})
export class CallHost {
  protected readonly session = inject(CallSession);
  private readonly now = signal(Date.now());

  /** The title of the call that joining another room ends. */
  protected readonly switching = computed(() =>
    this.session.live() ? (this.session.target()?.title ?? null) : null,
  );
  protected readonly elapsed = computed(() => {
    const started = this.session.startedAt();
    return started === null ? '' : elapsedText(this.now() - started);
  });

  constructor() {
    const root = inject(DOCUMENT).documentElement;
    const timer = setInterval(() => {
      if (this.session.startedAt() !== null) {
        this.now.set(Date.now());
      }
    }, 1000);
    effect(() => {
      root.classList.toggle(EXPANDED_CLASS, this.session.phase() !== 'idle' && !this.session.pip());
    });
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      root.classList.remove(EXPANDED_CLASS);
    });
  }
}
