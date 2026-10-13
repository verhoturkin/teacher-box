import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { BoardsApi } from '../data-access/boards-api';
import { MyBoard } from '../data-access/boards.models';
import { boardRoute } from '../boards-labels';
import { T } from '../i18n/texts';

/**
 * «Перейти на доску» of a student's task: shown only when the board is one of the student's (their own or their
 * group's) — a board taken away or deleted shows nothing.
 */
@Component({
  selector: 'tb-my-board-button',
  imports: [RouterLink, ButtonDirective, ButtonIcon, ButtonLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (board(); as found) {
      @if (found.kind === 'EXCALIDRAW') {
        <a pButton [routerLink]="route(found)">
          <i pButtonIcon aria-hidden="true" class="pi pi-tb-board"></i>
          <span pButtonLabel>{{ t.open }}</span>
        </a>
      } @else {
        <a pButton [href]="found.url" target="_blank" rel="noopener">
          <i pButtonIcon aria-hidden="true" class="pi pi-external-link"></i>
          <span pButtonLabel>{{ t.open }}</span>
        </a>
      }
    }
  `,
})
export class MyBoardButton {
  protected readonly t = T.myBoardButton;
  private readonly api = inject(BoardsApi);

  /** The board the task was put on. */
  readonly boardId = input.required<string>();

  private readonly boards = signal<readonly MyBoard[]>([]);
  protected readonly board = computed(
    () => this.boards().find((board) => board.id === this.boardId()) ?? null,
  );

  constructor() {
    effect(() => {
      this.boardId();
      untracked(() => {
        this.api.myBoards().subscribe({
          next: (boards) => {
            this.boards.set(boards);
          },
          error: () => {
            // without the list the button stays hidden
          },
        });
      });
    });
  }

  protected route(board: MyBoard): string {
    return boardRoute('cabinet', board.id);
  }
}
