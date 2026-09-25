import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MultiSelect } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { IdentityApi } from '@features/identity';
import { FileSaver } from '@shared/files/file-saver';
import { MarkdownView } from '@shared/ui/markdown-view';
import { RowType } from '@shared/ui/row-type.directive';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentDetails, Attachment } from '../data-access/homework.models';
import { AttachmentList } from '../ui/attachment-list';
import { FilePicker } from '../ui/file-picker';
import { TaskStatusTag } from '../ui/task-status-tag';
import { AssignmentDialog, StudentOption } from './assignment-dialog';

/** Teacher: one assignment — text, materials and progress of every student. */
@Component({
  selector: 'tb-assignment-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    Button,
    ButtonDirective,
    ButtonIcon,
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
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a pButton routerLink="/teacher/homework" [text]="true" class="tb-back">
      <i pButtonIcon class="pi pi-arrow-left"></i>
      <span pButtonLabel>Все задания</span>
    </a>
    @if (details(); as assignment) {
      <div class="tb-page-header">
        <div>
          <h1 class="tb-page-title">{{ assignment.title }}</h1>
          <span class="tb-muted">
            {{ assignment.dueAt ? 'Срок: ' + (assignment.dueAt | date: 'dd.MM.yyyy HH:mm') : 'Без срока' }}
          </span>
        </div>
        <p-button label="Редактировать" icon="pi pi-pencil" [outlined]="true" (onClick)="editVisible.set(true)" />
      </div>

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
              <p-button label="Загрузить" icon="pi pi-upload" size="small" [loading]="uploading()" (onClick)="upload()" />
            }
          </div>
        </p-card>

        <p-card header="Ученики">
          <p-table [value]="assignment.tasks" dataKey="taskId">
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
                <td>{{ task.studentName }}</td>
                <td><tb-task-status [status]="task.status" [overdue]="task.overdue" [grade]="task.grade" /></td>
                <td>{{ task.submittedAt ? (task.submittedAt | date: 'dd.MM.yyyy HH:mm') : '—' }}</td>
                <td class="tb-actions-column">
                  <a pButton [routerLink]="['/teacher/homework/tasks', task.taskId]" [text]="true" size="small">
                    <span pButtonLabel>{{ task.status === 'SUBMITTED' ? 'Проверить' : 'Открыть' }}</span>
                  </a>
                </td>
              </tr>
            </ng-template>
            <ng-template #emptymessage>
              <tr><td colspan="4" class="tb-empty">Задание ещё никому не выдано</td></tr>
            </ng-template>
          </p-table>
          <div class="tb-inline tb-assign">
            <p-multiselect
              [options]="unassigned()"
              [formControl]="toAssign"
              optionLabel="displayName"
              optionValue="id"
              placeholder="Выдать ещё ученикам"
              [filter]="true"
              display="chip"
              appendTo="body"
              ariaLabel="Выдать ещё ученикам"
              styleClass="tb-grow"
            />
            <p-button label="Выдать" [disabled]="selectedToAssign().length === 0" (onClick)="assign()" />
          </div>
        </p-card>
      </div>

      <tb-assignment-dialog [(visible)]="editVisible" [assignment]="assignment" (saved)="details.set($event)" />
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
  protected readonly newFiles = signal<File[]>([]);
  protected readonly uploading = signal(false);
  private readonly students = signal<StudentOption[]>([]);
  readonly toAssign = new FormControl<string[]>([], { nonNullable: true });
  protected readonly selectedToAssign = toSignal(this.toAssign.valueChanges, { initialValue: this.toAssign.value });
  protected readonly unassigned = computed(() => {
    const assigned = new Set(this.details()?.tasks.map((task) => task.studentId) ?? []);
    return this.students().filter((student) => !assigned.has(student.id));
  });

  ngOnInit(): void {
    this.api.assignment(this.assignmentId()).subscribe((assignment) => {
      this.details.set(assignment);
    });
    this.identity.listStudents().subscribe((students) => {
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, displayName: student.displayName })),
      );
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
    this.confirmation.confirm({
      header: 'Удалить файл?',
      message: `Файл «${file.filename}» будет удалён без возможности восстановления.`,
      acceptLabel: 'Удалить',
      rejectLabel: 'Отмена',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        this.api.removeMaterial(assignment.id, file.id).subscribe(() => {
          this.details.set({
            ...assignment,
            attachments: assignment.attachments.filter((candidate) => candidate.id !== file.id),
          });
        });
      },
    });
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
