import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { VideoProvider } from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { embedUrl } from './video-links';

/** What the player needs of a video, saved or being written in the editor. */
export interface PlayableVideo {
  readonly url: string;
  readonly provider: VideoProvider;
  readonly videoId: string | null;
  readonly startSeconds: number | null;
  /** Names the player for a screen reader. */
  readonly name: string;
}

/**
 * The player of a video by link (ADR-0047): YouTube (no-cookie), Rutube or VK Video in a 16:9 frame; any other link
 * is a tile that opens it in a new tab. Both round by the container's nested corner (`--tb-list-outer`, design system
 * §1); the tile has the tone of list tiles and the hover state layer of a row that acts.
 */
@Component({
  selector: 'tb-video-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (frame(); as src) {
      <div class="tb-video-player">
        <iframe
          [src]="src"
          [title]="t.player(video().name)"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"
          loading="lazy"
        ></iframe>
      </div>
    } @else {
      <a class="tb-video-link" [href]="video().url" target="_blank" rel="noopener noreferrer">
        <i class="tb-i tb-i-open_in_new" aria-hidden="true"></i>
        <span class="tb-video-link__text">
          <span>{{ t.openLink }}</span>
          <span class="tb-video-link__url">{{ video().url }}</span>
        </span>
      </a>
    }
  `,
  styles: `
    .tb-video-player {
      aspect-ratio: 16 / 9;
      width: 100%;
      overflow: hidden;
      border-radius: var(--tb-list-outer);
      background: var(--p-md-surface-container-highest);
    }

    .tb-video-player iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
    }

    .tb-video-link {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      min-height: 3.5rem;
      padding: var(--tb-space-3) var(--tb-space-4);
      border-radius: var(--tb-list-outer);
      background: var(--tb-list-item);
      color: var(--p-md-on-surface);
      text-decoration: none;
      transition: background-color var(--tb-spring-fast-effects);
    }

    .tb-video-link:hover {
      background: color-mix(
        in srgb,
        var(--p-md-on-surface) var(--tb-state-hover),
        var(--tb-list-item)
      );
    }

    .tb-video-link:focus-visible {
      outline: 3px solid var(--p-md-secondary);
      outline-offset: 2px;
    }

    .tb-video-link .tb-i {
      color: var(--p-md-on-surface-variant);
    }

    .tb-video-link__text {
      display: grid;
      min-width: 0;
    }

    .tb-video-link__url {
      overflow: hidden;
      color: var(--p-md-on-surface-variant);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class VideoPlayer {
  protected readonly t = T.videos;
  private readonly sanitizer = inject(DomSanitizer);

  readonly video = input.required<PlayableVideo>();

  /** Built only from a checked video ID on an allowed host (`embedUrl`), so trusting it is safe. */
  protected readonly frame = computed<SafeResourceUrl | null>(() => {
    const src = embedUrl(this.video());
    return src === null ? null : this.sanitizer.bypassSecurityTrustResourceUrl(src);
  });
}
