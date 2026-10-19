import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { Video } from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { PlayableVideo, VideoPlayer } from './video-player';

/** The name of a video: its title, else «Видео N». */
export function videoName(video: { readonly title: string | null }, index: number): string {
  const title = video.title?.trim() ?? '';
  return title === '' ? T.videos.untitled(index + 1) : title;
}

/**
 * The videos of an assignment (ADR-0047): the player of each and its transcript under a «Расшифровка» toggle — the
 * student gets only the transcripts the teacher shows, the teacher sees whether the student does.
 */
@Component({
  selector: 'tb-video-list',
  imports: [Button, ButtonAttributes, VideoPlayer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (videos().length > 0) {
      <ul class="tb-video-list" [attr.aria-label]="t.list">
        @for (video of videos(); track $index) {
          <li class="tb-video-list__item">
            <span class="tb-video-list__title">{{ name(video, $index) }}</span>
            <tb-video-player [video]="playable(video, $index)" />
            @if (video.transcript; as transcript) {
              <div class="tb-video-list__transcript-bar">
                <p-button
                  [label]="open().has($index) ? t.hideTranscript : t.showTranscript"
                  icon="tb-i tb-i-subtitles"
                  [text]="true"
                  [tbAttributes]="{ 'aria-expanded': open().has($index) ? 'true' : 'false' }"
                  (onClick)="toggle($index)"
                />
                @if (teacher() && video.transcriptShown) {
                  <small class="tb-hint">{{ t.studentSees }}</small>
                }
              </div>
              @if (open().has($index)) {
                <p class="tb-video-list__transcript">{{ transcript }}</p>
              }
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .tb-video-list {
      display: grid;
      gap: var(--tb-space-6);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-video-list__item {
      display: grid;
      gap: var(--tb-space-2);
      min-width: 0;
    }

    .tb-video-list__title {
      font: var(--tb-type-title-m);
      overflow-wrap: anywhere;
    }

    .tb-video-list__transcript-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-video-list__transcript {
      max-height: 20rem;
      margin: 0;
      overflow: auto;
      white-space: pre-line;
      color: var(--p-md-on-surface-variant);
    }
  `,
})
export class VideoList {
  protected readonly t = T.videos;

  readonly videos = input.required<readonly Video[]>();
  /** The teacher's view: marks the transcripts the student sees. */
  readonly teacher = input(false);

  /** Indexes of the videos with the transcript open. */
  protected readonly open = signal<ReadonlySet<number>>(new Set());

  protected name(video: Video, index: number): string {
    return videoName(video, index);
  }

  protected playable(video: Video, index: number): PlayableVideo {
    return { ...video, name: videoName(video, index) };
  }

  protected toggle(index: number): void {
    this.open.update((open) => {
      const next = new Set(open);
      if (!next.delete(index)) {
        next.add(index);
      }
      return next;
    });
  }
}
