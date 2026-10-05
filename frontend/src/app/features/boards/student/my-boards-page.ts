import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Card } from 'primeng/card';
import { HelpButton } from '@features/help/parts';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { BoardsApi } from '../data-access/boards-api';
import { MyBoard } from '../data-access/boards.models';
import { MyBoardList } from './my-board-list';

/** Student: «Мои доски» — their own boards and their groups', newest change first. */
@Component({
  selector: 'tb-my-boards-page',
  imports: [Card, HelpButton, EmptyState, LoadStateView, PageHeader, MyBoardList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Мои доски">
      <tb-help-button help topic="cabinet/lesson" />
    </tb-page-header>
    <p-card>
      <h2 class="tb-sr-only">Список досок</h2>
      <tb-load-state [state]="state" what="доски" (retry)="load()">
        @if (boards().length > 0) {
          <tb-my-board-list [boards]="boards()" />
        } @else {
          <tb-empty-state
            icon="pi-th-large"
            title="Досок пока нет"
            hint="Когда учитель откроет вам доску, она появится здесь."
          />
        }
      </tb-load-state>
    </p-card>
  `,
})
export class MyBoardsPage implements OnInit {
  private readonly api = inject(BoardsApi);

  protected readonly boards = signal<MyBoard[]>([]);
  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .myBoards()
      .pipe(this.state.track())
      .subscribe((boards) => {
        this.boards.set(boards);
      });
  }
}
