import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { quietContext } from '@core/http/api-error.interceptor';
import { BoardsApi } from '../data-access/boards-api';
import { Board } from '../data-access/boards.models';
import { boardRoute } from '../boards-labels';

/**
 * Links to the boards of a lesson's student (with their groups' boards) or group; nothing while there
 * are none. An Excalidraw board opens in the portal, an external one in a new tab.
 */
@Component({
  selector: 'tb-board-links',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (boards().length > 0) {
      <div class="tb-board-links">
        <span class="tb-muted">Доски:</span>
        @for (board of boards(); track board.id) {
          @if (board.kind === 'EXCALIDRAW') {
            <a class="tb-link" [routerLink]="route(board.id)"
              ><i class="pi pi-th-large" aria-hidden="true"></i> {{ board.title }}</a
            >
          } @else {
            <a class="tb-link" [href]="board.url" target="_blank" rel="noopener"
              ><i class="pi pi-external-link" aria-hidden="true"></i> {{ board.title }}</a
            >
          }
        }
      </div>
    }
  `,
  styles: `
    .tb-board-links {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-1) var(--tb-space-3);
    }
  `,
})
export class BoardLinks {
  private readonly api = inject(BoardsApi);

  readonly studentId = input<string | null>(null);
  readonly groupId = input<string | null>(null);

  protected readonly boards = signal<Board[]>([]);

  constructor() {
    effect(() => {
      const studentId = this.studentId();
      const groupId = this.groupId();
      if (studentId === null && groupId === null) {
        this.boards.set([]);
        return;
      }
      this.api
        .list(groupId === null ? { studentId } : { groupId }, quietContext())
        .subscribe((boards) => {
          this.boards.set(boards);
        });
    });
  }

  protected route(boardId: string): string {
    return boardRoute('teacher', boardId);
  }
}
