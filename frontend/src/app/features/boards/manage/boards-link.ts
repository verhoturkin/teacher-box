import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** «Доски (n)» in a students or groups table: opens «Доски» filtered by the student or the group. */
@Component({
  selector: 'tb-boards-link',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="tb-link"
      routerLink="/teacher/boards"
      [queryParams]="query()"
      [attr.aria-label]="'Доски: ' + name() + ', ' + count()"
      >Доски ({{ count() }})</a
    >
  `,
})
export class BoardsLink {
  readonly count = input(0);
  readonly name = input('');
  readonly studentId = input<string | null>(null);
  readonly groupId = input<string | null>(null);

  protected readonly query = computed(() =>
    this.groupId() === null ? { student: this.studentId() } : { group: this.groupId() },
  );
}
