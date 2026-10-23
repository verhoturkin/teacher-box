import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Observable } from 'rxjs';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Menu } from 'primeng/menu';
import { quietContext } from '@core/http/api-error.interceptor';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MaterialCard } from '@shared/ui/material-card';
import { MaterialSort, sortMaterials } from '@shared/ui/material-sort';
import { BoardsApi } from '../data-access/boards-api';
import { Board } from '../data-access/boards.models';
import { boardMembersText, boardRoute, boardServiceTag } from '../boards-labels';
import { BoardBackupsDialog } from './board-backups-dialog';
import { BoardDefaults, BoardDialog, MemberOption } from './board-dialog';
import { T } from '../i18n/texts';

/** Which boards the feed shows: all, those of the portal (Excalidraw) or the external ones (by link). */
export type BoardsFilter = 'all' | 'portal' | 'external';

/** The boards whose title or a student's (a group's) name has the search text. */
function found(boards: readonly Board[], text: string): readonly Board[] {
  const query = text.trim().toLocaleLowerCase();
  return query === ''
    ? boards
    : boards.filter(
        (board) =>
          board.title.toLocaleLowerCase().includes(query) ||
          board.members.some((member) => member.name?.toLocaleLowerCase().includes(query)),
      );
}

/**
 * Teacher: the boards of the Materials feed (ADR-0028, redesign spec §10.1) as cards with previews — the
 * Excalidraw boards of the portal and the external ones (by link, with the tag of their service). The page
 * of Materials gives the search text, the filter and the sort; a card opens its board, «⋮» keeps change,
 * copies and delete. `student` / `group` ask the server for the boards of a student (with their groups')
 * or of a group.
 */
