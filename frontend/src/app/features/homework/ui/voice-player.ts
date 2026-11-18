import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Observable, of } from 'rxjs';
import { Button } from 'primeng/button';
import { T } from '../i18n/texts';

/** «0:07», «12:40». */
export function formatDuration(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * A voice record as a compact pill: a filled play / pause button, a seekable bar, «0:04 / 0:12» and the host's
 * icon buttons after it (`<ng-content>`). The sound plays in a hidden `<audio>`, no native controls. `source` is
 * the record itself or the loader of a saved file; `duration` is the known length (a fresh record), else the
 * player measures it.
 */
@Component({
  selector: 'tb-voice-player',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-voice-pill">
      <p-button
        [icon]="playing() ? 'tb-i tb-i-pause' : 'tb-i tb-i-play_arrow'"
        [rounded]="true"
        [ariaLabel]="playing() ? t.pause : t.play"
        [disabled]="url() === null"
        (onClick)="toggle()"
      />
      <input
        type="range"
        class="tb-voice-pill__track"
        min="0"
        step="0.1"
        [max]="total()"
        [value]="current()"
        [style.--tb-voice-progress]="progress()"
        [attr.aria-label]="t.position"
        [attr.aria-valuetext]="time()"
        (input)="seek($event)"
      />
      <span class="tb-voice-pill__time">{{ time() }}</span>
      <ng-content />
    </div>
    <audio
      #audio
      preload="metadata"
      [src]="url() ?? ''"
      (loadedmetadata)="measure()"
      (durationchange)="measure()"
      (timeupdate)="moved()"
      (play)="playing.set(true)"
      (pause)="playing.set(false)"
      (ended)="playing.set(false)"
    ></audio>
  `,
  styles: `
    :host {
      display: block;
    }

    /* our decision (M3 publishes no audio player): a full-corner pill on the next tonal surface step */
    .tb-voice-pill {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      min-block-size: 3rem;
      padding: var(--tb-space-1) var(--tb-space-2) var(--tb-space-1) var(--tb-space-1);
      border-radius: var(--tb-shape-full);
      background: var(--p-md-surface-container-high);
      color: var(--p-md-on-surface);
    }

    /* the M3 linear progress look: a 4 dp primary track on secondary-container */
    .tb-voice-pill__track {
      flex: 1;
      min-inline-size: 4rem;
      block-size: 1.5rem;
      margin: 0;
      background: transparent;
      appearance: none;
      cursor: pointer;
    }

    .tb-voice-pill__track::-webkit-slider-runnable-track {
      block-size: 0.25rem;
      border-radius: var(--tb-shape-full);
      background: linear-gradient(
        to right,
        var(--p-md-primary) var(--tb-voice-progress, 0%),
        var(--p-md-secondary-container) var(--tb-voice-progress, 0%)
      );
    }

    .tb-voice-pill__track::-moz-range-track {
      block-size: 0.25rem;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-secondary-container);
    }

    .tb-voice-pill__track::-moz-range-progress {
      block-size: 0.25rem;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-primary);
    }

    .tb-voice-pill__track::-webkit-slider-thumb {
      inline-size: 0.25rem;
      block-size: 1rem;
      margin-block-start: calc(-1 * var(--tb-space-1-5));
      border: 0;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-primary);
      appearance: none;
    }

    .tb-voice-pill__track::-moz-range-thumb {
      inline-size: 0.25rem;
      block-size: 1rem;
      border: 0;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-primary);
    }

    .tb-voice-pill__track:focus-visible {
      outline: 2px solid var(--p-md-primary);
      outline-offset: 2px;
    }

    .tb-voice-pill__time {
      font-variant-numeric: tabular-nums;
      color: var(--p-md-on-surface-variant);
      white-space: nowrap;
    }
  `,
})
export class VoicePlayer implements OnInit {
  protected readonly t = T.ui;
  readonly source = input.required<Blob | (() => Observable<Blob>)>();
  readonly duration = input<number | null>(null);
  protected readonly url = signal<string | null>(null);
  protected readonly playing = signal(false);
  protected readonly current = signal(0);
  private readonly measured = signal<number | null>(null);
  protected readonly total = computed(() => this.measured() ?? this.duration() ?? 0);
  protected readonly time = computed(
    () => `${formatDuration(this.current())} / ${formatDuration(this.total())}`,
  );
  protected readonly progress = computed(() =>
    this.total() > 0 ? `${String(Math.min(100, (this.current() / this.total()) * 100))}%` : '0%',
  );
  private readonly audio = viewChild.required<ElementRef<HTMLAudioElement>>('audio');
  private readonly destroyRef = inject(DestroyRef);
  /** Chrome gives a recorded webm no duration until it has seen the end: the player seeks there once. */
  private probing = false;

  ngOnInit(): void {
    const source = this.source();
    const subscription = (source instanceof Blob ? of(source) : source()).subscribe((blob) => {
      this.url.set(URL.createObjectURL(blob));
    });
    this.destroyRef.onDestroy(() => {
      subscription.unsubscribe();
      const url = this.url();
      if (url !== null) {
        URL.revokeObjectURL(url);
      }
    });
  }

  protected toggle(): void {
    const audio = this.audio().nativeElement;
    if (audio.paused) {
      audio.play().catch(() => {
        this.playing.set(false);
      });
    } else {
      audio.pause();
    }
  }

  protected seek(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      const position = Number(event.target.value);
      this.audio().nativeElement.currentTime = position;
      this.current.set(position);
    }
  }

  protected measure(): void {
    const audio = this.audio().nativeElement;
    if (Number.isFinite(audio.duration)) {
      this.measured.set(audio.duration);
      if (this.probing) {
        this.probing = false;
        audio.currentTime = 0;
      }
    } else if (!this.probing && audio.duration === Infinity) {
      this.probing = true;
      audio.currentTime = Number.MAX_SAFE_INTEGER;
    }
  }

  protected moved(): void {
    if (!this.probing) {
      this.current.set(this.audio().nativeElement.currentTime);
    }
  }
}
