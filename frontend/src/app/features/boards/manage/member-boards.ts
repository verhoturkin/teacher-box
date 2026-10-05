import { inject, signal } from '@angular/core';
import { quietContext } from '@core/http/api-error.interceptor';
import { BoardsApi } from '../data-access/boards-api';

/**
 * How many boards the rows of a students or groups table have, for the links to «Доски». Create it in
 * a field initializer of the component (it injects the API).
 */
export class MemberBoards {
  private readonly api = inject(BoardsApi);

  /** Board ids by student or group id. */
  readonly byMember = signal<ReadonlyMap<string, ReadonlySet<string>>>(new Map());

  load(): void {
    this.api.list({}, quietContext()).subscribe((boards) => {
      const byMember = new Map<string, Set<string>>();
      for (const board of boards) {
        for (const member of board.members) {
          byMember.set(member.id, (byMember.get(member.id) ?? new Set<string>()).add(board.id));
        }
      }
      this.byMember.set(byMember);
    });
  }

  /** Boards of any of these students and groups, each counted once. */
  count(memberIds: readonly string[]): number {
    const boards = new Set<string>();
    for (const id of memberIds) {
      this.byMember()
        .get(id)
        ?.forEach((board) => boards.add(board));
    }
    return boards.size;
  }
}
