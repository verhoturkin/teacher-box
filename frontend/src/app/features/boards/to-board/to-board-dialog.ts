import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
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
 * (the teacher pastes it there). From an assignment only its students' boards are offered. Pages of a textbook
 * (`pages`) go only on an Excalidraw board, in a frame; what is projected inside chooses the pages.
 */
@Component({
  selector: 'tb-to-board-dialog',
  imports: [EmptyState, FormsModule, Button, Dialog, Message, Select],
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
          [title]="emptyTitle()"
          [hint]="emptyHint()"
        />
      } @else {
        <ng-content />
        <p class="tb-muted">{{ hint() }}</p>
        @if (needsClipboard() && !richClipboard) {
          <p class="tb-muted">Картинкой можно копировать, только когда портал открыт по https.</p>
        }
        <div class="tb-field tb-to-board">
          <label for="to-board-board">Доска</label>
          <p-select
            inputId="to-board-board"
            [options]="sorted()"
            optionLabel="title"
            optionValue="id"
            [(ngModel)]="chosen"
            placeholder="Выберите доску"
            [filter]="true"
            filterBy="title"
            filterPlaceholder="Поиск по названию"
            emptyFilterMessage="Таких досок нет"
            appendTo="body"
            [fluid]="true"
          >
            <ng-template #item let-board>
              <div class="tb-to-board__option">
                <span>{{ board.title }}</span>
                <small class="tb-muted"
                  >{{ kindLabels[kindOf(board)] }}, {{ membersText(board) }}</small
                >
              </div>
            </ng-template>
          </p-select>
        </div>
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
    .tb-to-board__option {
      display: flex;
      flex-direction: column;
      min-width: 0;
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
  /**
   * Whose boards to offer: the students of an assignment (their own boards and their groups'); `null` — every
   * board (e.g. from «Учебники»).
   */
  readonly students = input<readonly string[] | null>(null);
  /** Pages of a textbook instead of the Markdown: only Excalidraw boards take them. */
  readonly pages = input<PagesMaterial | null>(null);

  protected readonly kindLabels = BOARD_KIND_LABELS;
  /** The item template's board is untyped. */
  protected kindOf(board: Board): Board['kind'] {
    return board.kind;
  }
  protected readonly membersText = boardMembersText;
  protected readonly boards = signal<Board[]>([]);
  protected readonly loaded = signal(false);
  protected readonly richClipboard = this.clipboard.canWriteRich();
  protected readonly copying = signal(false);
  protected readonly done = signal<Placed | null>(null);
  protected readonly error = signal<string | null>(null);
  readonly chosen = signal<string | null>(null);
  /** The boards to choose from: pages go only on Excalidraw boards. */
  protected readonly sorted = computed(() => {
    const pages = this.pages() !== null;
    return this.boards().filter((board) => !pages || board.kind === 'EXCALIDRAW');
  });
  protected readonly emptyTitle = computed(() => {
    if (this.students() !== null) return 'У учеников задания досок нет';
    return this.pages() === null ? 'Досок пока нет' : 'Досок Excalidraw пока нет';
  });
  protected readonly emptyHint = computed(() =>
    this.students() === null
      ? 'Создайте доску в разделе «Доски».'
      : 'Откройте доску ученикам задания или их группе в разделе «Доски».',
  );
  protected readonly chosenBoard = computed(
    () => this.sorted().find((board) => board.id === this.chosen()) ?? null,
  );
  /** An external board gets the material through the clipboard. */
  protected readonly needsClipboard = computed(() => this.chosenBoard()?.kind === 'LINK');
  protected readonly hint = computed(() =>
    this.pages() !== null
      ? 'Выберите доску: она откроется в новой вкладке, страницы встанут справа от рисунка — в ряд, во фрейме.'
      : this.needsClipboard()
        ? 'Материал скопируется, а доска откроется в новой вкладке — нажмите на ней Ctrl+V (на Mac — Cmd+V).'
        : 'Доска откроется в новой вкладке, материал появится в центре.',
  );

  constructor() {
    effect(() => {
      if (!this.visible()) {
        return;
      }
      const students = this.students();
      untracked(() => {
        this.done.set(null);
        this.error.set(null);
        this.loaded.set(false);
        const found =
          students === null
            ? this.api.list({}, quietContext())
            : students.length === 0
              ? of([])
              : this.api.list({ studentIds: students }, quietContext());
        found.subscribe((boards) => {
          this.boards.set(boards);
          this.loaded.set(true);
          this.chosen.set(this.sorted()[0]?.id ?? null);
        });
      });
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
