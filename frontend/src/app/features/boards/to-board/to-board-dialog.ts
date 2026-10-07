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
import { quietContext } from '@core/http/api-error.interceptor';
import { EmptyState } from '@shared/ui/empty-state';
import { BoardsApi } from '../data-access/boards-api';
import { Board } from '../data-access/boards.models';
import { BOARD_KIND_LABELS, boardMembersText, boardRoute } from '../boards-labels';
import { BoardClipboard } from './board-clipboard';
import { BoardInsert, InsertMode, PagesMaterial } from './board-insert';

/** What happened to the material. */
export interface Placed {
  readonly mode: InsertMode | 'pages';
  readonly board: Board;
  /** Where the board opened. */
  readonly href: string;
}

/**
 * Puts a material (an assignment, a draft of the AI) on a board (ADR-0028). An Excalidraw board opens in
 * a new tab with the material already at the centre; an external board gets it through the clipboard
 * (the teacher pastes it there). Boards of the given students and groups come first. Pages of a textbook
 * (`pages`) go only on an Excalidraw board, in a frame; what is projected inside chooses the pages.
 */
@Component({
  selector: 'tb-to-board-dialog',
  imports: [EmptyState, FormsModule, Button, Dialog, Message, RadioButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      header="На доску"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
    >
      @if (loaded() && sorted().length === 0) {
        <tb-empty-state
          [compact]="true"
          icon="pi-th-large"
          [title]="pages() === null ? 'Досок пока нет' : 'Досок Excalidraw пока нет'"
          hint="Создайте доску в разделе «Доски»."
        />
      } @else {
        <ng-content />
        <p class="tb-muted">{{ hint() }}</p>
        @if (needsClipboard() && !richClipboard) {
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
                <span class="tb-muted"
                  >— {{ kindLabels[board.kind] }}, {{ membersText(board) }}</span
                >
              </label>
            </li>
          }
        </ul>
      }
      @if (done(); as placed) {
        <p-message severity="success" styleClass="tb-form-message">
          @if (placed.mode === 'pages') {
            Доска открылась в новой вкладке, страницы уже на ней.
          } @else if (placed.board.kind === 'EXCALIDRAW') {
            Доска открылась в новой вкладке, материал уже на ней.
          } @else {
            {{ placed.mode === 'image' ? 'Картинка' : 'Текст' }} в буфере обмена. На доске нажмите
            Ctrl+V.
          }
          <a [href]="placed.href" target="_blank" rel="noopener"
            >Открыть доску «{{ placed.board.title }}»</a
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
        @if (pages(); as material) {
          <p-button
            label="На доску"
            icon="pi pi-th-large"
            [disabled]="chosenBoard() === null || material.pictures.length === 0"
            (onClick)="placePages(material)"
          />
        } @else {
          <p-button
            label="Картинкой"
            icon="pi pi-image"
            severity="secondary"
            [disabled]="chosenBoard() === null || (needsClipboard() && !richClipboard)"
            [loading]="copying()"
            (onClick)="place('image')"
          />
          <p-button
            label="Текстом"
            icon="pi pi-copy"
            [disabled]="chosenBoard() === null"
            [loading]="copying()"
            (onClick)="place('text')"
          />
        }
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
  private readonly insert = inject(BoardInsert);

  readonly visible = model(false);
  readonly title = input('');
  /** The material in Markdown. */
  readonly markdown = input('');
  /** Students and groups whose boards come first. */
  readonly ownerIds = input<readonly string[]>([]);
  /** Pages of a textbook instead of the Markdown: only Excalidraw boards take them. */
  readonly pages = input<PagesMaterial | null>(null);

  protected readonly kindLabels = BOARD_KIND_LABELS;
  protected readonly membersText = boardMembersText;
  protected readonly boards = signal<Board[]>([]);
  protected readonly loaded = signal(false);
  protected readonly richClipboard = this.clipboard.canWriteRich();
  protected readonly copying = signal(false);
  protected readonly done = signal<Placed | null>(null);
  protected readonly error = signal<string | null>(null);
  readonly chosen = signal<string | null>(null);
  protected readonly sorted = computed(() => {
    const preferred = new Set(this.ownerIds());
    const rank = (board: Board): number =>
      Number(board.members.some((member) => preferred.has(member.id)));
    const pages = this.pages() !== null;
    return this.boards()
      .filter((board) => !pages || board.kind === 'EXCALIDRAW')
      .sort((a, b) => rank(b) - rank(a));
  });
  protected readonly chosenBoard = computed(
    () => this.sorted().find((board) => board.id === this.chosen()) ?? null,
  );
  /** An external board gets the material through the clipboard. */
  protected readonly needsClipboard = computed(() => this.chosenBoard()?.kind === 'LINK');
  protected readonly hint = computed(() =>
    this.pages() !== null
      ? 'Доска откроется в новой вкладке, страницы появятся в центре — в ряд, во фрейме.'
      : this.needsClipboard()
        ? 'Материал скопируется, а доска откроется в новой вкладке — нажмите на ней Ctrl+V (на Mac — Cmd+V).'
        : 'Доска откроется в новой вкладке, материал появится в центре.',
  );

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.done.set(null);
        this.error.set(null);
        this.api.list({}, quietContext()).subscribe((boards) => {
          this.boards.set(boards);
          this.loaded.set(true);
          this.chosen.set(this.sorted()[0]?.id ?? null);
        });
      }
    });
  }

  async place(mode: InsertMode): Promise<void> {
    const board = this.chosenBoard();
    if (board === null) {
      return;
    }
    this.error.set(null);
    this.done.set(null);
    if (board.kind === 'EXCALIDRAW') {
      this.insert.put(board.id, { title: this.title(), markdown: this.markdown(), mode });
      this.open({ mode, board, href: boardRoute('teacher', board.id) });
      return;
    }
    this.copying.set(true);
    try {
      // Copy first: the clipboard is written only while the portal's tab has the focus.
      if (mode === 'image') {
        await this.clipboard.copyImage(this.title(), this.markdown());
      } else {
        await this.clipboard.copyText(this.title(), this.markdown());
      }
      this.open({ mode, board, href: board.url ?? '' });
    } catch {
      this.error.set(
        'Браузер не дал скопировать материал. Попробуйте ещё раз или скопируйте текст вручную.',
      );
    } finally {
      this.copying.set(false);
    }
  }

  /** Pages go only on an Excalidraw board: it opens with them at the centre. */
  placePages(material: PagesMaterial): void {
    const board = this.chosenBoard();
    if (board === null) {
      return;
    }
    this.error.set(null);
    this.insert.put(board.id, material);
    this.open({ mode: 'pages', board, href: boardRoute('teacher', board.id) });
  }

  /** Still within the click's activation; if the browser blocks the tab, the message has a link. */
  private open(placed: Placed): void {
    this.done.set(placed);
    window.open(placed.href, '_blank', 'noopener');
  }
}
