import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Card } from 'primeng/card';
import { HelpButton } from '@features/help/parts';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { BoardsApi } from '../data-access/boards-api';
import { MyBoard } from '../data-access/boards.models';
import { MyBoardList } from './my-board-list';
import { T } from '../i18n/texts';

/**
 * Student: «Мои доски» — their own boards and their groups', newest change first, in two cards: «Доски на портале»
 * and «Внешние доски» (a card without boards is not shown).
 */
@Component({
  selector: 'tb-my-boards-page',
  imports: [Card, HelpButton, EmptyState, LoadStateView, PageHeader, MyBoardList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="cabinet/lesson" />
    </tb-page-header>
    @if (state.ready() && boards().length > 0) {
      <div class="tb-stack">
        @if (portal().length > 0) {
          <p-card [header]="k.portal">
            <tb-my-board-list [boards]="portal()" [label]="k.portal" />
          </p-card>
        }
        @if (external().length > 0) {
          <p-card [header]="k.external">
            <tb-my-board-list [boards]="external()" [label]="k.external" />
          </p-card>
        }
      </div>
    } @else {
      <p-card>
        <h2 class="tb-sr-only">{{ t.list }}</h2>
        <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
          <tb-empty-state icon="pi-tb-board" [title]="t.emptyTitle" [hint]="t.emptyHint" />
        </tb-load-state>
      </p-card>
    }
  `,
})
export class MyBoardsPage implements OnInit {
  protected readonly t = T.myPage;
  protected readonly k = T.cards;
  private readonly api = inject(BoardsApi);

  protected readonly boards = signal<MyBoard[]>([]);
  /** «Доски на портале»: the Excalidraw boards; a card without boards is not shown. */
  protected readonly portal = computed(() =>
    this.boards().filter((board) => board.kind === 'EXCALIDRAW'),
  );
  /** «Внешние доски»: the boards by link. */
  protected readonly external = computed(() =>
    this.boards().filter((board) => board.kind === 'LINK'),
  );
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
