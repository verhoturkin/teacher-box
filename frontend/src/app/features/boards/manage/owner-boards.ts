import { computed, inject, signal } from '@angular/core';
import { BoardsApi } from '../data-access/boards-api';
import { Board, BoardOwnerRef } from '../data-access/boards.models';

/**
 * Boards of the rows of a students or groups table, and the dialog of one owner. Create it in a
 * field initializer of the component (it injects the API).
 */
export class OwnerBoards {
  private readonly api = inject(BoardsApi);

  readonly byOwner = signal<ReadonlyMap<string, readonly Board[]>>(new Map());
  readonly visible = signal(false);
  readonly owner = signal<BoardOwnerRef | null>(null);
  readonly ownerBoards = computed(() => {
    const owner = this.owner();
    return owner === null ? [] : this.of(owner.id);
  });

  load(): void {
    this.api.list().subscribe((boards) => {
      const byOwner = new Map<string, Board[]>();
      for (const board of boards) {
        byOwner.set(board.ownerId, [...(byOwner.get(board.ownerId) ?? []), board]);
      }
      this.byOwner.set(byOwner);
    });
  }

  of(ownerId: string): readonly Board[] {
    return this.byOwner().get(ownerId) ?? [];
  }

  open(owner: BoardOwnerRef): void {
    this.owner.set(owner);
    this.visible.set(true);
  }

  saved(board: Board): void {
    this.update(board.ownerId, (boards) =>
      boards.some((known) => known.id === board.id)
        ? boards.map((known) => (known.id === board.id ? board : known))
        : [...boards, board],
    );
  }

  removed(board: Board): void {
    this.update(board.ownerId, (boards) => boards.filter((known) => known.id !== board.id));
  }

  private update(ownerId: string, change: (boards: readonly Board[]) => readonly Board[]): void {
    this.byOwner.update((byOwner) =>
      new Map(byOwner).set(ownerId, change(byOwner.get(ownerId) ?? [])),
    );
  }
}
