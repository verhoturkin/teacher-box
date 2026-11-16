import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { EMPTY, Observable } from 'rxjs';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { Attachment } from '../data-access/homework.models';
import { fileIcon, formatFileSize } from '../homework-labels';
import { T } from '../i18n/texts';
import { VoicePlayer } from './voice-player';

/**
 * Files of an assignment or a submission: a card list like the textbooks, the same «×» to remove. The name downloads
 * the file, or — `openable` — opens it (a PDF or a picture in a tab) with the download button beside it. With
 * `audio` (the loader of a file) a sound file is a voice pill (`tb-voice-player`) instead: it plays in place.
 */
@Component({
  selector: 'tb-attachment-list',
  imports: [Button, Tooltip, VoicePlayer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (attachments().length > 0) {
      <ul class="tb-list tb-attachment-list" [attr.aria-label]="t.files">
        @for (file of attachments(); track file.id) {
          @if (playable(file)) {
            <li class="tb-attachment-list__voice">
              <tb-voice-player [source]="loader(file)" />
            </li>
          } @else {
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
              </div>
              @if (openable() || removable()) {
                <div class="tb-list__trail tb-list__trail--icons">
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
        }
      </ul>
    }
  `,
  styles: `
    /* like the textbooks: apart from the buttons around it */
    .tb-attachment-list {
      margin: var(--tb-space-2) 0;
    }

    /* the pill is the row: no card behind it */
    .tb-attachment-list__voice {
      display: block;
      min-height: 0;
      padding: 0;
      background: transparent;
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

  protected playable(file: Attachment): boolean {
    return this.audio() !== null && file.contentType.startsWith('audio/');
  }

  protected loader(file: Attachment): () => Observable<Blob> {
    const audio = this.audio();
    return () => (audio ? audio(file.id) : EMPTY);
  }

  protected icon(file: Attachment): string {
    return fileIcon(file.contentType);
  }

  protected size(bytes: number): string {
    return formatFileSize(bytes);
  }
}
