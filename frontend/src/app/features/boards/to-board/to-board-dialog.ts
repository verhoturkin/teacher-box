import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { RadioButton } from 'primeng/radiobutton';
import { BoardsApi } from '../data-access/boards-api';
import { Board } from '../data-access/boards.models';
import { BoardClipboard } from './board-clipboard';

/** How the material was put on the clipboard. */
export type CopyMode = 'text' | 'image';

/** A material copied for a board. */
export interface Copied {
  readonly mode: CopyMode;
  readonly board: Board;
}

/**
 * Puts a material (an assignment, a draft of the AI) on a board: copies it and opens the board,
 * where the teacher pastes it with Ctrl+V. Boards of the given students and groups come first.
 */
@Component({
  selector: 'tb-to-board-dialog',
  imports: [FormsModule, Button, Dialog, Message, RadioButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      header="На доску"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
    >
      @if (loaded() && boards().length === 0) {
        <p class="tb-muted">
          Досок пока нет. Добавьте ссылку на доску ученика или группы в разделе «Ученики» (колонка
          «Доски»).
        </p>
      } @else {
        <p class="tb-muted">
          Материал скопируется, а доска откроется в новой вкладке — нажмите на ней Ctrl+V.
        </p>
        @if (!richClipboard) {
          <p class="tb-muted">Картинкой можно копировать, только когда портал открыт по https.</p>
        }
        <ul class="tb-to-board">
          @for (board of sorted(); track board.id) {
            <li>
              <p-radiobutton
                [inputId]="'to-board-' + board.id"
                name="board"
                [value]="board.id"
                [(ngModel)]="chosen"
              />
              <label [for]="'to-board-' + board.id">
                {{ board.title }}
                <span class="tb-muted">— {{ board.ownerName ?? '' }}</span>
              </label>
            </li>
          }
        </ul>
      }
      @if (done(); as copied) {
        <p-message severity="success" styleClass="tb-form-message">
          {{ copied.mode === 'image' ? 'Картинка' : 'Текст' }} в буфере обмена. На доске нажмите
          Ctrl+V.
          <a [href]="copied.board.url" target="_blank" rel="noopener"
            >Открыть доску «{{ copied.board.title }}»</a
          >
        </p-message>
      }
      @if (error(); as message) {
        <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
      }
      <ng-template #footer>
        <p-button
          label="Закрыть"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button
          label="Картинкой"
          icon="pi pi-image"
          severity="secondary"
          [disabled]="chosenBoard() === null || !richClipboard"
          [loading]="copying()"
          (onClick)="copy('image')"
        />
        <p-button
          label="Текстом"
          icon="pi pi-copy"
          [disabled]="chosenBoard() === null"
          [loading]="copying()"
          (onClick)="copy('text')"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .tb-to-board {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        gap: var(--tb-space-2);
      }
    }
  `,
})
export class ToBoardDialog {
  private readonly api = inject(BoardsApi);
  private readonly clipboard = inject(BoardClipboard);

  readonly visible = model(false);
  readonly title = input('');
  /** The material in Markdown. */
  readonly markdown = input('');
  /** Students and groups whose boards come first. */
  readonly ownerIds = input<readonly string[]>([]);

  protected readonly boards = signal<Board[]>([]);
  protected readonly loaded = signal(false);
  protected readonly richClipboard = this.clipboard.canWriteRich();
  protected readonly copying = signal(false);
  protected readonly done = signal<Copied | null>(null);
  protected readonly error = signal<string | null>(null);
  readonly chosen = signal<string | null>(null);
  protected readonly sorted = computed(() => {
    const preferred = new Set(this.ownerIds());
    return [...this.boards()].sort(
      (a, b) => Number(preferred.has(b.ownerId)) - Number(preferred.has(a.ownerId)),
    );
  });
  protected readonly chosenBoard = computed(
    () => this.boards().find((board) => board.id === this.chosen()) ?? null,
  );

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.done.set(null);
        this.error.set(null);
        this.api.list().subscribe((boards) => {
          this.boards.set(boards);
          this.loaded.set(true);
          this.chosen.set(this.sorted()[0]?.id ?? null);
        });
      }
    });
  }

  async copy(mode: CopyMode): Promise<void> {
    const board = this.chosenBoard();
    if (board === null) {
      return;
    }
    this.error.set(null);
    this.done.set(null);
    this.copying.set(true);
    try {
      // Copy first: the clipboard is written only while the portal's tab has the focus.
      if (mode === 'image') {
        await this.clipboard.copyImage(this.title(), this.markdown());
      } else {
        await this.clipboard.copyText(this.title(), this.markdown());
      }
      this.done.set({ mode, board });
      // Still within the click's activation; if the browser blocks the tab, the message has a link.
      window.open(board.url, '_blank', 'noopener');
    } catch {
      this.error.set(
        'Браузер не дал скопировать материал. Попробуйте ещё раз или скопируйте текст вручную.',
      );
    } finally {
      this.copying.set(false);
    }
  }
}
