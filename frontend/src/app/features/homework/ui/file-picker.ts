import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { of } from 'rxjs';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { Snackbar } from '@core/snackbar/snackbar';
import { checkFiles, FilePolicy } from '@shared/files/check-files';
import { FileOpener, isShowable } from '@shared/files/file-opener';
import { fileIcon, formatFileSize } from '../homework-labels';
import { T } from '../i18n/texts';

/** Extensions accepted by the backend (FilePolicy). */
export const ACCEPTED_FILES =
  '.pdf,.txt,.md,.rtf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.jpg,.jpeg,.png,.gif,.webp,.heic,.mp3,.m4a,.ogg,.wav,.zip';

/** The largest file by default (`teacherbox.homework.max-file-size`); the backend has the last word. */
export const HOMEWORK_FILE_MAX_SIZE = 20 * 1024 * 1024;

const HOMEWORK_FILE_POLICY: FilePolicy = {
  extensions: ACCEPTED_FILES.split(',').map((extension) => extension.slice(1)),
  maxSize: HOMEWORK_FILE_MAX_SIZE,
};

/**
 * Selects several files; the selection is kept in the `files` model until the form is sent. The picked files are a
 * card list like the saved ones (`tb-attachment-list`): the name of a PDF or a picture opens it in a tab, «×» drops it.
 */
@Component({
  selector: 'tb-file-picker',
  imports: [Button, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (files().length > 0) {
      <ul class="tb-list tb-file-picker__list" [attr.aria-label]="t.picked">
        @for (file of files(); track $index) {
          <li>
            <span class="tb-list__lead" aria-hidden="true"><i [class]="icon(file)"></i></span>
            <div class="tb-list__text">
              @if (showable(file)) {
                <button
                  type="button"
                  class="tb-list__title tb-link-button"
                  [attr.aria-label]="t.openFile(file.name)"
                  (click)="open(file)"
                >
                  {{ file.name }}
                </button>
              } @else {
                <span class="tb-list__title">{{ file.name }}</span>
              }
              <span class="tb-list__supporting">{{ size(file.size) }}</span>
            </div>
            <div class="tb-list__trail tb-list__trail--icons">
              <p-button
                icon="tb-i tb-i-close"
                [text]="true"
                [rounded]="true"
                severity="danger"
                [pTooltip]="t.unpick(file.name)"
                [ariaLabel]="t.unpick(file.name)"
                (onClick)="removeAt($index)"
              />
            </div>
          </li>
        }
      </ul>
    }
    <input
      #input
      type="file"
      multiple
      class="tb-sr-only"
      [accept]="accept"
      [attr.aria-label]="label()"
      (change)="onSelected(input)"
    />
    <p-button
      [label]="label()"
      icon="tb-i tb-i-attach_file"
      severity="secondary"
      (onClick)="input.click()"
    />
  `,
  styles: `
    /* like the saved files: apart from the button under it */
    .tb-file-picker__list {
      margin: var(--tb-space-2) 0;
    }
  `,
})
export class FilePicker {
  protected readonly t = T.ui;
  private readonly opener = inject(FileOpener);
  private readonly snackbar = inject(Snackbar);
  readonly files = model<File[]>([]);
  readonly label = input(T.ui.attachFiles);

  protected readonly accept = ACCEPTED_FILES;

  protected async onSelected(element: HTMLInputElement): Promise<void> {
    const selected = Array.from(element.files ?? []);
    // Allows picking the same file again after removing it.
    element.value = '';
    const { accepted, rejected } = await checkFiles(selected, HOMEWORK_FILE_POLICY);
    rejected.forEach((problem) => {
      this.snackbar.error(problem.message);
    });
    this.files.update((files) => [...files, ...accepted]);
  }

  protected removeAt(index: number): void {
    this.files.update((files) => files.filter((_, position) => position !== index));
  }

  protected showable(file: File): boolean {
    return isShowable(file.type);
  }

  /** A picked file is already here: it opens in a tab at once. */
  protected open(file: File): void {
    this.opener.open(of(file), true, () => file.name);
  }

  protected icon(file: File): string {
    return fileIcon(file.type);
  }

  protected size(bytes: number): string {
    return formatFileSize(bytes);
  }
}
