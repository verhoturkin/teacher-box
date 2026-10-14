import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { BoardsApi } from '../data-access/boards-api';
import { MyBoard } from '../data-access/boards.models';
import { boardRoute } from '../boards-labels';
import { T } from '../i18n/texts';

/**
 * The boards of the student's nearest lesson as chips, as the teacher's card: of a group lesson — the boards
 * of that group, of the student's own lesson — all their boards. Nothing while there are none (or the list
 * failed to load). An Excalidraw board opens in the portal, an external one in a new tab.
 */
@Component({
  selector: 'tb-my-board-links',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shown().length > 0) {
      <div class="tb-board-chips" role="group" [attr.aria-label]="t.group">
        @for (board of shown(); track board.id) {
          @if (board.kind === 'EXCALIDRAW') {
            <a class="tb-board-chip" [routerLink]="route(board.id)"
              ><i class="pi pi-tb-board" aria-hidden="true"></i> {{ board.title }}</a
            >
          } @else {
            <a class="tb-board-chip" [href]="board.url" target="_blank" rel="noopener"
              ><i class="pi pi-external-link" aria-hidden="true"></i> {{ board.title }}</a
            >
          }
        }
      </div>
    }
  `,
})
export class MyBoardLinks implements OnInit {
  protected readonly t = T.links;
  private readonly api = inject(BoardsApi);

  /** The group of the lesson; `null` for the student's own lesson. */
  readonly groupName = input<string | null>(null);

  private readonly boards = signal<readonly MyBoard[]>([]);
  protected readonly shown = computed(() => {
    const group = this.groupName();
    return group === null
      ? this.boards()
      : this.boards().filter((board) => board.groupNames.includes(group));
  });

  ngOnInit(): void {
    this.api.myBoards().subscribe({
      next: (boards) => {
        this.boards.set(boards);
      },
      error: () => {
        // without the list the chips stay hidden
      },
    });
  }

  protected route(boardId: string): string {
    return boardRoute('cabinet', boardId);
  }
}
