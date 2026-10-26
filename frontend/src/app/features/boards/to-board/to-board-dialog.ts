import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Message } from 'primeng/message';
import { RadioButton } from 'primeng/radiobutton';
import { Select } from 'primeng/select';
import { quietContext } from '@core/http/api-error.interceptor';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { EmptyState } from '@shared/ui/empty-state';
import { BoardsApi } from '../data-access/boards-api';
import { Board } from '../data-access/boards.models';
import { BOARD_KIND_LABELS, boardMembersText, boardRoute } from '../boards-labels';
import { BoardClipboard } from './board-clipboard';
import { BoardInsert, InsertMode, PagesMaterial } from './board-insert';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

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
  imports: [EmptyState, FormsModule, TbDialog, Message, RadioButton, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="t.title"
      [confirmLabel]="canPlace() ? t.transfer : null"
      [cancelLabel]="done() || !canPlace() ? c.close : c.cancel"
      [pending]="copying()"
      (confirm)="transfer()"
    >
      @if (loaded() && sorted().length === 0) {
        <tb-empty-state
          [compact]="true"
          icon="tb-i-co_present"
          [title]="emptyTitle()"
          [hint]="emptyHint()"
        />
      } @else {
        <ng-content />
        <p class="tb-muted">{{ hint() }}</p>
        @if (needsClipboard() && !richClipboard) {
          <p class="tb-muted">{{ t.https }}</p>
        }
        <div class="tb-field tb-to-board">
          <label for="to-board-board">{{ t.board }}</label>
          <p-select
            inputId="to-board-board"
            [options]="sorted()"
            optionLabel="title"
            optionValue="id"
            [(ngModel)]="chosen"
            [placeholder]="t.choose"
            [filter]="true"
            filterBy="title"
            [filterPlaceholder]="t.search"
            [emptyFilterMessage]="t.noBoards"
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
        @if (pages() === null) {
          <ul class="tb-list" role="radiogroup" [attr.aria-label]="t.how">
            @for (option of modes; track option.mode) {
              <li
                class="tb-to-board__mode"
                [class.tb-to-board__mode--checked]="option.mode === mode()"
                [class.tb-to-board__mode--disabled]="blocked(option.mode)"
              >
                <p-radiobutton
                  class="tb-to-board__radio"
                  name="to-board-mode"
                  [inputId]="'to-board-mode-' + option.mode"
                  [value]="option.mode"
                  [ngModel]="mode()"
                  (ngModelChange)="chosenMode.set($event)"
                  [disabled]="blocked(option.mode)"
                />
                <label class="tb-list__text" [for]="'to-board-mode-' + option.mode">
                  <span class="tb-list__title">{{ option.label }}</span>
                </label>
              </li>
            }
          </ul>
        }
      }
      @if (done(); as placed) {
        <p-message severity="success" styleClass="tb-form-message">
          @if (placed.mode === 'pages') {
            {{ t.pagesPlaced }}
          } @else if (placed.board.kind === 'EXCALIDRAW') {
            {{ t.materialPlaced }}
          } @else {
            {{ placed.mode === 'image' ? t.imageCopied : t.textCopied }}
          }
          <a [href]="placed.href" target="_blank" rel="noopener">{{
            t.openBoard(placed.board.title)
          }}</a>
        </p-message>
      }
      @if (error(); as message) {
        <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
      }
    </tb-dialog>
  `,
  styles: `
    .tb-to-board__option {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    /* Single choice (design-system §8): the label covers the tile, the radio stays above for its focus ring. */
    .tb-to-board__mode {
      position: relative;
      cursor: pointer;

      &:hover {
        background: color-mix(
          in srgb,
          var(--p-md-on-surface) var(--tb-state-hover),
          var(--tb-list-item)
        );
      }

      label {
        cursor: pointer;

        &::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
        }
      }

      .tb-to-board__radio {
        grid-area: lead;
        position: relative;
        z-index: 1;
      }
    }

    .tb-to-board__mode--checked,
    .tb-to-board__mode--checked:hover {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    .tb-to-board__mode--disabled {
      opacity: 0.38;
      cursor: not-allowed;
    }
  `,
})
export class ToBoardDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.toBoard;
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
  /**
   * A written assignment: on an Excalidraw board the text goes into a frame of this name, followed by `pictures`;
   * an external board gets the text only.
   */
  readonly frame = input<string | null>(null);
  /** API addresses of the assignment's pictures (files, textbook pages), in their order. */
  readonly pictures = input<readonly string[]>([]);
  /** The material went to a board (its tab opened or the clipboard got it). */
  readonly placed = output<Placed>();

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
  protected readonly modes: readonly { mode: InsertMode; label: string }[] = [
    { mode: 'text', label: T.toBoard.asText },
    { mode: 'image', label: T.toBoard.asImage },
  ];
  protected readonly chosenMode = signal<InsertMode>('text');
  /** The chosen way, or the text when the picture is not possible for this board. */
  protected readonly mode = computed(() =>
    this.blocked(this.chosenMode()) ? 'text' : this.chosenMode(),
  );
  /** The boards to choose from: pages go only on Excalidraw boards. */
  protected readonly sorted = computed(() => {
    const pages = this.pages() !== null;
    return this.boards().filter((board) => !pages || board.kind === 'EXCALIDRAW');
  });
  protected readonly emptyTitle = computed(() => {
    if (this.students() !== null) return T.toBoard.noStudentBoards;
    return this.pages() === null ? T.toBoard.noBoards2 : T.toBoard.noExcalidraw;
  });
  protected readonly emptyHint = computed(() =>
    this.students() === null ? T.toBoard.createHint : T.toBoard.openHint,
  );
  protected readonly chosenBoard = computed(
    () => this.sorted().find((board) => board.id === this.chosen()) ?? null,
  );
  /** An external board gets the material through the clipboard. */
  protected readonly needsClipboard = computed(() => this.chosenBoard()?.kind === 'LINK');
  protected readonly hint = computed(() => {
    if (this.pages() !== null) return T.toBoard.pagesHint;
    if (this.needsClipboard()) {
      return this.frame() === null ? T.toBoard.clipboardHint : T.toBoard.textOnlyHint;
    }
    return this.frame() === null ? T.toBoard.centreHint : T.toBoard.assignmentHint;
  });

  /** A picture goes to an external board through the rich clipboard only. */
  protected blocked(mode: InsertMode): boolean {
    return mode === 'image' && this.needsClipboard() && !this.richClipboard;
  }

  /** There is a board to put the material on (pages also need their pictures). */
  protected readonly canPlace = computed(() => {
    if (this.chosenBoard() === null) return false;
    const material = this.pages();
    return material === null || material.pictures.length > 0;
  });

  protected transfer(): void {
    const material = this.pages();
    if (material !== null) {
      this.placePages(material);
    } else {
      void this.place(this.mode());
    }
  }

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
      const frame = this.frame();
      this.insert.put(
        board.id,
        frame === null
          ? { title: this.title(), markdown: this.markdown(), mode }
          : {
              title: this.title(),
              markdown: this.markdown(),
              mode: 'assignment',
              frame,
              text: mode,
              pictures: this.pictures(),
            },
      );
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
      this.error.set(T.toBoard.copyFailed);
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
    this.placed.emit(placed);
    window.open(placed.href, '_blank', 'noopener');
  }
}
