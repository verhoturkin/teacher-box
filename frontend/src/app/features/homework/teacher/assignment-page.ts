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
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button, ButtonDirective, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MultiSelect } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { ToBoardDialog } from '@features/boards/parts';
import { GroupPicker, IdentityApi } from '@features/identity/parts';
import { FileSaver } from '@shared/files/file-saver';
import { MarkdownView } from '@shared/ui/markdown-view';
import { RowType } from '@shared/ui/row-type.directive';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentDetails, Attachment } from '../data-access/homework.models';
import { AttachmentList } from '../ui/attachment-list';
import { FilePicker } from '../ui/file-picker';
import { TaskStatusTag } from '../ui/task-status-tag';
import { AssignmentDialog, StudentOption } from './assignment-dialog';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';

/** Teacher: one assignment — text, materials and progress of every student. */
@Component({
  selector: 'tb-assignment-page',
  imports: [
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
    FilePicker,
    TaskStatusTag,
    AssignmentDialog,
    GroupPicker,
    ToBoardDialog,
    PageHeader,
    HelpButton,
    LoadStateView,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (details(); as assignment) {
      <tb-page-header [title]="assignment.title" back="/teacher/homework" backLabel="Все задания">
        <tb-help-button help topic="teacher/homework" />
        <span meta>
          {{
            assignment.dueAt
              ? 'Срок: ' + (assignment.dueAt | date: 'dd.MM.yyyy HH:mm')
              : 'Без срока'
          }}
        </span>
        <p-button
          label="На доску"
          icon="pi pi-th-large"
          severity="secondary"
          [disabled]="!assignment.description"
          (onClick)="boardVisible.set(true)"
        />
        <p-button
          label="Редактировать"
          icon="pi pi-pencil"
          severity="secondary"
          (onClick)="editVisible.set(true)"
        />
      </tb-page-header>

      <div class="tb-stack">
        <p-card header="Задание">
          @if (assignment.description) {
            <tb-markdown [text]="assignment.description" />
          } @else {
            <p class="tb-muted">Текст задания не заполнен.</p>
          }
          <h3 class="tb-subtitle">Материалы</h3>
          <tb-attachment-list
            [attachments]="assignment.attachments"
            [removable]="true"
            (download)="download($event)"
            (remove)="confirmRemove($event)"
          />
          <div class="tb-inline">
            <tb-file-picker [(files)]="newFiles" label="Добавить файлы" />
            @if (newFiles().length > 0) {
              <p-button
                label="Загрузить"
                severity="secondary"
                icon="pi pi-upload"
                [loading]="uploading()"
                (onClick)="upload()"
              />
            }
          </div>
        </p-card>

        <p-card header="Ученики">
          <p-table [value]="assignment.tasks" dataKey="taskId" styleClass="tb-cards">
            <ng-template #header>
              <tr>
                <th>Ученик</th>
                <th>Статус</th>
                <th>Сдано</th>
                <th class="tb-actions-column"><span class="tb-sr-only">Действия</span></th>
              </tr>
            </ng-template>
            <ng-template #body let-task [tbRowType]="assignment.tasks">
              <tr>
                <td data-label="Ученик">{{ task.studentName }}</td>
                <td data-label="Статус">
                  <tb-task-status
                    [status]="task.status"
                    [overdue]="task.overdue"
                    [grade]="task.grade"
                  />
                </td>
                <td data-label="Сдано">
                  {{ task.submittedAt ? (task.submittedAt | date: 'dd.MM.yyyy HH:mm') : '—' }}
                </td>
                <td class="tb-actions-column">
                  <a pButton [routerLink]="['/teacher/homework/tasks', task.taskId]" [text]="true">
                    <span pButtonLabel>{{
                      task.status === 'SUBMITTED' ? 'Проверить' : 'Открыть'
                    }}</span>
                  </a>
                </td>
              </tr>
            </ng-template>
            <ng-template #emptymessage>
              <tr>
                <td colspan="4">
                  <tb-empty-state icon="pi-send" title="Задание ещё никому не выдано" />
                </td>
              </tr>
            </ng-template>
          </p-table>
          <div class="tb-inline tb-assign">
            <div class="tb-field tb-grow">
              <label for="assign-students">Выдать ещё ученикам</label>
              <p-multiselect
                inputId="assign-students"
                [options]="unassigned()"
                [formControl]="toAssign"
                optionLabel="displayName"
                optionValue="id"
                [filter]="true"
                filterPlaceHolder="Поиск"
                ariaFilterLabel="Поиск"
                display="chip"
                appendTo="body"
                [fluid]="true"
              />
            </div>
            <tb-group-picker inputId="assign-group" (picked)="addStudents($event)" />
            <p-button
              class="tb-tonal"
              label="Выдать"
              severity="success"
              [disabled]="selectedToAssign().length === 0"
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
      <tb-to-board-dialog
        [(visible)]="boardVisible"
        [title]="assignment.title"
        [markdown]="assignment.description ?? ''"
        [ownerIds]="taskStudents(assignment)"
      />
    } @else {
      <tb-page-header title="Задание" back="/teacher/homework" backLabel="Все задания" />
      <tb-load-state [state]="state" what="задание" (retry)="load()" />
    }
    <p-confirmdialog />
  `,
})
export class AssignmentPage implements OnInit {
  private readonly api = inject(HomeworkApi);
  private readonly identity = inject(IdentityApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly fileSaver = inject(FileSaver);

  /** Route parameter. */
  readonly assignmentId = input.required<string>();

  protected readonly details = signal<AssignmentDetails | null>(null);
  protected readonly editVisible = signal(false);
  protected readonly boardVisible = signal(false);
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

  protected taskStudents(assignment: AssignmentDetails): string[] {
    return assignment.tasks.map((task) => task.studentId);
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
        header: 'Удалить файл?',
        message: `Файл «${file.filename}» будет удалён без возможности восстановления.`,
        acceptLabel: 'Удалить',
        rejectLabel: 'Отмена',
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
    this.api.assignStudents(assignment.id, studentIds).subscribe((updated) => {
      this.details.set(updated);
      this.toAssign.setValue([]);
      this.messages.add({ severity: 'success', summary: 'Готово', detail: 'Задание выдано' });
    });
  }
}
