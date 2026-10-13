import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { Attachment } from '../data-access/homework.models';
import { formatFileSize } from '../homework-labels';
import { T } from '../i18n/texts';

/** Files of an assignment or a submission: a card list like the textbooks, the same «×» to remove. */
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
              <button
                type="button"
                class="tb-list__title tb-link-button"
                (click)="download.emit(file)"
              >
                {{ file.filename }}
              </button>
              <span class="tb-list__supporting">{{ size(file.size) }}</span>
            </div>
            @if (removable()) {
              <div class="tb-list__trail tb-list__trail--icons">
                <p-button
                  icon="pi pi-times"
                  [text]="true"
                  [rounded]="true"
                  severity="danger"
                  [pTooltip]="t.removeFile(file.filename)"
                  [ariaLabel]="t.removeFile(file.filename)"
                  (onClick)="remove.emit(file)"
                />
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
  `,
})
export class AttachmentList {
  protected readonly t = T.ui;
  readonly attachments = input.required<readonly Attachment[]>();
  readonly removable = input(false);
  readonly download = output<Attachment>();
  readonly remove = output<Attachment>();

  protected icon(file: Attachment): string {
    return file.contentType.startsWith('image/')
      ? 'pi pi-image'
      : file.contentType === 'application/pdf'
        ? 'pi pi-file-pdf'
        : 'pi pi-file';
  }

  protected size(bytes: number): string {
    return formatFileSize(bytes);
  }
}
