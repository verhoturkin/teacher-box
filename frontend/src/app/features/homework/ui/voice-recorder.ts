import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  model,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Tooltip } from 'primeng/tooltip';
import { T } from '../i18n/texts';
import { VoicePlayer, formatDuration } from './voice-player';

/** The browser records sound: the recorder shows only then. */
export function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' && 'mediaDevices' in navigator;
}

/** Chrome and Firefox record webm, Firefox may give ogg, Safari mp4 (FilePolicy accepts all three). */
function voiceFile(chunks: Blob[], mimeType: string, name: string): File {
  const type = mimeType === '' ? 'audio/webm' : (mimeType.split(';')[0] ?? mimeType);
  const extension = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  return new File(chunks, `${name} ${time}.${extension}`, { type });
}

/**
 * A voice answer as one pill: «Записать голос» (tonal) → a red dot, the time and a filled red «stop» → the record
 * in `tb-voice-player` with «Перезаписать» and «Удалить», so the student listens before sending. The record is
 * the `file` model; the page sends it with the answer. A denied microphone leaves a hint.
 */
@Component({
  selector: 'tb-voice-recorder',
  imports: [Button, Message, Tooltip, VoicePlayer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (file(); as recorded) {
      <tb-voice-player [source]="recorded" [duration]="seconds()">
        <p-button
          icon="tb-i tb-i-replay"
          [text]="true"
          [rounded]="true"
          severity="secondary"
          [pTooltip]="t.redoRecording"
          [ariaLabel]="t.redoRecording"
          (onClick)="redo()"
        />
        <p-button
          icon="tb-i tb-i-delete"
          [text]="true"
          [rounded]="true"
          severity="danger"
          [pTooltip]="t.deleteRecording"
          [ariaLabel]="t.deleteRecording"
          (onClick)="file.set(null)"
        />
      </tb-voice-player>
    } @else if (recording()) {
      <div class="tb-voice-pill" role="status">
        <span class="tb-voice-pill__dot" aria-hidden="true"></span>
        <span>{{ t.recording }}</span>
        <span class="tb-voice-pill__time">{{ duration(seconds()) }}</span>
        <span class="tb-voice-pill__spacer"></span>
        <p-button
          icon="tb-i tb-i-stop"
          [rounded]="true"
          severity="danger"
          [pTooltip]="t.stopRecording"
          [ariaLabel]="t.stopRecording"
          (onClick)="stop()"
        />
      </div>
    } @else {
      <p-button
        [label]="t.recordVoice"
        icon="tb-i tb-i-mic"
        [rounded]="true"
        severity="secondary"
        (onClick)="start()"
      />
    }
    @if (denied()) {
      <p-message severity="warn" styleClass="tb-form-message">{{ t.micDenied }}</p-message>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    /* the same pill as tb-voice-player */
    .tb-voice-pill {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      min-block-size: 3rem;
      padding: var(--tb-space-1) var(--tb-space-1) var(--tb-space-1) var(--tb-space-4);
      border-radius: var(--tb-shape-full);
      background: var(--p-md-surface-container-high);
      color: var(--p-md-on-surface);
    }

    .tb-voice-pill__dot {
      inline-size: 0.625rem;
      block-size: 0.625rem;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-error);
    }

    .tb-voice-pill__time {
      font-variant-numeric: tabular-nums;
      color: var(--p-md-on-surface-variant);
    }

    .tb-voice-pill__spacer {
      flex: 1;
    }
  `,
})
export class VoiceRecorder {
  protected readonly t = T.ui;
  readonly file = model<File | null>(null);
  readonly recording = signal(false);
  protected readonly seconds = signal(0);
  protected readonly denied = signal(false);
  /** The take on air; `keep` is read when its recorder stops. */
  private take: { recorder: MediaRecorder; keep: boolean } | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.finish(false);
    });
  }

  async start(): Promise<void> {
    if (this.take) {
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.denied.set(true);
      return;
    }
    this.denied.set(false);
    const take = { recorder: new MediaRecorder(stream), keep: false };
    const chunks: Blob[] = [];
    take.recorder.ondataavailable = (event) => {
      chunks.push(event.data);
    };
    take.recorder.onstop = () => {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      if (take.keep && chunks.length > 0) {
        this.file.set(voiceFile(chunks, take.recorder.mimeType, this.t.voiceName));
      }
    };
    this.take = take;
    take.recorder.start();
    const started = Date.now();
    this.seconds.set(0);
    this.recording.set(true);
    this.timer = setInterval(() => {
      this.seconds.set(Math.floor((Date.now() - started) / 1000));
    }, 250);
  }

  protected stop(): void {
    this.finish(true);
  }

  protected async redo(): Promise<void> {
    this.file.set(null);
    await this.start();
  }

  protected duration(seconds: number): string {
    return formatDuration(seconds);
  }

  private finish(keep: boolean): void {
    clearInterval(this.timer);
    this.recording.set(false);
    if (this.take) {
      this.take.keep = keep;
      this.take.recorder.stop();
      this.take = null;
    }
  }
}
