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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Button, ButtonDirective, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MultiSelect } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { ToBoardDialog } from '@features/boards/parts';
import { BoardTextbook, TextbookToBoardDialog } from '@features/textbooks/parts';
import { GroupPicker, IdentityApi } from '@features/identity/parts';
import { FileSaver } from '@shared/files/file-saver';
import { MarkdownView } from '@shared/ui/markdown-view';
import { RowType } from '@shared/ui/row-type.directive';
import { HomeworkApi } from '../data-access/homework-api';
import { assignmentBoard } from './assignment-board';
import { AssignmentDetails, Attachment, BoundTextbook } from '../data-access/homework.models';
import { AttachmentList } from '../ui/attachment-list';
import { TextbookList } from '../ui/textbook-list';
import { BindTextbookDialog } from './bind-textbook-dialog';
import { FilePicker } from '../ui/file-picker';
import { TaskStatusTag } from '../ui/task-status-tag';
import { AssignmentDialog, StudentOption } from './assignment-dialog';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';
import { pageDetail } from '@core/routing/page-detail';
import { Avatar } from '@shared/ui/avatar';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/** Teacher: one assignment — text, materials and progress of every student. */
@Component({
  selector: 'tb-assignment-page',
  imports: [
    Avatar,
    EmptyState,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    Button,
    ButtonDirective,
    ButtonLabel,
    Card,
    ConfirmDialog,
    MultiSelect,
    TableModule,
    MarkdownView,
    RowType,
    AttachmentList,
    BindTextbookDialog,
    TextbookList,
    FilePicker,
    TaskStatusTag,
    AssignmentDialog,
    GroupPicker,
    ToBoardDialog,
    TextbookToBoardDialog,
    PageHeader,
    HelpButton,
    LoadStateView,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (details(); as assignment) {
      <tb-page-header [title]="assignment.title" back="/teacher/homework" [backLabel]="t.back">
        <tb-help-button help topic="teacher/homework" />
        <span meta>
          {{
            assignment.dueAt
              ? t.due((assignment.dueAt | date: 'dd.MM.yyyy HH:mm') ?? '')
              : t.noDueDate
          }}
        </span>
        @if (assignment.kind !== 'INTERACTIVE') {
          <p-button
            [label]="t.toBoard"
            icon="pi pi-th-large"
            severity="secondary"
            [disabled]="!assignment.description"
            (onClick)="boardVisible.set(true)"
          />
        }
        <p-button
          [label]="t.edit"
          icon="pi pi-pencil"
          severity="secondary"
          (onClick)="editVisible.set(true)"
        />
      </tb-page-header>

      <div class="tb-stack">
        <p-card [header]="t.assignment">
          @if (assignment.description) {
            <tb-markdown [text]="assignment.description" />
          } @else {
            <p class="tb-muted">{{ t.noText }}</p>
          }
          <h3 class="tb-subtitle">{{ t.materials }}</h3>
          <tb-attachment-list
            [attachments]="assignment.attachments"
            [removable]="true"
            (download)="download($event)"
            (remove)="confirmRemove($event)"
          />
          <div class="tb-inline">
            <tb-file-picker [(files)]="newFiles" [label]="t.addFiles" />
            @if (newFiles().length > 0) {
              <p-button
                [label]="t.upload"
                class="tb-tonal"
                severity="success"
                icon="pi pi-upload"
                [loading]="uploading()"
                (onClick)="upload()"
              />
            }
          </div>
          <h3 class="tb-subtitle">{{ t.textbooks }}</h3>
          <tb-textbook-list
            [textbooks]="assignment.textbooks"
            [editable]="true"
            (edit)="openBind($event)"
            (remove)="unbind($event)"
            (toBoard)="openTextbookBoard($event)"
          />
          <div class="tb-inline">
            <p-button
              [label]="t.bindTextbook"
              icon="pi pi-book"
              severity="secondary"
              (onClick)="openBind(null)"
            />
          </div>
        </p-card>

        <p-card [header]="t.students">
          <p-table [value]="assignment.tasks" dataKey="taskId" styleClass="tb-cards">
            <ng-template #header>
              <tr>
                <th class="tb-col-main">{{ t.student }}</th>
                <th>{{ t.status }}</th>
                <th>{{ t.submitted }}</th>
                <th class="tb-actions-column">
                  <span class="tb-sr-only">{{ c.actions }}</span>
                </th>
              </tr>
            </ng-template>
            <ng-template #body let-task [tbRowType]="assignment.tasks">
              <tr>
                <td [attr.data-label]="t.student">
                  <div class="tb-person">
                    <tb-avatar [name]="task.studentName" [photo]="task.studentAvatar" />
                    <div class="tb-list__text">
                      <span class="tb-list__title">{{ task.studentName }}</span>
                    </div>
                  </div>
                </td>
                <td [attr.data-label]="t.status">
                  <tb-task-status
                    [status]="task.status"
                    [overdue]="task.overdue"
                    [grade]="task.grade"
                  />
                </td>
                <td [attr.data-label]="t.submitted">
                  {{ task.submittedAt ? (task.submittedAt | date: 'dd.MM.yyyy HH:mm') : '—' }}
                </td>
                <td class="tb-actions-column">
                  <a
                    pButton
                    [routerLink]="['/teacher/homework/tasks', task.taskId]"
                    [text]="true"
                    [attr.aria-label]="
                      t.action(task.status === 'SUBMITTED' ? t.review : t.open, task.studentName)
                    "
                  >
                    <span pButtonLabel>{{ task.status === 'SUBMITTED' ? t.review : t.open }}</span>
                  </a>
                </td>
              </tr>
            </ng-template>
            <ng-template #emptymessage>
              <tr>
                <td colspan="4">
                  <tb-empty-state icon="pi-send" [title]="t.notAssigned" />
                </td>
              </tr>
            </ng-template>
          </p-table>
          <div class="tb-inline tb-assign">
            <div class="tb-field tb-grow">
              <label for="assign-students">{{ t.assignMore }}</label>
              <p-multiselect
                inputId="assign-students"
                [options]="unassigned()"
                [formControl]="toAssign"
                optionLabel="displayName"
                optionValue="id"
                [filter]="true"
                [filterPlaceHolder]="t.search"
                [ariaFilterLabel]="t.search"
                display="chip"
                appendTo="body"
                [fluid]="true"
              />
            </div>
            <tb-group-picker inputId="assign-group" (picked)="addStudents($event)" />
            <p-button
              class="tb-tonal"
              [label]="t.assign"
              severity="success"
              [disabled]="selectedToAssign().length === 0"
              [loading]="busy.is('assign')"
              (onClick)="assign()"
            />
          </div>
        </p-card>
      </div>

      <tb-assignment-dialog
        [(visible)]="editVisible"
        [assignment]="assignment"
        (saved)="details.set($event)"
      />
      <tb-textbook-to-board-dialog
        [(visible)]="textbookBoardVisible"
        [textbook]="boardTextbook()"
        [initialPages]="boardPages()"
        [students]="taskStudents()"
      />
      <tb-bind-textbook-dialog
        [(visible)]="bindVisible"
        [assignmentId]="assignment.id"
        [taken]="assignment.textbooks"
        [bound]="binding()"
        (saved)="details.set($event)"
      />
      <tb-to-board-dialog
        [(visible)]="boardVisible"
        [title]="assignment.title"
        [markdown]="assignment.description ?? ''"
        [students]="taskStudents()"
        [frame]="board()?.frame ?? null"
        [pictures]="board()?.pictures ?? []"
      />
    } @else {
      <tb-page-header [title]="t.assignment" back="/teacher/homework" [backLabel]="t.back" />
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()" />
    }
    <p-confirmdialog />
  `,
})
export class AssignmentPage implements OnInit {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.page;
  protected readonly busy = new Busy();
  private readonly api = inject(HomeworkApi);
  private readonly identity = inject(IdentityApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly snackbar = inject(Snackbar);
  private readonly fileSaver = inject(FileSaver);

  /** Route parameter. */
  readonly assignmentId = input.required<string>();

  protected readonly details = signal<AssignmentDetails | null>(null);
  /** The students of the assignment: «На доску» offers only their boards. */
  protected readonly taskStudents = computed(
    () => this.details()?.tasks.map((task) => task.studentId) ?? [],
  );

  constructor() {
    pageDetail(() => this.details()?.title);
  }
  protected readonly editVisible = signal(false);
  protected readonly boardVisible = signal(false);
  /** «На доску» puts the text, the pictures and the textbook pages of the assignment in a dated frame. */
  protected readonly board = computed(() => {
    const assignment = this.details();
    return assignment === null || !this.boardVisible()
      ? null
      : assignmentBoard(assignment, new Date());
  });
  protected readonly bindVisible = signal(false);
  protected readonly textbookBoardVisible = signal(false);
  protected readonly boardTextbook = signal<BoardTextbook | null>(null);
  protected readonly boardPages = signal<string | null>(null);
  /** The bound textbook whose pages change; `null` binds a new one. */
  protected readonly binding = signal<BoundTextbook | null>(null);
  protected readonly newFiles = signal<File[]>([]);
  protected readonly uploading = signal(false);
  private readonly students = signal<StudentOption[]>([]);
  readonly toAssign = new FormControl<string[]>([], { nonNullable: true });
  protected readonly selectedToAssign = toSignal(this.toAssign.valueChanges, {
    initialValue: this.toAssign.value,
  });
  protected readonly unassigned = computed(() => {
    const assigned = new Set(this.details()?.tasks.map((task) => task.studentId) ?? []);
    return this.students().filter((student) => !assigned.has(student.id));
  });

  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load();
    this.identity.listStudents().subscribe((students) => {
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, displayName: student.displayName })),
      );
    });
  }

  protected load(): void {
    this.api
      .assignment(this.assignmentId())
      .pipe(this.state.track())
      .subscribe((assignment) => {
        this.details.set(assignment);
      });
  }

  protected download(file: Attachment): void {
    this.api.teacherFile(file.id).subscribe((blob) => {
      this.fileSaver.save(blob, file.filename);
    });
  }

  protected upload(): void {
    const assignment = this.details();
    if (assignment === null) {
      return;
    }
    this.uploading.set(true);
    this.api.uploadMaterials(assignment.id, this.newFiles()).subscribe({
      next: (added) => {
        this.uploading.set(false);
        this.newFiles.set([]);
        this.details.set({ ...assignment, attachments: [...assignment.attachments, ...added] });
      },
      error: () => {
        this.uploading.set(false);
      },
    });
  }

  protected confirmRemove(file: Attachment): void {
    const assignment = this.details();
    if (assignment === null) {
      return;
    }
    this.confirmation.confirm(
      dangerConfirmation({
        header: T.page.deleteHeader,
        message: T.page.deleteMessage(file.filename),
        acceptLabel: T.page.delete,
        accept: () => {
          this.api.removeMaterial(assignment.id, file.id).subscribe(() => {
            this.details.set({
              ...assignment,
              attachments: assignment.attachments.filter((candidate) => candidate.id !== file.id),
            });
          });
        },
      }),
    );
  }

  protected openBind(textbook: BoundTextbook | null): void {
    this.binding.set(textbook);
    this.bindVisible.set(true);
  }

  /** The bound pages of a textbook on a board (the first page when it is bound whole). */
  protected openTextbookBoard(textbook: BoundTextbook): void {
    this.boardTextbook.set({
      id: textbook.textbookId,
      title: textbook.title,
      format: textbook.format,
      pageCount: textbook.pageCount,
    });
    this.boardPages.set(textbook.pages);
    this.textbookBoardVisible.set(true);
  }

  protected unbind(textbook: BoundTextbook): void {
    const assignment = this.details();
    if (assignment === null) {
      return;
    }
    this.api.unbindTextbook(assignment.id, textbook.textbookId).subscribe((updated) => {
      this.details.set(updated);
      this.snackbar.success(T.page.unbound(textbook.title));
    });
  }

  /** Adds the students of a chosen group who do not have the assignment yet. */
  protected addStudents(ids: readonly string[]): void {
    const available = new Set(this.unassigned().map((student) => student.id));
    this.toAssign.setValue([
      ...new Set([...this.toAssign.value, ...ids.filter((id) => available.has(id))]),
    ]);
  }

  protected assign(): void {
    const assignment = this.details();
    const studentIds = this.toAssign.value;
    if (assignment === null || studentIds.length === 0) {
      return;
    }
    this.busy
      .guard('assign', this.api.assignStudents(assignment.id, studentIds))
      .subscribe((updated) => {
        this.details.set(updated);
        this.toAssign.setValue([]);
        this.snackbar.success(T.page.assigned);
      });
  }
}
