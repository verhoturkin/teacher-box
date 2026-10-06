import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Menu } from 'primeng/menu';
import { Tooltip } from 'primeng/tooltip';
import { quietContext } from '@core/http/api-error.interceptor';
import { HelpButton } from '@features/help/parts';
import { IdentityApi } from '@features/identity/parts';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { BoardsApi } from '../data-access/boards-api';
import { Board } from '../data-access/boards.models';
import { BOARD_KIND_LABELS, boardMembersText } from '../boards-labels';
import { BoardBackupsDialog } from './board-backups-dialog';
import { BoardDefaults, BoardDialog, MemberOption } from './board-dialog';

/**
 * Teacher: every board in one place (ADR-0028) — create, change, delete, copies. «Доски (n)» of a student
 * or a group opens the list filtered in the URL (`?student=`, `?group=`); «Все доски» drops the filter.
 */
@Component({
  selector: 'tb-boards-page',
  imports: [
    RouterLink,
    Button,
    Card,
    ConfirmDialog,
    Menu,
    ButtonAttributes,
    Tooltip,
    HelpButton,
    EmptyState,
    LoadStateView,
    PageHeader,
    BoardDialog,
    BoardBackupsDialog,
  ],
  providers: [ConfirmationService, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Доски">
      <tb-help-button help topic="teacher/boards" />
      <p-button
        class="tb-page-fab"
        label="Новая доска"
        icon="pi pi-plus"
        (onClick)="openCreate()"
      />
    </tb-page-header>

    @if (filterLabel(); as label) {
      <div class="tb-toolbar">
        <span class="tb-strong">{{ label }}</span>
        <p-button
          label="Все доски"
          icon="pi pi-times"
          [text]="true"
          severity="secondary"
          (onClick)="showAll()"
        />
      </div>
    }

    <p-card>
      <h2 class="tb-sr-only">Список досок</h2>
      <tb-load-state [state]="state" what="доски" (retry)="load()">
        @if (boards().length > 0) {
          <ul class="tb-list" aria-label="Доски">
            @for (board of boards(); track board.id) {
              <li>
                <span class="tb-list__lead" aria-hidden="true"
                  ><i
                    [class]="board.kind === 'EXCALIDRAW' ? 'pi pi-th-large' : 'pi pi-external-link'"
                  ></i
                ></span>
                <div class="tb-list__text">
                  @if (board.kind === 'EXCALIDRAW') {
                    <a class="tb-list__title tb-link" [routerLink]="[board.id]">{{
                      board.title
                    }}</a>
                  } @else {
                    <a
                      class="tb-list__title tb-link"
                      [href]="board.url"
                      target="_blank"
                      rel="noopener"
                      >{{ board.title }}</a
                    >
                  }
                  <span class="tb-list__supporting">{{ details(board) }}</span>
                </div>
                <div class="tb-list__trail tb-list__trail--icons">
                  <p-button
                    icon="pi pi-ellipsis-v"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [pTooltip]="'Действия: ' + board.title"
                    [ariaLabel]="'Действия: ' + board.title"
                    [tbAttributes]="{
                      'aria-haspopup': 'menu',
                      'aria-expanded': menuFor()?.id === board.id ? 'true' : 'false',
                    }"
                    (onClick)="openMenu(board, $event)"
                  />
                </div>
              </li>
            }
          </ul>
        } @else {
          <tb-empty-state
            icon="pi-th-large"
            [title]="filter() === null ? 'Досок пока нет' : 'У них досок пока нет'"
            hint="Нажмите «Новая доска»: доска Excalidraw откроется прямо в портале, а внешнюю доску (например, Холст) можно добавить ссылкой."
          />
        }
      </tb-load-state>
    </p-card>

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
export class BoardsPage implements OnInit {
  private readonly api = inject(BoardsApi);
  private readonly identity = inject(IdentityApi);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly date = inject(DatePipe);

  /** `?student=<id>` — boards of a student, with their groups' boards. */
  readonly student = input<string>();
  /** `?group=<id>` — boards of a group. */
  readonly group = input<string>();

  protected readonly kindLabels = BOARD_KIND_LABELS;
  protected readonly membersText = boardMembersText;
  protected readonly state = new LoadState();
  protected readonly boards = signal<Board[]>([]);
  protected readonly students = signal<MemberOption[]>([]);
  protected readonly groups = signal<MemberOption[]>([]);
  protected readonly editing = signal<Board | null>(null);
  protected readonly dialogVisible = signal(false);
  protected readonly backupsOf = signal<Board | null>(null);
  protected readonly backupsVisible = signal(false);
  private readonly menu = viewChild.required<Menu>('menu');

  /** The board whose «⋮» menu is open: one popup menu serves every row. */
  protected readonly menuFor = signal<Board | null>(null);
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const board = this.menuFor();
    return board === null ? [] : this.actionsOf(board);
  });

  protected readonly filter = computed(() => {
    const student = this.student();
    const group = this.group();
    if (student) return `student:${student}`;
    return group ? `group:${group}` : null;
  });
  /** Whose boards the list shows when it is filtered; `null` for all boards. */
  protected readonly filterLabel = computed(() => {
    const student = this.student();
    const group = this.group();
    if (student) {
      const name = this.students().find((option) => option.id === student)?.name;
      return name ? `Доски ученика: ${name}` : 'Доски ученика';
    }
    if (group) {
      const name = this.groups().find((option) => option.id === group)?.name;
      return name ? `Доски группы: ${name}` : 'Доски группы';
    }
    return null;
  });
  /** A new board starts with the student or the group of the filter. */
  protected readonly defaults = computed<BoardDefaults>(() => ({
    studentIds: this.student() ? [this.student() ?? ''] : [],
    groupIds: this.group() ? [this.group() ?? ''] : [],
  }));

  constructor() {
    effect(() => {
      this.filter();
      untracked(() => {
        this.load();
      });
    });
  }

  ngOnInit(): void {
    this.identity.listStudents(quietContext()).subscribe((students) => {
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, name: student.displayName })),
      );
    });
    this.identity.listGroups(quietContext()).subscribe((groups) => {
      this.groups.set(
        groups
          .filter((group) => group.archivedAt === null)
          .map((group) => ({ id: group.id, name: group.name })),
      );
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

  showAll(): void {
    void this.router.navigate([], {
      queryParams: { student: null, group: null },
      queryParamsHandling: 'merge',
    });
  }

  /** «Доска Excalidraw · Мария, группа «ОГЭ» · изменена 01.09.2026 10:00»; an external board — no time. */
  protected details(board: Board): string {
    const parts = [this.kindLabels[board.kind], this.membersText(board)];
    if (board.kind === 'EXCALIDRAW') {
      parts.push(`изменена ${this.date.transform(board.updatedAt, 'dd.MM.yyyy HH:mm') ?? ''}`);
    }
    return parts.join(' · ');
  }

  protected openMenu(board: Board, event: Event): void {
    this.menuFor.set(board);
    this.menu().toggle(event);
  }

  protected openCreate(): void {
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
        header: 'Удалить доску?',
        message:
          board.kind === 'EXCALIDRAW'
            ? `Доска «${board.title}» удалится вместе с рисунком, картинками и резервными копиями. Вернуть её можно только из резервной копии портала.`
            : `Ссылка на доску «${board.title}» исчезнет из портала; сама доска в другом сервисе останется.`,
        acceptLabel: 'Удалить',
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
        label: 'Резервные копии',
        icon: 'pi pi-history',
        command: () => {
          this.openBackups(board);
        },
      });
    }
    items.push(
      {
        label: 'Изменить',
        icon: 'pi pi-pencil',
        command: () => {
          this.openEdit(board);
        },
      },
      {
        label: 'Удалить…',
        icon: 'pi pi-trash',
        styleClass: 'tb-menu-item--danger',
        command: () => {
          this.confirmRemove(board);
        },
      },
    );
    return items;
  }
}
