import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
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
  imports: [ButtonDirective, ButtonIcon, ButtonLabel, Card, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state.status() === 'error') {
      <p-card header="Мои доски">
        <tb-load-state [state]="state" what="доски" [compact]="true" (retry)="load()" />
      </p-card>
    } @else if (boards().length > 0) {
      <p-card header="Мои доски">
        <ul class="tb-my-boards">
          @for (board of boards(); track board.id) {
            <li>
              <a pButton [href]="board.url" target="_blank" rel="noopener" severity="secondary">
                <i pButtonIcon aria-hidden="true" class="pi pi-th-large"></i>
                <span pButtonLabel>{{ board.title }}</span>
              </a>
              @if (board.groupName !== null) {
                <small class="tb-muted">группа «{{ board.groupName }}»</small>
              }
            </li>
          }
        </ul>
      </p-card>
    }
  `,
  styles: `
    .tb-my-boards {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--tb-space-2);
      }
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
