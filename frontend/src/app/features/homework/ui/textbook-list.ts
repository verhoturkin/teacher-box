import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { TEXTBOOK_KIND_ICONS, TEXTBOOK_KIND_LABELS } from '@features/textbooks/parts';
import { BoundTextbook } from '../data-access/homework.models';

/** «Учебник · с. 12-14» or «Учебник · весь учебник». */
export function boundPagesText(textbook: BoundTextbook): string {
  return [
    TEXTBOOK_KIND_LABELS[textbook.kind],
    textbook.course,
    textbook.pages === null ? 'целиком' : `с. ${textbook.pages}`,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}

const EXTENSIONS: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** The name to save the student's download under: «Spotlight 5 (с. 12-14).pdf». */
export function boundTextbookFilename(textbook: BoundTextbook, contentType: string): string {
  const extension = EXTENSIONS[contentType.split(';')[0]?.trim() ?? ''] ?? 'pdf';
  const pages = textbook.pages !== null && extension === 'pdf' ? ` (с. ${textbook.pages})` : '';
  return `${textbook.title}${pages}.${extension}`;
}

/**
 * Textbooks of an assignment (ADR-0033). The student downloads the bound pages; the teacher changes the
 * pages, unbinds and puts the pages on a board.
 */
@Component({
  selector: 'tb-textbook-list',
  imports: [Button, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (textbooks().length > 0) {
      <ul class="tb-list tb-textbook-list" aria-label="Учебники задания">
        @for (textbook of textbooks(); track textbook.textbookId) {
          <li>
            <span class="tb-list__lead" aria-hidden="true"
              ><i [class]="icons[textbook.kind]"></i
            ></span>
            <div class="tb-list__text">
              @if (downloadable()) {
                <button
                  type="button"
                  class="tb-list__title tb-link-button"
                  [attr.aria-label]="'Скачать ' + textbook.title"
                  (click)="download.emit(textbook)"
                >
                  {{ textbook.title }}
                </button>
              } @else {
                <span class="tb-list__title">{{ textbook.title }}</span>
              }
              <span class="tb-list__supporting">{{ details(textbook) }}</span>
            </div>
            @if (editable()) {
              <div class="tb-list__trail tb-list__trail--icons">
                <p-button
                  icon="pi pi-pencil"
                  [text]="true"
                  [rounded]="true"
                  severity="secondary"
                  [pTooltip]="'Страницы: ' + textbook.title"
                  [ariaLabel]="'Страницы: ' + textbook.title"
                  (onClick)="edit.emit(textbook)"
                />
                <p-button
                  icon="pi pi-times"
                  [text]="true"
                  [rounded]="true"
                  severity="danger"
                  [pTooltip]="'Убрать из задания: ' + textbook.title"
                  [ariaLabel]="'Убрать из задания: ' + textbook.title"
                  (onClick)="remove.emit(textbook)"
                />
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    /* like the files above it: apart from the button under it */
    .tb-textbook-list {
      margin: var(--tb-space-2) 0;
    }
  `,
})
export class TextbookList {
  readonly textbooks = input.required<readonly BoundTextbook[]>();
  /** The student: a tap on the title downloads the bound pages. */
  readonly downloadable = input(false);
  /** The teacher: change the pages, unbind. */
  readonly editable = input(false);
  readonly download = output<BoundTextbook>();
  readonly edit = output<BoundTextbook>();
  readonly remove = output<BoundTextbook>();

  protected readonly icons = TEXTBOOK_KIND_ICONS;
  protected readonly details = boundPagesText;
}
