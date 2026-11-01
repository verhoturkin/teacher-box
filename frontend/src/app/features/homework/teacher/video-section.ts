import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { InputText } from 'primeng/inputtext';
import { Menu } from 'primeng/menu';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { describeError } from '@core/http/error-messages';
import { locale } from '@core/i18n/language';
import { AssistChip } from '@shared/ui/assist-chip';
import { Busy } from '@shared/ui/busy';
import { Confirm } from '@shared/ui/confirm';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { RowType } from '@shared/ui/row-type.directive';
import { HomeworkApi } from '../data-access/homework-api';
import { CaptionTrack, CaptionTracks, Video, VideoInput } from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { videoName } from '../ui/video-list';
import { ParsedVideo, clock, parseVideoLink, subtitlesToTranscript } from '../ui/video-links';
import { PlayableVideo, VideoPlayer } from '../ui/video-player';
import { arrowStep, reordered } from './question-editor';

/** A video being written in the editor. */
export interface VideoDraft {
  /** Tells the tiles apart while the list changes. */
  readonly key: number;
  readonly url: string;
  readonly title: string;
  readonly transcript: string;
  readonly transcriptShown: boolean;
}

/** At most this many videos per assignment (the backend's limit). */
export const MAX_VIDEOS = 5;

let nextKey = 0;

/** A new draft, empty, of a link or of a saved video. */
export function videoDraft(video?: Partial<Video>): VideoDraft {
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

/** The name of a caption language in the interface language: `en` → «английский»; an unknown code stays as is. */
export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames([locale()], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** A line of a transcript: `[1:05] text` → 65 s and the text; a line without a time has `null`. */
export interface TranscriptLine {
  readonly seconds: number | null;
  readonly text: string;
}

const LINE_TIME = /^\[(?:(\d+):)?(\d{1,2}):(\d{2})\]\s*(.*)$/;

export function transcriptLines(transcript: string): TranscriptLine[] {
  return transcript
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const match = LINE_TIME.exec(line);
      return match === null
        ? { seconds: null, text: line }
        : {
            seconds:
              Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0),
            text: match[4] ?? '',
          };
    });
}

/** A note under a transcript: where it came from, or why it did not come. */
interface TranscriptNote {
  readonly severity: 'info' | 'warn' | 'error';
  readonly text: string;
}

/**
 * The videos of an assignment (ADR-0047) as tiles: preview, name, source, whether there is a transcript and whether
 * the student sees it; the tiles reorder by drag (or the arrow keys on the handle), one link field under them adds
 * the next video. «Настроить» opens the side sheet of a video (a phone: the whole screen) — player, title, the
 * transcript as timed lines («Субтитры YouTube» with a menu of tracks, «Из файла», «Править текст»), «Показывать
 * расшифровку ученику», «Убрать видео» and ‹ › between videos. `quick` (the quick dialog) — small tiles with «×» only.
 */
