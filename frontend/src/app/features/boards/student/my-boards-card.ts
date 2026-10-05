import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { BoardsApi } from '../data-access/boards-api';
import { MyBoard } from '../data-access/boards.models';
import { MyBoardList } from './my-board-list';

/** Boards shown on the card; the rest are on «Мои доски». */
export const CARD_BOARDS = 3;

/**
 * A student's latest boards (their own and their groups'); hidden while there are none, a failed load
 * shows the card with «Повторить» (ADR-0025).
 */
@Component({
  selector: 'tb-my-boards-card',
  imports: [Card, RouterLink, LoadStateView, MyBoardList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state.status() === 'error') {
      <p-card header="Мои доски">
        <tb-load-state [state]="state" what="доски" [compact]="true" (retry)="load()" />
      </p-card>
    } @else if (boards().length > 0) {
      <p-card header="Мои доски">
        <tb-my-board-list [boards]="boards().slice(0, cardBoards)" />
        <a class="tb-link" routerLink="/cabinet/boards">Все доски ({{ boards().length }})</a>
      </p-card>
    }
  `,
})
export class MyBoardsCard implements OnInit {
  private readonly api = inject(BoardsApi);

  protected readonly cardBoards = CARD_BOARDS;
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
