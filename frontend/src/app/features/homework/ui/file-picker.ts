import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { Button } from 'primeng/button';
import { formatFileSize } from '../homework-labels';

/** Extensions accepted by the backend (FilePolicy). */
export const ACCEPTED_FILES =
  '.pdf,.txt,.md,.rtf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.jpg,.jpeg,.png,.gif,.webp,.heic,.mp3,.m4a,.ogg,.wav,.zip';

/** Selects several files; the selection is kept in the `files` model until the form is sent. */
@Component({
  selector: 'tb-file-picker',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      #input
      type="file"
      multiple
      class="tb-sr-only"
      [accept]="accept"
      [attr.aria-label]="label()"
      (change)="onSelected(input)"
    />
    <p-button [label]="label()" icon="pi pi-paperclip" [outlined]="true" size="small" (onClick)="input.click()" />
    @if (files().length > 0) {
      <ul class="tb-files">
        @for (file of files(); track $index) {
          <li class="tb-files__item">
            <i class="pi pi-file" aria-hidden="true"></i>
            <span>{{ file.name }}</span>
            <small class="tb-muted">{{ size(file.size) }}</small>
            <p-button
              icon="pi pi-times"
              [text]="true"
              [rounded]="true"
              size="small"
              [ariaLabel]="'Убрать ' + file.name"
              (onClick)="removeAt($index)"
            />
          </li>
        }
      </ul>
    }
  `,
})
export class FilePicker {
  readonly files = model<File[]>([]);
  readonly label = input('Прикрепить файлы');

  protected readonly accept = ACCEPTED_FILES;

  protected onSelected(element: HTMLInputElement): void {
    const selected = Array.from(element.files ?? []);
    this.files.update((files) => [...files, ...selected]);
    // Allows picking the same file again after removing it.
    element.value = '';
  }

  protected removeAt(index: number): void {
    this.files.update((files) => files.filter((_, position) => position !== index));
  }

  protected size(bytes: number): string {
    return formatFileSize(bytes);
  }
}
