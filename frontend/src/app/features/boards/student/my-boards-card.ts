import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Card } from 'primeng/card';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { BoardsApi } from '../data-access/boards-api';
import { MyBoard } from '../data-access/boards.models';

/**
 * A student's boards (their own and their groups'); hidden while there are none, a failed load
 * shows the card with «Повторить» (ADR-0025).
 */
@Component({
  selector: 'tb-my-boards-card',
  imports: [Card, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state.status() === 'error') {
      <p-card header="Мои доски">
        <tb-load-state [state]="state" what="доски" [compact]="true" (retry)="load()" />
      </p-card>
    } @else if (boards().length > 0) {
      <p-card header="Мои доски">
        <ul class="tb-list">
          @for (board of boards(); track board.id) {
            <li>
              <span class="tb-list__lead" aria-hidden="true"><i class="pi pi-th-large"></i></span>
              <div class="tb-list__text">
                <a
                  class="tb-list__title tb-link"
                  [href]="board.url"
                  target="_blank"
                  rel="noopener"
                  >{{ board.title }}</a
                >
                @if (board.groupName !== null) {
                  <span class="tb-list__supporting">группа «{{ board.groupName }}»</span>
                }
              </div>
            </li>
          }
        </ul>
      </p-card>
    }
  `,
})
export class MyBoardsCard implements OnInit {
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
