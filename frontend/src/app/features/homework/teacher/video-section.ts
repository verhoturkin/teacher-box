import { ChangeDetectionStrategy, Component, inject, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { describeError } from '@core/http/error-messages';
import { Busy } from '@shared/ui/busy';
import { safeConfirmation } from '@shared/ui/confirmation';
import { HomeworkApi } from '../data-access/homework-api';
import { CaptionTrack, CaptionTracks, Video, VideoInput } from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { videoName } from '../ui/video-list';
import { parseVideoLink, subtitlesToTranscript } from '../ui/video-links';
import { PlayableVideo, VideoPlayer } from '../ui/video-player';
import { CaptionLanguageDialog, languageName } from './caption-language-dialog';

/** A video being written in the editor. */
export interface VideoDraft {
  /** Tells the cards apart while the list changes. */
  readonly key: number;
  readonly url: string;
  readonly title: string;
  readonly transcript: string;
  readonly transcriptShown: boolean;
}

/** At most this many videos per assignment (the backend's limit). */
export const MAX_VIDEOS = 5;

let nextKey = 0;

/** A new draft, empty or of a saved video. */
export function videoDraft(video?: Video): VideoDraft {
  nextKey++;
  return {
    key: nextKey,
    url: video?.url ?? '',
    title: video?.title ?? '',
    transcript: video?.transcript ?? '',
    transcriptShown: video?.transcriptShown ?? false,
  };
}

/** The drafts to save: the ones with a link. */
export function videoInputs(drafts: readonly VideoDraft[]): VideoInput[] {
  return drafts
    .filter((draft) => draft.url.trim() !== '')
    .map((draft) => ({
      url: draft.url.trim(),
      title: draft.title.trim() === '' ? null : draft.title.trim(),
      transcript: draft.transcript.trim() === '' ? null : draft.transcript,
      transcriptShown: draft.transcriptShown,
    }));
}

/** A note under a transcript: where it came from, or why it did not come. */
interface TranscriptNote {
  readonly severity: 'info' | 'warn' | 'error';
  readonly text: string;
}

/**
 * The «Видео» section of the assignment editor (ADR-0047): a card per video — the link with its player, the title,
 * the transcript the AI reads («Взять субтитры с YouTube», «Загрузить субтитры» .srt / .vtt) and whether the student
 * sees it; «Добавить видео» up to five.
 */
@Component({
  selector: 'tb-video-section',
  imports: [
    FormsModule,
    Button,
    InputText,
    Textarea,
    ToggleSwitch,
    VideoPlayer,
    CaptionLanguageDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <small class="tb-hint">{{ t.hint }}</small>
    @for (draft of videos(); track draft.key; let index = $index) {
      <section class="tb-video-card" [attr.aria-label]="name(draft, index)">
        <div class="tb-video-card__head">
          <div class="tb-field tb-video-card__url">
            <label [for]="'video-url-' + draft.key">{{ t.url }}</label>
            <input
              pInputText
              type="url"
              [id]="'video-url-' + draft.key"
              [placeholder]="t.urlPlaceholder"
              autocomplete="off"
              [ngModel]="draft.url"
              (ngModelChange)="change(draft.key, { url: $event })"
              [attr.aria-invalid]="invalid(draft) || null"
              [attr.aria-describedby]="invalid(draft) ? 'video-url-error-' + draft.key : null"
            />
            @if (invalid(draft)) {
              <small class="tb-field__error" [id]="'video-url-error-' + draft.key">{{
                t.urlInvalid
              }}</small>
            }
          </div>
          <p-button
            icon="tb-i tb-i-close"
            [text]="true"
            [rounded]="true"
            severity="danger"
            [ariaLabel]="t.remove(name(draft, index))"
            (onClick)="remove(draft.key)"
          />
        </div>

        @if (playable(draft, index); as video) {
          <tb-video-player [video]="video" />
        }

        <div class="tb-field">
          <label [for]="'video-title-' + draft.key">{{ t.videoTitle }}</label>
          <input
            pInputText
            [id]="'video-title-' + draft.key"
            maxlength="200"
            autocomplete="off"
            [ngModel]="draft.title"
            (ngModelChange)="change(draft.key, { title: $event })"
          />
        </div>

        <div class="tb-field">
          <div class="tb-field__header">
            <label [for]="'video-transcript-' + draft.key">{{ t.transcript }}</label>
            <div class="tb-video-card__sources">
              @if (isYoutube(draft)) {
                <p-button
                  [label]="t.fromYoutube"
                  icon="tb-i tb-i-subtitles"
                  severity="secondary"
                  [loading]="taking(draft.key)"
                  (onClick)="fromYoutube(draft)"
                />
              }
              <p-button
                [label]="t.loadSubtitles"
                icon="tb-i tb-i-upload_file"
                [text]="true"
                (onClick)="file.click()"
              />
              <input
                #file
                type="file"
                class="tb-sr-only"
                accept=".srt,.vtt,.txt,text/vtt,text/plain"
                [attr.aria-label]="t.loadSubtitles"
                (change)="loadFile(draft, file)"
              />
            </div>
          </div>
          <textarea
            pTextarea
            class="tb-video-card__transcript"
            [id]="'video-transcript-' + draft.key"
            rows="6"
            maxlength="100000"
            [ngModel]="draft.transcript"
            (ngModelChange)="change(draft.key, { transcript: $event })"
          ></textarea>
          <div role="status" aria-live="polite">
            @if (notes().get(draft.key); as note) {
              <small [class]="note.severity === 'error' ? 'tb-field__error' : 'tb-hint'">{{
                note.text
              }}</small>
            } @else {
              <small class="tb-hint">{{ t.transcriptHint }}</small>
            }
          </div>
        </div>

        <label class="tb-switch" [for]="'video-shown-' + draft.key">
          <p-toggleswitch
            [inputId]="'video-shown-' + draft.key"
            [ngModel]="draft.transcriptShown"
            (ngModelChange)="change(draft.key, { transcriptShown: $event })"
          />
          {{ t.shown }}
        </label>
      </section>
    }
    @if (videos().length < max) {
      <p-button [label]="t.add" icon="tb-i tb-i-add" severity="secondary" (onClick)="add()" />
    }
    <tb-caption-language-dialog
      [visible]="choosing() !== null"
      (visibleChange)="dialogShown($event)"
      [tracks]="choosing()?.tracks ?? null"
      [replacing]="choosing()?.replacing ?? false"
      (chosen)="chose($event)"
    />
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--tb-space-4);
      justify-items: start;
    }

    :host > * {
      max-width: 100%;
    }

    .tb-video-card {
      display: grid;
      gap: var(--tb-space-4);
      width: 100%;
      padding: var(--tb-space-4);
      border-radius: var(--tb-list-outer);
      background: var(--tb-list-item);
      /* Nested corners: the player inside rounds by this tile's corner less its padding, never below 4 px. */
      --tb-list-outer: var(--tb-shape-xs);
    }

    .tb-video-card__head {
      display: flex;
      align-items: flex-start;
      gap: var(--tb-space-2);
    }

    .tb-video-card__url {
      flex: 1;
      min-width: 0;
    }

    .tb-video-card__head p-button {
      margin-top: var(--tb-space-2);
    }

    .tb-video-card__sources {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    .tb-video-card__transcript {
      width: 100%;
    }
  `,
})
export class VideoSection {
  protected readonly t = T.videos;
  protected readonly max = MAX_VIDEOS;
  private readonly api = inject(HomeworkApi);
  private readonly confirmation = inject(ConfirmationService);
  protected readonly busy = new Busy();

  /** The videos of the assignment; every change is a new list. */
  readonly videos = model<readonly VideoDraft[]>([]);
  /** Where each transcript came from, by draft key. */
  protected readonly notes = signal<ReadonlyMap<number, TranscriptNote>>(new Map());
  /** The video whose caption language the teacher picks in the dialog. */
  protected readonly choosing = signal<{
    readonly key: number;
    readonly tracks: CaptionTracks;
    readonly replacing: boolean;
  } | null>(null);

  protected name(draft: VideoDraft, index: number): string {
    return videoName({ title: draft.title }, index);
  }

  /** A link that is not http(s) yet; an empty one is fine (it is skipped on save). */
  protected invalid(draft: VideoDraft): boolean {
    return draft.url.trim() !== '' && parseVideoLink(draft.url) === null;
  }

  protected isYoutube(draft: VideoDraft): boolean {
    return parseVideoLink(draft.url)?.provider === 'YOUTUBE';
  }

  protected playable(draft: VideoDraft, index: number): PlayableVideo | null {
    const parsed = parseVideoLink(draft.url);
    return parsed === null
      ? null
      : { ...parsed, url: draft.url.trim(), name: this.name(draft, index) };
  }

  add(): void {
    this.videos.update((videos) => [...videos, videoDraft()]);
  }

  remove(key: number): void {
    this.videos.update((videos) => videos.filter((video) => video.key !== key));
    this.note(key, null);
  }

  change(key: number, patch: Partial<Omit<VideoDraft, 'key'>>): void {
    this.videos.update((videos) =>
      videos.map((video) => (video.key === key ? { ...video, ...patch } : video)),
    );
  }

  /**
   * «Взять субтитры с YouTube»: several caption tracks — the teacher picks one in the dialog (which also says a
   * written transcript will be replaced); a single track is taken at once, asking before replacing a transcript.
   */
  fromYoutube(draft: VideoDraft): void {
    this.busy.guard(`captions-${String(draft.key)}`, this.api.videoCaptions(draft.url)).subscribe({
      next: (found) => {
        const [only, ...others] = found.tracks;
        if (only !== undefined && others.length === 0) {
          this.replacing(draft, () => {
            this.take(draft.key, only);
          });
        } else {
          this.choosing.set({ key: draft.key, tracks: found, replacing: this.written(draft.key) });
        }
      },
      error: (error: unknown) => {
        this.failed(draft.key, error);
      },
    });
  }

  /** The tracks or the captions of this video are on their way. */
  protected taking(key: number): boolean {
    return this.busy.is(`captions-${String(key)}`) || this.busy.is(`transcript-${String(key)}`);
  }

  protected dialogShown(visible: boolean): void {
    if (!visible) {
      this.choosing.set(null);
    }
  }

  /** The track picked in the dialog. */
  chose(track: CaptionTrack): void {
    const choosing = this.choosing();
    this.choosing.set(null);
    if (choosing !== null) {
      this.take(choosing.key, track);
    }
  }

  private take(key: number, track: CaptionTrack): void {
    const url = this.videos().find((video) => video.key === key)?.url ?? '';
    this.busy.guard(`transcript-${String(key)}`, this.api.videoTranscript(url, track)).subscribe({
      next: (found) => {
        const title = this.videos().find((video) => video.key === key)?.title ?? '';
        this.change(key, {
          transcript: found.transcript,
          title: title.trim() === '' ? (found.title ?? '') : title,
        });
        const fetched = this.t.fetched(languageName(found.language), found.automatic);
        this.note(key, {
          severity: found.truncated ? 'warn' : 'info',
          text: found.truncated ? `${fetched}. ${this.t.truncated}` : fetched,
        });
      },
      error: (error: unknown) => {
        this.failed(key, error);
      },
    });
  }

  private failed(key: number, error: unknown): void {
    this.note(key, { severity: 'error', text: describeError(error, this.t.failed) });
  }

  /** «Загрузить субтитры»: an .srt / .vtt file becomes `[m:ss]` paragraphs. */
  loadFile(draft: VideoDraft, input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) {
      return;
    }
    this.replacing(draft, () => {
      void file.text().then((text) => {
        this.change(draft.key, { transcript: subtitlesToTranscript(text).slice(0, 100_000) });
        this.note(draft.key, { severity: 'info', text: this.t.loaded(file.name) });
      });
    });
  }

  private written(key: number): boolean {
    return (
      (this.videos()
        .find((video) => video.key === key)
        ?.transcript.trim() ?? '') !== ''
    );
  }

  private replacing(draft: VideoDraft, replace: () => void): void {
    if (!this.written(draft.key)) {
      replace();
      return;
    }
    this.confirmation.confirm(
      safeConfirmation({
        header: this.t.replaceHeader,
        message: this.t.replaceMessage,
        acceptLabel: this.t.replace,
        accept: replace,
      }),
    );
  }

  private note(key: number, note: TranscriptNote | null): void {
    this.notes.update((notes) => {
      const next = new Map(notes);
      if (note === null) {
        next.delete(key);
      } else {
        next.set(key, note);
      }
      return next;
    });
  }
}
