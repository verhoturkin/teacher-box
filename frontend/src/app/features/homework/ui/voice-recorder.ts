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

/** The browser records sound: the «Записать голос» chip shows only then. */
export function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' && 'mediaDevices' in navigator;
}

/** «0:07», «12:40». */
export function formatDuration(seconds: number): string {
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
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
 * A voice answer: `start()` asks for the microphone and records; the bar shows the duration, «Записать заново»
 * drops the take and starts again, «Остановить» puts the record into `files` — it is sent with the answer like a
 * picked file. A denied microphone leaves a hint instead.
 */
@Component({
  selector: 'tb-voice-recorder',
  imports: [Button, Message, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recording()) {
      <div class="tb-voice" role="status">
        <i class="tb-i tb-i-mic tb-voice__dot" aria-hidden="true"></i>
        <span class="tb-voice__label">{{ t.recording }}</span>
        <span class="tb-voice__time">{{ duration(seconds()) }}</span>
        <span class="tb-voice__spacer"></span>
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
          icon="tb-i tb-i-stop"
          [rounded]="true"
          [pTooltip]="t.stopRecording"
          [ariaLabel]="t.stopRecording"
          (onClick)="stop()"
        />
      </div>
    }
    @if (denied()) {
      <p-message severity="warn" styleClass="tb-form-message">{{ t.micDenied }}</p-message>
    }
  `,
  styles: `
    .tb-voice {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      margin: var(--tb-space-2) 0;
      padding: var(--tb-space-1) var(--tb-space-2) var(--tb-space-1) var(--tb-space-4);
      border-radius: var(--tb-shape-full);
      background: var(--p-md-surface-container-high);
    }

    .tb-voice__dot {
      color: var(--p-md-error);
    }

    .tb-voice__time {
      font-variant-numeric: tabular-nums;
    }

    .tb-voice__spacer {
      flex: 1;
    }
  `,
})
export class VoiceRecorder {
  protected readonly t = T.ui;
  readonly files = model<File[]>([]);
  readonly recording = signal(false);
  protected readonly seconds = signal(0);
  protected readonly denied = signal(false);
  /** The take on air; `keep` is read when its recorder stops, after a «Записать заново» has started the next one. */
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
        const file = voiceFile(chunks, take.recorder.mimeType, this.t.voiceName);
        this.files.update((files) => [...files, file]);
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
    this.finish(false);
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
