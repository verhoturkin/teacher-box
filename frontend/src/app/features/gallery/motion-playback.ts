import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injectable,
  ViewEncapsulation,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitch } from 'primeng/toggleswitch';

let switches = 0;

/** The class on `<html>` that emulates `prefers-reduced-motion: reduce` while the gallery is open. */
export const REDUCED_CLASS = 'tb-gallery-reduced-motion';

/**
 * The playback of the motion samples, one per gallery page: «Replay» counts rounds (a sample moves on each),
 * «Reduce motion» starts from the system setting and emulates it for the whole page, overlays included.
 */
@Injectable()
export class MotionPlayback {
  private readonly root = inject(DOCUMENT).documentElement;
  readonly round = signal(0);
  readonly reduced = signal(
    inject(DOCUMENT).defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  constructor() {
    this.apply();
    inject(DestroyRef).onDestroy(() => {
      this.root.classList.remove(REDUCED_CLASS);
    });
  }

  replay(): void {
    this.round.update((round) => round + 1);
  }

  reduce(reduced: boolean): void {
    this.reduced.set(reduced);
    this.apply();
  }

  private apply(): void {
    this.root.classList.toggle(REDUCED_CLASS, this.reduced());
  }
}

/**
 * «Replay» and «Reduce motion» of a motion sample. The emulation repeats the rule of `styles.scss` for
 * `prefers-reduced-motion: reduce` (durations of 0.01 ms), so it is global while the gallery is open.
 */
@Component({
  selector: 'tb-gallery-replay',
  imports: [FormsModule, ButtonModule, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="tb-gallery-row">
      @if (replay()) {
        <p-button
          label="Replay"
          icon="tb-i tb-i-replay"
          severity="secondary"
          (onClick)="playback.replay()"
        />
      }
      <span class="tb-gallery-row">
        <p-toggleswitch
          [inputId]="id"
          [ngModel]="playback.reduced()"
          (ngModelChange)="playback.reduce($event)"
        />
        <label [for]="id">Reduce motion</label>
      </span>
    </div>
  `,
  styles: `
    :root.tb-gallery-reduced-motion *,
    :root.tb-gallery-reduced-motion *::before,
    :root.tb-gallery-reduced-motion *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  `,
})
export class Replay {
  /** Without «Replay» where the sample's own buttons start the motion (overlays). */
  readonly replay = input(true);
  protected readonly playback = inject(MotionPlayback);
  protected readonly id = `tb-gallery-reduce-${String(++switches)}`;
}