@Component({
  selector: 'tb-video-section',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    FormsModule,
    AssistChip,
    Button,
    Drawer,
    InputText,
    Menu,
    ModalDrawer,
    RowType,
    Tag,
    Textarea,
    ToggleSwitch,
    VideoPlayer,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (videos().length > 0) {
      <ul
        class="tb-video-tiles"
        [class.tb-video-tiles--quick]="quick()"
        [attr.aria-label]="t.list"
        cdkDropList
        [cdkDropListDisabled]="quick()"
        (cdkDropListDropped)="drop($event)"
      >
        @for (draft of videos(); track draft.key; let index = $index) {
          <li class="tb-video-tile" cdkDrag>
            @if (!quick()) {
              <button
                type="button"
                class="tb-drag-handle"
                cdkDragHandle
                [attr.data-handle]="draft.key"
                [attr.aria-label]="t.drag(name(draft, index))"
                (keydown)="keyMove($event, draft.key)"
              >
                <i class="tb-i tb-i-drag_indicator" aria-hidden="true"></i>
              </button>
            }
            <span class="tb-video-tile__preview">
              @if (thumbnail(draft); as src) {
                <img [src]="src" alt="" loading="lazy" referrerpolicy="no-referrer" />
              } @else {
                <i class="tb-i {{ icon(draft) }}" aria-hidden="true"></i>
              }
            </span>
            <span class="tb-video-tile__text">
              <span class="tb-video-tile__title">{{ name(draft, index) }}</span>
              <span class="tb-video-tile__source">{{ source(draft) }}</span>
              @if (!quick()) {
                <span class="tb-video-tile__tags">
                  @if (draft.transcript.trim() !== '') {
                    <p-tag
                      severity="success"
                      icon="tb-i tb-i-subtitles"
                      [value]="t.withTranscript"
                    />
                    @if (draft.transcriptShown) {
                      <p-tag
                        severity="info"
                        icon="tb-i tb-i-visibility"
                        [value]="t.studentSeesTag"
                      />
                    }
                  } @else {
                    <p-tag severity="secondary" [value]="t.noTranscript" />
                  }
                </span>
              }
            </span>
            @if (quick()) {
              <p-button
                icon="tb-i tb-i-close"
                [text]="true"
                [rounded]="true"
                severity="secondary"
                [ariaLabel]="t.remove(name(draft, index))"
                (onClick)="remove(draft.key)"
              />
            } @else {
              <p-button
                icon="tb-i tb-i-tune"
                [text]="true"
                [rounded]="true"
                severity="secondary"
                [ariaLabel]="t.configure(name(draft, index))"
                (onClick)="openKey.set(draft.key)"
              />
            }
          </li>
        }
      </ul>
    }

    @if (videos().length < max) {
      <div class="tb-field tb-video-link-field">
        <label for="video-link" class="tb-sr-only">{{ t.url }}</label>
        <input
          #linkField
          pInputText
          id="video-link"
          type="url"
          [placeholder]="t.paste"
          autocomplete="off"
          [ngModel]="link()"
          (ngModelChange)="typed($event)"
          (keydown.enter)="commit()"
          (blur)="commit()"
          [attr.aria-invalid]="linkInvalid() || null"
          aria-describedby="video-link-note"
        />
        <small id="video-link-note" [class]="linkInvalid() ? 'tb-field__error' : 'tb-hint'">{{
          linkInvalid() ? t.urlInvalid : t.hint
        }}</small>
      </div>
    }

    <p-drawer
      tbModalDrawer
      [visible]="current() !== null"
      (visibleChange)="$event || openKey.set(null)"
      position="right"
      appendTo="body"
      [blockScroll]="true"
      [ariaCloseLabel]="t.close"
      styleClass="tb-side-sheet tb-side-sheet--narrow"
      [header]="current() === null ? '' : t.ofCount(currentIndex() + 1, videos().length)"
    >
      @if (current(); as draft) {
        <div class="tb-video-sheet">
          @if (playable(draft); as video) {
            <tb-video-player [video]="video" />
          }

          <div class="tb-field">
            <label for="video-title">{{ t.videoTitle }}</label>
            <input
              pInputText
              id="video-title"
              maxlength="200"
              autocomplete="off"
              [placeholder]="name(draft, currentIndex())"
              [ngModel]="draft.title"
              (ngModelChange)="change(draft.key, { title: $event })"
            />
          </div>

          <h3 class="tb-subtitle tb-video-sheet__heading">{{ t.transcript }}</h3>
          <div class="tb-video-sheet__sources">
            @if (isYoutube(draft)) {
              <tb-assist-chip
                icon="closed_caption"
                [attr.aria-busy]="taking(draft.key) || null"
                (click)="fromYoutube(draft, $event)"
                >{{ t.fromYoutube }}</tb-assist-chip
              >
            }
            <tb-assist-chip icon="upload_file" (click)="file.click()">{{
              t.loadSubtitles
            }}</tb-assist-chip>
            <tb-assist-chip
              icon="edit"
              [attr.aria-pressed]="editing()"
              (click)="editing.set(!editing())"
              >{{ t.editText }}</tb-assist-chip
            >
            <input
              #file
              type="file"
              class="tb-sr-only"
              tabindex="-1"
              accept=".srt,.vtt,.txt,text/vtt,text/plain"
              [attr.aria-label]="t.loadSubtitles"
              (change)="loadFile(draft, file)"
            />
          </div>
          <div role="status" aria-live="polite">
            @if (notes().get(draft.key); as note) {
              <small [class]="note.severity === 'error' ? 'tb-field__error' : 'tb-hint'">{{
                note.text
              }}</small>
            }
          </div>

          @if (editing() || draft.transcript.trim() === '') {
            <div class="tb-field">
              <label for="video-transcript" class="tb-sr-only">{{ t.transcript }}</label>
              <textarea
                pTextarea
                id="video-transcript"
                rows="8"
                maxlength="100000"
                [ngModel]="draft.transcript"
                (ngModelChange)="editing.set(true); change(draft.key, { transcript: $event })"
                aria-describedby="video-transcript-hint"
              ></textarea>
              <small class="tb-hint" id="video-transcript-hint">{{ t.transcriptHint }}</small>
            </div>
          } @else {
            <ol class="tb-video-sheet__lines" [attr.aria-label]="t.transcript">
              @for (line of lines(); track $index) {
                <li>
                  @if (line.seconds === null) {
                    <span class="tb-video-sheet__time"></span>
                  } @else if (seekable(draft)) {
                    <button
                      type="button"
                      class="tb-video-sheet__time"
                      [attr.aria-label]="t.seek(clock(line.seconds))"
                      (click)="seek(line.seconds)"
                    >
                      {{ clock(line.seconds) }}
                    </button>
                  } @else {
                    <span class="tb-video-sheet__time">{{ clock(line.seconds) }}</span>
                  }
                  <span>{{ line.text }}</span>
                </li>
              }
            </ol>
          }

          <label class="tb-switch" for="video-shown">
            <span class="tb-video-sheet__switch-text">
              {{ t.shown }}
              <small class="tb-hint">{{ t.shownHint }}</small>
            </span>
            <p-toggleswitch
              inputId="video-shown"
              [ngModel]="draft.transcriptShown"
              (ngModelChange)="change(draft.key, { transcriptShown: $event })"
            />
          </label>

          <div class="tb-video-sheet__footer">
            <p-button
              [label]="t.removeVideo"
              icon="tb-i tb-i-delete"
              [text]="true"
              severity="danger"
              (onClick)="remove(draft.key)"
            />
            <span class="tb-video-sheet__spacer"></span>
            <p-button
              icon="tb-i tb-i-chevron_left"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [ariaLabel]="t.previous"
              [disabled]="currentIndex() === 0"
              (onClick)="step(-1)"
            />
            <p-button
              icon="tb-i tb-i-chevron_right"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [ariaLabel]="t.next"
              [disabled]="currentIndex() === videos().length - 1"
              (onClick)="step(1)"
            />
          </div>
        </div>
      }
    </p-drawer>

    <p-menu
      #tracksMenu
      [model]="trackItems()"
      [popup]="true"
      appendTo="body"
      [ariaLabel]="t.tracks"
    >
      <ng-template #item let-item [tbRowType]="trackItems()">
        <a class="p-menu-item-link tb-type-item" data-pc-section="itemlink" tabindex="-1">
          <span class="tb-type-item__text">
            <span>{{ item.label }}</span>
            <small>{{ item.title }}</small>
          </span>
        </a>
      </ng-template>
    </p-menu>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--tb-space-4);
      width: 100%;
    }

    /* Ours: tiles of a list group (4 px inside, the container's nested corner outside, 2 px gap) */
    .tb-video-tiles {
      display: grid;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-video-tile {
      display: flex;
      align-items: center;
      gap: var(--tb-space-4);
      padding: var(--tb-space-3) var(--tb-space-2) var(--tb-space-3) var(--tb-space-1);
      border-radius: var(--tb-list-inner);
      background: var(--tb-list-item);

      &:first-child {
        border-start-start-radius: var(--tb-list-outer);
        border-start-end-radius: var(--tb-list-outer);
      }

      &:last-child {
        border-end-start-radius: var(--tb-list-outer);
        border-end-end-radius: var(--tb-list-outer);
      }
    }

    .tb-video-tile.cdk-drag-preview {
      box-shadow: var(--tb-elevation-2);
    }

    .tb-video-tile.cdk-drag-placeholder {
      opacity: 0.4;
    }

    /* The 16:9 preview: 128 × 72 (the sketch), 96 × 54 in the quick dialog; 8 dp corners (M3 small) */
    .tb-video-tile__preview {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      inline-size: 8rem;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border-radius: var(--tb-shape-sm);
      background: var(--p-md-surface-container-highest);
      color: var(--p-md-on-surface-variant);

      img {
        inline-size: 100%;
        block-size: 100%;
        object-fit: cover;
      }
    }

    .tb-video-tiles--quick {
      .tb-video-tile {
        padding: var(--tb-space-2);
      }

      .tb-video-tile__preview {
        inline-size: 6rem;
      }
    }

    .tb-video-tile__text {
      display: grid;
      flex: 1;
      gap: var(--tb-space-1);
      min-inline-size: 0;
    }

    .tb-video-tile__title {
      overflow: hidden;
      font: var(--tb-type-body-l);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tb-video-tile__source {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }

    .tb-video-tile__tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    .tb-video-link-field input {
      width: 100%;
    }

    @media (width < 37.5em) {
      .tb-video-tile__preview {
        inline-size: 6rem;
      }
    }

    .tb-video-sheet {
      display: grid;
      gap: var(--tb-space-4);
      /* the player rounds by the sheet's corner less its padding (28 − 24), never below 4 px */
      --tb-list-outer: var(--tb-shape-xs);

      input,
      textarea {
        width: 100%;
      }
    }

    .tb-video-sheet__heading {
      margin: 0;
    }

    .tb-video-sheet__sources {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    .tb-video-sheet__lines {
      display: grid;
      gap: var(--tb-space-2);
      margin: 0;
      padding: var(--tb-space-3) var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface);
      list-style: none;
      font: var(--tb-type-body-m);

      li {
        display: flex;
        gap: var(--tb-space-3);
      }
    }

    .tb-video-sheet__time {
      flex: none;
      inline-size: 3.5rem;
      padding: 0;
      border: 0;
      background: none;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);
      font-variant-numeric: tabular-nums;
      text-align: start;
    }

    button.tb-video-sheet__time {
      color: var(--p-md-primary);
      cursor: pointer;
      text-decoration: underline;
    }

    .tb-video-sheet__switch-text {
      display: grid;
      flex: 1;
    }

    .tb-video-sheet__footer {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
      padding-top: var(--tb-space-3);
      border-top: 1px solid var(--p-md-outline-variant);
    }

    .tb-video-sheet__spacer {
      flex: 1;
    }
  `,
})
export class VideoSection {
  protected readonly t = T.videos;
  protected readonly max = MAX_VIDEOS;
  protected readonly clock = clock;
  private readonly api = inject(HomeworkApi);
  private readonly confirm = inject(Confirm);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly busy = new Busy();
  private readonly linkInput = viewChild<ElementRef<HTMLInputElement>>('linkField');
  private readonly tracksMenu = viewChild.required<Menu>('tracksMenu');

  /** The videos of the assignment; every change is a new list. */
  readonly videos = model<readonly VideoDraft[]>([]);
  /** The quick dialog: small tiles with «×», no settings. */
  readonly quick = input(false, { transform: booleanAttribute });

  /** The text of the link field. */
  protected readonly link = signal('');
  protected readonly linkInvalid = signal(false);
  /** The video whose side sheet is open. */
  readonly openKey = signal<number | null>(null);
  protected readonly current = computed(
    () => this.videos().find((video) => video.key === this.openKey()) ?? null,
  );
  protected readonly currentIndex = computed(() =>
    this.videos().findIndex((video) => video.key === this.openKey()),
  );
  protected readonly lines = computed(() => transcriptLines(this.current()?.transcript ?? ''));
  /** «Править текст»: the transcript as a text area instead of timed lines. */
  protected readonly editing = signal(false);
  /** A time of the transcript chosen: the player starts there. */
  private readonly start = signal<{ readonly key: number; readonly seconds: number } | null>(null);
  /** Where each transcript came from, by draft key. */
  protected readonly notes = signal<ReadonlyMap<number, TranscriptNote>>(new Map());
  /** The tracks of «Субтитры YouTube» for the menu. */
  protected readonly trackItems = signal<MenuItem[]>([]);

  protected name(draft: VideoDraft, index: number): string {
    return videoName({ title: draft.title }, index);
  }

  private parsed(draft: VideoDraft): ParsedVideo | null {
    return parseVideoLink(draft.url);
  }

  protected isYoutube(draft: VideoDraft): boolean {
    return this.parsed(draft)?.provider === 'YOUTUBE';
  }

  /** Only the YouTube player starts at a time of its address. */
  protected seekable(draft: VideoDraft): boolean {
    return this.isYoutube(draft);
  }

  /** YouTube's public preview; the other players publish none, so their tile shows the source icon. */
  protected thumbnail(draft: VideoDraft): string | null {
    const parsed = this.parsed(draft);
    return parsed?.provider === 'YOUTUBE' && parsed.videoId !== null
      ? `https://i.ytimg.com/vi/${parsed.videoId}/mqdefault.jpg`
      : null;
  }

  protected icon(draft: VideoDraft): string {
    return this.parsed(draft)?.provider === 'OTHER' ? 'tb-i-open_in_new' : 'tb-i-smart_display';
  }

  protected source(draft: VideoDraft): string {
    const parsed = this.parsed(draft);
    if (parsed === null || parsed.provider === 'OTHER') {
      return this.t.noPlayer;
    }
    const name = this.t.providers[parsed.provider];
    return parsed.startSeconds === null ? name : this.t.from(name, clock(parsed.startSeconds));
  }

  protected playable(draft: VideoDraft): PlayableVideo | null {
    const parsed = this.parsed(draft);
    if (parsed === null) {
      return null;
    }
    const start = this.start();
    return {
      ...parsed,
      startSeconds: start?.key === draft.key ? start.seconds : parsed.startSeconds,
      url: draft.url.trim(),
      name: this.name(draft, this.currentIndex()),
    };
  }

  /** The chip «Видео» of the host: the focus goes to the link field. */
  focusLink(): void {
    this.linkInput()?.nativeElement.focus();
  }

  /** A link of a known player becomes a tile at once; any other waits for Enter or leaving the field. */
  protected typed(text: string): void {
    this.link.set(text);
    this.linkInvalid.set(false);
    const parsed = parseVideoLink(text);
    if (parsed !== null && parsed.provider !== 'OTHER') {
      this.commit();
    }
  }

  commit(): void {
    const url = this.link().trim();
    if (url === '') {
      this.linkInvalid.set(false);
      return;
    }
    if (parseVideoLink(url) === null) {
      this.linkInvalid.set(true);
      return;
    }
    this.link.set('');
    // the model may already be '' (a link pasted into an empty field): clear the field itself too
    const field = this.linkInput()?.nativeElement;
    if (field !== undefined) {
      field.value = '';
    }
    this.linkInvalid.set(false);
    this.videos.update((videos) =>
      videos.length < MAX_VIDEOS ? [...videos, videoDraft({ url })] : videos,
    );
  }

  remove(key: number): void {
    if (this.openKey() === key) {
      this.openKey.set(null);
    }
    this.videos.update((videos) => videos.filter((video) => video.key !== key));
    this.note(key, null);
  }

  change(key: number, patch: Partial<Omit<VideoDraft, 'key'>>): void {
    this.videos.update((videos) =>
      videos.map((video) => (video.key === key ? { ...video, ...patch } : video)),
    );
  }

  protected step(by: -1 | 1): void {
    const next = this.videos()[this.currentIndex() + by];
    if (next !== undefined) {
      this.editing.set(false);
      this.openKey.set(next.key);
    }
  }

  protected seek(seconds: number): void {
    const key = this.openKey();
    if (key !== null) {
      this.start.set({ key, seconds });
    }
  }

  protected drop(event: CdkDragDrop<unknown>): void {
    this.videos.update((list) => reordered(list, event.previousIndex, event.currentIndex));
  }

  /** The arrow keys on a handle move the tile; the focus stays on its handle. */
  protected keyMove(event: KeyboardEvent, key: number): void {
    const by = arrowStep(event);
    const list = this.videos();
    const from = list.findIndex((video) => video.key === key);
    if (by === null || list[from + by] === undefined) {
      return;
    }
    event.preventDefault();
    this.videos.set(reordered(list, from, from + by));
    afterNextRender(
      () => {
        this.host.nativeElement
          .querySelector<HTMLElement>(`[data-handle="${String(key)}"]`)
          ?.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * «Субтитры YouTube»: one track is taken at once (asking before replacing a transcript); several open a menu of
   * tracks — the suggested one first, the note says the transcript will be replaced.
   */
  fromYoutube(draft: VideoDraft, event: Event): void {
    const target = event.currentTarget;
    this.busy.guard(`captions-${String(draft.key)}`, this.api.videoCaptions(draft.url)).subscribe({
      next: (found) => {
        const [only, ...others] = found.tracks;
        if (only !== undefined && others.length === 0) {
          void this.replacing(draft, () => {
            this.take(draft.key, only);
          });
        } else {
          this.trackItems.set(this.menuOf(draft.key, found));
          this.tracksMenu().show({ currentTarget: target });
        }
      },
      error: (error: unknown) => {
        this.failed(draft.key, error);
      },
    });
  }

  private menuOf(key: number, found: CaptionTracks): MenuItem[] {
    const suggested = found.suggested;
    const items = [
      suggested,
      ...found.tracks.filter(
        (track) => track.language !== suggested.language || track.automatic !== suggested.automatic,
      ),
    ].map((track) => ({
      label: capitalized(languageName(track.language)),
      title: track.automatic ? this.t.automatic : this.t.author,
      command: () => {
        this.take(key, track);
      },
    }));
    return this.written(key) ? [{ label: this.t.replacing, items }] : items;
  }

  /** The tracks or the captions of this video are on their way. */
  protected taking(key: number): boolean {
    return this.busy.is(`captions-${String(key)}`) || this.busy.is(`transcript-${String(key)}`);
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
        this.editing.set(false);
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

  /** «Из файла»: an .srt / .vtt file becomes `[m:ss]` paragraphs. */
  loadFile(draft: VideoDraft, input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) {
      return;
    }
    void this.replacing(draft, () => {
      void file.text().then((text) => {
        this.change(draft.key, { transcript: subtitlesToTranscript(text).slice(0, 100_000) });
        this.editing.set(false);
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

  private async replacing(draft: VideoDraft, replace: () => void): Promise<void> {
    if (!this.written(draft.key)) {
      replace();
      return;
    }
    if (
      await this.confirm.safe({
        header: this.t.replaceHeader,
        message: this.t.replaceMessage,
        acceptLabel: this.t.replace,
      })
    ) {
      replace();
    }
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

function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase(locale()) + text.slice(1);
}
