import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { Card } from 'primeng/card';
import { InputChip } from '@shared/ui/input-chip';
import { T } from '@features/homework/i18n/texts';
import { MAX_VIDEOS, VideoDraft, VideoSection } from '../video-section';

/** «Видео» of the assignment editor: the videos by link (ADR-0047) and how many more fit. */
@Component({
  selector: 'tb-editor-videos',
  imports: [Card, VideoSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <p-card id="editor-videos" styleClass="tb-section-card" class="tb-editor__videos">
      <div class="tb-editor__card-head">
        <h2 class="tb-subtitle">{{ t.videosTitle }}</h2>
        <span class="tb-hint">{{ t.videoCount(videos().length, maxVideos) }}</span>
      </div>
      <tb-video-section [videos]="videos()" (videosChange)="videosChange.emit($event)" />
    </p-card>
  `,
  styles: `
    .tb-editor__card-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--tb-space-2) var(--tb-space-4);
      margin-block-end: var(--tb-space-3);
    }
  `,
})
export class EditorVideos {
  protected readonly t = T.editor;
  protected readonly maxVideos = MAX_VIDEOS;

  readonly videos = input.required<readonly VideoDraft[]>();
  readonly videosChange = output<readonly VideoDraft[]>();
  private readonly section = viewChild(VideoSection);

  /** «Видео» of the materials or the section menu: the link field takes the focus. */
  focusLink(): void {
    this.section()?.focusLink();
  }
}

/** «Доска» of the assignment editor: the board the assignment goes on once it is given out or saved. */
@Component({
  selector: 'tb-editor-board',
  imports: [Card, InputChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <p-card id="editor-board" styleClass="tb-section-card" class="tb-editor__board">
      <h2 class="tb-subtitle tb-editor__card-head">{{ t.boardTitle }}</h2>
      <div class="tb-editor__chips">
        <tb-input-chip [label]="title()" [removeLabel]="c.remove" (removed)="removed.emit()">
          <i lead class="tb-i tb-i-co_present" aria-hidden="true"></i>
        </tb-input-chip>
      </div>
      <p class="tb-hint">{{ draft() ? t.boardOnAssign : t.boardOnSave }}</p>
    </p-card>
  `,
  styles: `
    .tb-editor__card-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--tb-space-2) var(--tb-space-4);
      margin-block-end: var(--tb-space-3);
    }

    .tb-editor__chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }
  `,
})
export class EditorBoard {
  protected readonly t = T.editor;
  protected readonly c = T.create;

  /** The chosen board's title. */
  readonly title = input.required<string>();
  readonly draft = input.required<boolean>();
  readonly removed = output();
}
