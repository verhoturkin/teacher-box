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
        [class.tb-board-links--chips]="chips()"
        role="group"
        [attr.aria-label]="t.group"
      >
        @if (!chips()) {
          <span class="tb-muted" aria-hidden="true">{{ t.boards }}</span>
        }
        @for (board of boards(); track board.id) {
          @if (board.kind === 'EXCALIDRAW') {
            <a [class]="linkClass()" [routerLink]="route(board.id)"
              ><i class="pi pi-tb-board" aria-hidden="true"></i> {{ board.title }}</a
            >
          } @else {
            <a [class]="linkClass()" [href]="board.url" target="_blank" rel="noopener"
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

    .tb-board-links--chips {
      gap: var(--tb-space-2);
    }

    /* an M3 assist chip in the colour of the text around it (on the hero: on-primary-container) */
    .tb-board-chip {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-2);
      min-height: 2rem;
      padding-inline: var(--tb-space-3);
      border-radius: var(--tb-shape-sm);
      background: color-mix(in srgb, currentColor 12%, transparent);
      color: inherit;
      font: var(--tb-type-label-l);
      text-decoration: none;
      overflow-wrap: anywhere;

      &:hover {
        background: color-mix(in srgb, currentColor 20%, transparent);
      }
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
