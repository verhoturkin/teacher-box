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
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { quietContext } from '@core/http/api-error.interceptor';
import { HelpButton } from '@features/help/parts';
import { IdentityApi } from '@features/identity/parts';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { RowType } from '@shared/ui/row-type.directive';
import { BoardsApi } from '../data-access/boards-api';
import { Board } from '../data-access/boards.models';
import { BOARD_KIND_LABELS, boardMembersText } from '../boards-labels';
import { BoardBackupsDialog } from './board-backups-dialog';
import { BoardDefaults, BoardDialog, MemberOption } from './board-dialog';

/** A choice of the filter: `student:<id>` or `group:<id>`. */
interface FilterOption {
  readonly label: string;
  readonly value: string;
}

interface FilterGroup {
  readonly label: string;
  readonly items: readonly FilterOption[];
}

/**
 * Teacher: every board in one place (ADR-0028) — create, change, delete, copies; filtered by a student
 * or a group in the URL (`?student=`, `?group=`).
 */
@Component({
  selector: 'tb-boards-page',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    Button,
    Card,
    ConfirmDialog,
    Select,
    TableModule,
    Tag,
    Tooltip,
    HelpButton,
    EmptyState,
    LoadStateView,
    PageHeader,
    RowType,
    BoardDialog,
    BoardBackupsDialog,
  ],
  providers: [ConfirmationService],
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

    <div class="tb-toolbar">
      <div class="tb-field">
        <label for="boards-filter">Ученик или группа</label>
        <p-select
          inputId="boards-filter"
          [options]="filterOptions()"
          [group]="true"
          optionLabel="label"
          optionValue="value"
          [ngModel]="filter()"
          (ngModelChange)="applyFilter($event)"
          placeholder="Все доски"
          [showClear]="true"
          [filter]="true"
          filterPlaceholder="Поиск"
          appendTo="body"
        />
      </div>
    </div>

    <p-card>
      <h2 class="tb-sr-only">Список досок</h2>
      <tb-load-state [state]="state" what="доски" (retry)="load()">
        <p-table [value]="boards()" dataKey="id" [rowHover]="true" styleClass="tb-cards">
          <ng-template #header>
            <tr>
              <th class="tb-col-main">Доска</th>
              <th>Вид</th>
              <th>Кому открыта</th>
              <th>Изменена</th>
              <th class="tb-actions-column"><span class="tb-sr-only">Действия</span></th>
            </tr>
          </ng-template>
          <ng-template #body let-board [tbRowType]="boards()">
            <tr>
              <td data-label="Доска">
                @if (board.kind === 'EXCALIDRAW') {
                  <a class="tb-link" [routerLink]="[board.id]">{{ board.title }}</a>
                } @else {
                  <a class="tb-link" [href]="board.url" target="_blank" rel="noopener"
                    >{{ board.title }} <i class="pi pi-external-link" aria-hidden="true"></i
                  ></a>
                }
              </td>
              <td data-label="Вид">
                <p-tag
                  [value]="kindLabels[board.kind]"
                  [severity]="board.kind === 'EXCALIDRAW' ? 'info' : 'secondary'"
                />
              </td>
              <td data-label="Кому открыта">{{ membersText(board) }}</td>
              <td data-label="Изменена">{{ board.updatedAt | date: 'dd.MM.yyyy HH:mm' }}</td>
              <td class="tb-actions-column">
                @if (board.kind === 'EXCALIDRAW') {
                  <p-button
                    icon="pi pi-history"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [pTooltip]="'Резервные копии: ' + board.title"
                    [ariaLabel]="'Резервные копии: ' + board.title"
                    (onClick)="openBackups(board)"
                  />
                }
                <p-button
                  icon="pi pi-pencil"
                  [text]="true"
                  [rounded]="true"
                  severity="secondary"
                  [pTooltip]="'Изменить доску: ' + board.title"
                  [ariaLabel]="'Изменить доску: ' + board.title"
                  (onClick)="openEdit(board)"
                />
                <p-button
                  icon="pi pi-trash"
                  [text]="true"
                  [rounded]="true"
                  severity="danger"
                  [pTooltip]="'Удалить доску: ' + board.title"
                  [ariaLabel]="'Удалить доску: ' + board.title"
                  (onClick)="confirmRemove(board)"
                />
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="5">
                <tb-empty-state
                  icon="pi-th-large"
                  [title]="filter() === null ? 'Досок пока нет' : 'У них досок пока нет'"
                  hint="Нажмите «Новая доска»: доска Excalidraw откроется прямо в портале, а внешнюю доску (например, Холст) можно добавить ссылкой."
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </tb-load-state>
    </p-card>

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

  protected readonly filter = computed(() => {
    const student = this.student();
    const group = this.group();
    if (student) return `student:${student}`;
    return group ? `group:${group}` : null;
  });
  protected readonly filterOptions = computed<FilterGroup[]>(() => [
    {
      label: 'Ученики',
      items: this.students().map((student) => ({
        label: student.name,
        value: `student:${student.id}`,
      })),
    },
    {
      label: 'Группы',
      items: this.groups().map((group) => ({ label: group.name, value: `group:${group.id}` })),
    },
  ]);
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

  applyFilter(value: string | null): void {
    const [type, id] = value?.split(':') ?? [];
    void this.router.navigate([], {
      queryParams: {
        student: type === 'student' ? id : null,
        group: type === 'group' ? id : null,
      },
      queryParamsHandling: 'merge',
    });
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
}
