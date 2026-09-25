import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Attachment } from '../data-access/homework.models';
import { formatFileSize } from '../homework-labels';

/** Files of an assignment or a submission. */
@Component({
  selector: 'tb-attachment-list',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (attachments().length > 0) {
      <ul class="tb-files">
        @for (file of attachments(); track file.id) {
          <li class="tb-files__item">
            <i class="pi pi-file" aria-hidden="true"></i>
            <button type="button" class="tb-link-button" (click)="download.emit(file)">{{ file.filename }}</button>
            <small class="tb-muted">{{ size(file.size) }}</small>
            @if (removable()) {
              <p-button
                icon="pi pi-trash"
                [text]="true"
                [rounded]="true"
                severity="danger"
                size="small"
                [ariaLabel]="'Удалить файл ' + file.filename"
                (onClick)="remove.emit(file)"
              />
            }
          </li>
        }
      </ul>
    }
  `,
})
export class AttachmentList {
  readonly attachments = input.required<readonly Attachment[]>();
  readonly removable = input(false);
  readonly download = output<Attachment>();
  readonly remove = output<Attachment>();

  protected size(bytes: number): string {
    return formatFileSize(bytes);
  }
}
