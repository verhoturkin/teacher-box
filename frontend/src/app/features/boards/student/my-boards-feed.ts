import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Observable } from 'rxjs';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MaterialCard } from '@shared/ui/material-card';
import { BoardsApi } from '../data-access/boards-api';
import { MyBoard } from '../data-access/boards.models';
import { boardRoute, boardServiceTag } from '../boards-labels';
import { BoardsFilter } from '../teacher/boards-feed';
import { T } from '../i18n/texts';

/**
 * Student: the boards of the Materials feed — their own and their groups', newest change first, as cards
 * with previews (no actions). The page of Materials gives the search text and the filter.
 */
@Component({
  selector: 'tb-my-boards-feed',
  imports: [MaterialCard, EmptyState, LoadStateView],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-load-state [state]="state" [what]="t.what" [compact]="limit() > 0" (retry)="load()">
      @if (shown().length > 0) {
        <ul class="tb-material-grid" [attr.aria-label]="t.list">
          @for (board of visible(); track board.id) {
            <li>
              <tb-material-card
                [title]="board.title"
                [supporting]="details(board)"
                [routerLink]="board.kind === 'EXCALIDRAW' ? route(board.id) : null"
                [href]="board.kind === 'LINK' ? board.url : null"
                [tonal]="board.kind === 'LINK'"
                [tag]="board.kind === 'LINK' ? tagOf(board) : null"
                [loader]="loadPreview"
                [ref]="board.kind === 'EXCALIDRAW' && board.previewUpdatedAt ? board.id : null"
                [version]="board.previewUpdatedAt"
                [icon]="board.kind === 'EXCALIDRAW' ? 'tb-i-co_present' : 'tb-i-dashboard'"
              />
            </li>
          }
        </ul>
      } @else if (limit() > 0) {
        <!-- the home page: a place without boards stays empty -->
      } @else if (boards().length > 0) {
        <tb-empty-state icon="tb-i-search" [title]="k.notFound" />
      } @else {
        <tb-empty-state icon="tb-i-co_present" [title]="t.emptyTitle" [hint]="t.emptyHint" />
      }
    </tb-load-state>
  `,
})
export class MyBoardsFeed implements OnInit {
  protected readonly t = T.myPage;
  protected readonly k = T.cards;
  private readonly m = T.myList;
  private readonly api = inject(BoardsApi);
  private readonly date = inject(DatePipe);

  /** The search text of the page. */
  readonly query = input('');
  readonly filter = input<BoardsFilter>('all');
  /** The home page shows only the newest boards and no empty state; 0 — all of them. */
  readonly limit = input(0);

  protected readonly state = new LoadState();
  protected readonly boards = signal<MyBoard[]>([]);
  /** How many boards the student has (before the search and the filter). */
  readonly total = computed(() => this.boards().length);
  protected readonly shown = computed(() => {
    const filter = this.filter();
    const kind = filter === 'all' ? null : filter === 'portal' ? 'EXCALIDRAW' : 'LINK';
    const query = this.query().trim().toLocaleLowerCase();
    return this.boards().filter(
      (board) =>
        (kind === null || board.kind === kind) &&
        (query === '' || board.title.toLocaleLowerCase().includes(query)),
    );
  });

  protected readonly visible = computed(() => {
    const limit = this.limit();
    return limit > 0 ? this.shown().slice(0, limit) : this.shown();
  });

  /** The preview of a board (a stable function for `tb-blob-image`). */
  protected readonly loadPreview = (id: string): Observable<Blob> =>
    this.api.preview(id, this.boards().find((board) => board.id === id)?.previewUpdatedAt);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api
      .myBoards()
      .pipe(this.state.track())
      .subscribe((boards) => {
        this.boards.set(boards);
      });
  }

  protected route(boardId: string): string {
    return boardRoute('cabinet', boardId);
  }

  protected tagOf(board: MyBoard): string | null {
    return boardServiceTag(board.url);
  }

  /** «группа «ОГЭ» · 02.10»: whose group the board is open to and when it changed. */
  protected details(board: MyBoard): string {
    const names = board.groupNames.join('», «');
    const groups =
      board.groupNames.length === 0
        ? null
        : `${board.groupNames.length > 1 ? this.m.groups : this.m.group} «${names}»`;
    return [groups, this.date.transform(board.updatedAt, 'dd.MM')]
      .filter((part) => part !== null)
      .join(' · ');
  }
}
