import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { ToBoardDialog } from '@features/boards/parts';
import { textbookPageUrl } from '../data-access/textbooks-api';
import { TextbookFormat } from '../data-access/textbooks.models';
import { MAX_BOARD_PAGES, parsePages } from '../page-ranges';

/** The textbook whose pages go on a board. */
export interface BoardTextbook {
  readonly id: string;
  readonly title: string;
  readonly format: TextbookFormat;
  readonly pageCount: number | null;
}

/**
 * «На доску» for a textbook (ADR-0033): the pages of a PDF (the given ones preselected, the first page by
 * default) or an image, as pictures in a frame on an Excalidraw board. A Word file has no pictures.
 */
@Component({
  selector: 'tb-textbook-to-board-dialog',
  imports: [FormsModule, InputText, ToBoardDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-to-board-dialog
      [(visible)]="visible"
      [title]="textbook()?.title ?? ''"
      [pages]="material()"
    >
      @if (multiPage()) {
        <div class="tb-field tb-textbook-pages">
          <label for="board-pages">Страницы</label>
          <input
            pInputText
            id="board-pages"
            [ngModel]="pagesText()"
            (ngModelChange)="pagesText.set($event)"
            placeholder="Например, 12-14"
            autocomplete="off"
            [attr.aria-invalid]="parsed() === null"
            aria-describedby="board-pages-hint"
          />
          <small id="board-pages-hint" [class]="parsed() === null ? 'tb-field__error' : 'tb-hint'">
            {{ pagesHint() }}
          </small>
        </div>
      }
    </tb-to-board-dialog>
  `,
  styles: `
    .tb-textbook-pages {
      margin-bottom: var(--tb-space-3);
    }
  `,
})
export class TextbookToBoardDialog {
  readonly visible = model(false);
  readonly textbook = input<BoardTextbook | null>(null);
  /** Pages to start with, e.g. those bound to an assignment; the first page when none. */
  readonly initialPages = input<string | null>(null);

  readonly pagesText = signal('1');

  /** A PDF of more than one page: the teacher chooses the pages. */
  protected readonly multiPage = computed(() => {
    const textbook = this.textbook();
    return textbook?.format === 'PDF' && (textbook.pageCount ?? 0) > 1;
  });
  protected readonly parsed = computed(() =>
    this.multiPage()
      ? parsePages(this.pagesText(), this.textbook()?.pageCount ?? null)
      : { pages: [1], text: '1' },
  );
  protected readonly pagesHint = computed(() => {
    const count = this.textbook()?.pageCount ?? 0;
    return this.parsed() === null
      ? `Страницы от 1 до ${String(count)}, не больше ${String(MAX_BOARD_PAGES)} за раз — например, 12-14.`
      : `В учебнике ${String(count)} с. Страницы встанут в ряд во фрейме.`;
  });
  /** The pictures of the chosen pages; none while the pages are wrong. */
  readonly material = computed(() => {
    const textbook = this.textbook();
    const parsed = this.parsed();
    if (textbook === null || textbook.format === 'DOCUMENT') return null;
    return {
      title: this.multiPage() ? `${textbook.title}, с. ${parsed?.text ?? ''}` : textbook.title,
      mode: 'pages' as const,
      pictures: (parsed?.pages ?? []).map((page) => textbookPageUrl(textbook.id, page)),
    };
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        const initial = this.initialPages();
        untracked(() => {
          this.pagesText.set(initial ?? '1');
        });
      }
    });
  }
}