@Component({
  selector: 'tb-boards-feed',
  imports: [
    MaterialCard,
    ConfirmDialog,
    Menu,
    EmptyState,
    LoadStateView,
    BoardDialog,
    BoardBackupsDialog,
  ],
  providers: [ConfirmationService, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
      @if (shown().length > 0) {
        <ul class="tb-material-grid" [attr.aria-label]="t.list">
          @for (board of shown(); track board.id) {
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
                [actionsLabel]="t.actions(board.title)"
                [menuOpen]="menuFor()?.id === board.id"
                (menu)="openMenu(board, $event)"
              />
            </li>
          }
        </ul>
      } @else if (boards().length > 0) {
        <tb-empty-state icon="tb-i-search" [title]="k.notFound" />
      } @else {
        <tb-empty-state
          icon="tb-i-co_present"
          [title]="member() ? t.emptyFilteredTitle : t.emptyTitle"
          [hint]="t.emptyHint"
        />
      }
    </tb-load-state>

    <p-menu
      #menu
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      (onHide)="menuFor.set(null)"
    />
    <tb-board-dialog
      [(visible)]="dialogVisible"
      [board]="editing()"
      [students]="students()"
      [groups]="groups()"
      [defaults]="defaults()"
      (saved)="load()"
    />
    <tb-board-backups-dialog
      [(visible)]="backupsVisible"
      [boardId]="backupsOf()?.id ?? null"
      [title]="backupsOf()?.title ?? ''"
      (restored)="load()"
    />
    <p-confirmdialog />
  `,
})
export class BoardsFeed {
  protected readonly t = T.list;
  protected readonly k = T.cards;
  private readonly api = inject(BoardsApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly date = inject(DatePipe);

  /** The search text of the page. */
  readonly query = input('');
  readonly filter = input<BoardsFilter>('all');
  readonly sort = input<MaterialSort>('changed');
  /** `?student=<id>` — boards of a student, with their groups' boards. */
  readonly student = input<string | undefined>();
  /** `?group=<id>` — boards of a group. */
  readonly group = input<string | undefined>();
  /** The students and the groups the dialog offers. */
  readonly students = input<readonly MemberOption[]>([]);
  readonly groups = input<readonly MemberOption[]>([]);

  protected readonly state = new LoadState();
  protected readonly boards = signal<Board[]>([]);
  /** How many boards the server found (before the search, the filter and the sort). */
  readonly total = computed(() => this.boards().length);
  protected readonly shown = computed(() => {
    const filter = this.filter();
    const kind = filter === 'all' ? null : filter === 'portal' ? 'EXCALIDRAW' : 'LINK';
    const ofKind = this.boards().filter((board) => kind === null || board.kind === kind);
    return sortMaterials(found(ofKind, this.query()), this.sort());
  });
  protected readonly member = computed(() => this.student() ?? this.group());
  protected readonly editing = signal<Board | null>(null);
  protected readonly dialogVisible = signal(false);
  protected readonly backupsOf = signal<Board | null>(null);
  protected readonly backupsVisible = signal(false);
  private readonly menu = viewChild.required<Menu>('menu');

  /** The board whose «⋮» menu is open: one popup menu serves every card. */
  protected readonly menuFor = signal<Board | null>(null);
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const board = this.menuFor();
    return board === null ? [] : this.actionsOf(board);
  });

  /** A new board starts with the student or the group of the filter. */
  protected readonly defaults = computed<BoardDefaults>(() => ({
    studentIds: this.student() ? [this.student() ?? ''] : [],
    groupIds: this.group() ? [this.group() ?? ''] : [],
  }));

  /** The preview of a board (a stable function for `tb-blob-image`). */
  protected readonly loadPreview = (id: string): Observable<Blob> =>
    this.api.preview(id, this.boards().find((board) => board.id === id)?.previewUpdatedAt);

  constructor() {
    effect(() => {
      this.student();
      this.group();
      untracked(() => {
        this.load();
      });
    });
  }

  load(): void {
    this.api
      .list({ studentId: this.student() ?? null, groupId: this.group() ?? null }, quietContext())
      .pipe(this.state.track())
      .subscribe((boards) => {
        this.boards.set(boards);
      });
  }

  /** «Мария, группа «ОГЭ» · 01.09.2026»: whom the board is open to and when it changed. */
  protected details(board: Board): string {
    return [boardMembersText(board), this.date.transform(board.updatedAt, 'dd.MM') ?? ''].join(
      ' · ',
    );
  }

  protected route(boardId: string): string {
    return boardRoute('teacher', boardId);
  }

  protected tagOf(board: Board): string | null {
    return boardServiceTag(board.url);
  }

  protected openMenu(board: Board, event: Event): void {
    this.menuFor.set(board);
    this.menu().toggle(event);
  }

  /** The form of a new board («Создать» in the rail, the FAB of a phone). */
  openCreate(): void {
    this.editing.set(null);
    this.dialogVisible.set(true);
  }

  protected openEdit(board: Board): void {
    this.editing.set(board);
    this.dialogVisible.set(true);
  }

  protected openBackups(board: Board): void {
    this.backupsOf.set(board);
    this.backupsVisible.set(true);
  }

  protected confirmRemove(board: Board): void {
    this.confirmation.confirm(
      dangerConfirmation({
        header: T.list.deleteHeader,
        message:
          board.kind === 'EXCALIDRAW'
            ? T.list.deleteExcalidraw(board.title)
            : T.list.deleteLink(board.title),
        acceptLabel: T.list.delete,
        accept: () => {
          this.api.remove(board.id).subscribe(() => {
            this.load();
          });
        },
      }),
    );
  }

  private actionsOf(board: Board): MenuItem[] {
    const items: MenuItem[] = [];
    if (board.kind === 'EXCALIDRAW') {
      items.push({
        label: T.list.backups,
        icon: 'tb-i tb-i-history',
        command: () => {
          this.openBackups(board);
        },
      });
    }
    items.push(
      {
        label: T.list.edit,
        icon: 'tb-i tb-i-edit',
        command: () => {
          this.openEdit(board);
        },
      },
      {
        label: T.list.deleteItem,
        icon: 'tb-i tb-i-delete',
        styleClass: 'tb-menu-item--danger',
        command: () => {
          this.confirmRemove(board);
        },
      },
    );
    return items;
  }
}
