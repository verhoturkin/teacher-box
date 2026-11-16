import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Observable } from 'rxjs';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { Attachment } from '../data-access/homework.models';
import { fileIcon, formatFileSize } from '../homework-labels';
import { T } from '../i18n/texts';

/**
 * Files of an assignment or a submission: a card list like the textbooks, the same «×» to remove. The name downloads
 * the file, or — `openable` — opens it (a PDF or a picture in a tab) with the download button beside it. With
 * `audio` (the loader of a file) a sound file gets «Прослушать»: a player under its name.
 */
@Component({
  selector: 'tb-attachment-list',
  imports: [Button, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (attachments().length > 0) {
      <ul class="tb-list tb-attachment-list" [attr.aria-label]="t.files">
        @for (file of attachments(); track file.id) {
          <li>
            <span class="tb-list__lead" aria-hidden="true"><i [class]="icon(file)"></i></span>
            <div class="tb-list__text">
              @if (openable()) {
                <button
                  type="button"
                  class="tb-list__title tb-link-button"
                  [attr.aria-label]="t.openFile(file.filename)"
                  (click)="opened.emit(file)"
                >
                  {{ file.filename }}
                </button>
              } @else {
                <button
                  type="button"
                  class="tb-list__title tb-link-button"
                  (click)="download.emit(file)"
                >
                  {{ file.filename }}
                </button>
              }
              <span class="tb-list__supporting">{{ size(file.size) }}</span>
              @if (sources()[file.id]; as source) {
                <audio class="tb-attachment-list__audio" controls autoplay [src]="source"></audio>
              }
            </div>
            @if (openable() || removable() || playable(file)) {
              <div class="tb-list__trail tb-list__trail--icons">
                @if (playable(file) && !sources()[file.id]) {
                  <p-button
                    icon="tb-i tb-i-play_arrow"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [pTooltip]="t.listen(file.filename)"
                    [ariaLabel]="t.listen(file.filename)"
                    (onClick)="listen(file)"
                  />
                }
                @if (openable()) {
                  <p-button
                    icon="tb-i tb-i-download"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [pTooltip]="t.downloadFile(file.filename)"
                    [ariaLabel]="t.downloadFile(file.filename)"
                    (onClick)="download.emit(file)"
                  />
                }
                @if (removable()) {
                  <p-button
                    icon="tb-i tb-i-close"
                    [text]="true"
                    [rounded]="true"
                    severity="danger"
                    [pTooltip]="t.removeFile(file.filename)"
                    [ariaLabel]="t.removeFile(file.filename)"
                    (onClick)="remove.emit(file)"
                  />
                }
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    /* like the textbooks: apart from the buttons around it */
    .tb-attachment-list {
      margin: var(--tb-space-2) 0;
    }

    .tb-attachment-list__audio {
      display: block;
      inline-size: 100%;
      margin-block-start: var(--tb-space-1);
    }
  `,
})
export class AttachmentList {
  protected readonly t = T.ui;
  readonly attachments = input.required<readonly Attachment[]>();
  readonly removable = input(false);
  /** The name opens the file; downloading it is a button of its own. */
  readonly openable = input(false);
  readonly opened = output<Attachment>();
  readonly download = output<Attachment>();
  readonly remove = output<Attachment>();
  /** Loads a file for the player; without it sound files are only downloaded. */
  readonly audio = input<((attachmentId: string) => Observable<Blob>) | null>(null);
  protected readonly sources = signal<Record<string, string>>({});

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      Object.values(this.sources()).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    });
  }

  protected playable(file: Attachment): boolean {
    return this.audio() !== null && file.contentType.startsWith('audio/');
  }

  protected listen(file: Attachment): void {
    this.audio()?.(file.id).subscribe((blob) => {
      this.sources.update((sources) => ({ ...sources, [file.id]: URL.createObjectURL(blob) }));
    });
  }

  protected icon(file: Attachment): string {
    return fileIcon(file.contentType);
  }

  protected size(bytes: number): string {
    return formatFileSize(bytes);
  }
}
