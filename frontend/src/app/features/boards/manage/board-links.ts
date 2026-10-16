import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { quietContext } from '@core/http/api-error.interceptor';
import { BoardsApi } from '../data-access/boards-api';
import { Board } from '../data-access/boards.models';
import { boardRoute } from '../boards-labels';
import { T } from '../i18n/texts';

/**
 * Links to the boards of a lesson's student (with their groups' boards) or group; nothing while there
 * are none. An Excalidraw board opens in the portal, an external one in a new tab. As `chips` (the
 * nearest lesson on the home page) the boards are chips without the «Доски:» caption.
 */
@Component({
  selector: 'tb-board-links',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (boards().length > 0) {
      <div
        class="tb-board-links"
        [class.tb-board-chips]="chips()"
        role="group"
        [attr.aria-label]="t.group"
      >
        @if (!chips()) {
          <span class="tb-muted" aria-hidden="true">{{ t.boards }}</span>
        }
        @for (board of boards(); track board.id) {
          @if (board.kind === 'EXCALIDRAW') {
            <a [class]="linkClass()" [routerLink]="route(board.id)"
              ><i class="tb-i tb-i-co_present" aria-hidden="true"></i> {{ board.title }}</a
            >
          } @else {
            <a [class]="linkClass()" [href]="board.url" target="_blank" rel="noopener"
              ><i class="tb-i tb-i-open_in_new" aria-hidden="true"></i> {{ board.title }}</a
            >
          }
        }
      </div>
    }
  `,
  styles: `
    /* the chips take their gap from styles.scss */
    .tb-board-links:not(.tb-board-chips) {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-1) var(--tb-space-3);
    }
  `,
})
export class BoardLinks {
  protected readonly t = T.links;
  private readonly api = inject(BoardsApi);

  readonly studentId = input<string | null>(null);
  readonly groupId = input<string | null>(null);
  /** The boards as chips, without the caption. */
  readonly chips = input(false);

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

  protected readonly linkClass = computed(() => (this.chips() ? 'tb-board-chip' : 'tb-link'));

  protected route(boardId: string): string {
    return boardRoute('teacher', boardId);
  }
}
