import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { BoardsApi } from '../data-access/boards-api';
import { Board } from '../data-access/boards.models';

/** Links to the boards of the given students and groups (e.g. of a lesson); nothing while there are none. */
@Component({
  selector: 'tb-owner-board-links',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (boards().length > 0) {
      <div class="tb-owner-boards">
        <span class="tb-muted">Доски:</span>
        @for (board of boards(); track board.id) {
          <a [href]="board.url" target="_blank" rel="noopener"
            ><i class="pi pi-th-large"></i> {{ board.title }}</a
          >
        }
      </div>
    }
  `,
  styles: `
    .tb-owner-boards {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 0.75rem;
    }
  `,
})
export class OwnerBoardLinks implements OnInit {
  private readonly api = inject(BoardsApi);

  readonly ownerIds = input<readonly (string | null)[]>([]);

  private readonly all = signal<Board[]>([]);
  protected readonly boards = computed(() => {
    const owners = new Set(this.ownerIds());
    return this.all().filter((board) => owners.has(board.ownerId));
  });

  ngOnInit(): void {
    this.api.list().subscribe((boards) => {
      this.all.set(boards);
    });
  }
}
