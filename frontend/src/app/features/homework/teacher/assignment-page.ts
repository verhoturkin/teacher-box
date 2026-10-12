import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Placed, ToBoardDialog } from '@features/boards/parts';
import { BoardTextbook, TextbookToBoardDialog } from '@features/textbooks/parts';
import { FileSaver } from '@shared/files/file-saver';
import { MarkdownView } from '@shared/ui/markdown-view';
import { HomeworkApi } from '../data-access/homework-api';
import { assignmentBoard } from './assignment-board';
import {
  AssignmentDetails,
  Attachment,
  BoundTextbook,
  TaskSummary,
} from '../data-access/homework.models';
import { AttachmentList } from '../ui/attachment-list';
import { TextbookList } from '../ui/textbook-list';
import { AssignMoreDialog } from './assign-more-dialog';
import { BindTextbookDialog } from './bind-textbook-dialog';
import { FilePicker } from '../ui/file-picker';
import { TaskStatusTag } from '../ui/task-status-tag';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { Snackbar } from '@core/snackbar/snackbar';
import { pageDetail } from '@core/routing/page-detail';
import { Avatar } from '@shared/ui/avatar';
import { T } from '../i18n/texts';

/** Teacher: one assignment — text, materials and progress of every student. */
@Component({
  selector: 'tb-assignment-page',
  imports: [
    Avatar,
    EmptyState,
    RouterLink,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Card,
    ConfirmDialog,
    MarkdownView,
    AttachmentList,
    AssignMoreDialog,
    BindTextbookDialog,
    TextbookList,
    FilePicker,
    TaskStatusTag,
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
          {{ assignment.dueAt ? t.due(date(assignment.dueAt)) : t.noDueDate }}
        </span>
        @if (assignment.boardId; as boardId) {
          <a pButton severity="secondary" [routerLink]="['/teacher/boards', boardId]">
            <i pButtonIcon aria-hidden="true" class="pi pi-arrow-up-right"></i>
            <span pButtonLabel>{{ t.openBoard }}</span>
          </a>
        }
        <p-button
          [label]="t.toBoard"
          icon="pi pi-th-large"
          severity="secondary"
          [disabled]="!hasBoardMaterial()"
          (onClick)="boardVisible.set(true)"
        />
        <a pButton severity="secondary" routerLink="edit">
          <i pButtonIcon aria-hidden="true" class="pi pi-pencil"></i>
          <span pButtonLabel>{{ t.edit }}</span>
        </a>
        <p-button
          [label]="r.action"
          icon="pi pi-trash"
          severity="danger"
          [text]="true"
          (onClick)="confirmDelete(assignment)"
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

        <p-card>
          <ng-template #title>
            <div class="tb-card-title">
              <span class="tb-card-title__text">{{ t.students }}</span>
              <div class="tb-card-title__actions">
                <p-button
                  [label]="t.add"
                  icon="pi pi-plus"
                  severity="secondary"
                  (onClick)="assignMore.open()"
                />
              </div>
            </div>
          </ng-template>
          @if (assignment.tasks.length > 0) {
            <ul class="tb-list" [attr.aria-label]="t.students">
              @for (task of assignment.tasks; track task.taskId) {
                <li>
                  <tb-avatar [name]="task.studentName" [photo]="task.studentAvatar" />
                  <div class="tb-list__text">
                    <a
                      class="tb-list__title tb-link"
                      [routerLink]="['/teacher/homework/tasks', task.taskId]"
                      [attr.aria-label]="
                        t.action(task.status === 'SUBMITTED' ? t.review : t.open, task.studentName)
                      "
                      >{{ task.studentName }}</a
                    >
                    <span class="tb-list__supporting">{{ submitted(task) }}</span>
                  </div>
                  <div class="tb-list__trail tb-list__trail--icons">
                    <tb-task-status
                      [status]="task.status"
                      [overdue]="task.overdue"
                      [grade]="task.grade"
                    />
                  </div>
                </li>
              }
            </ul>
          } @else {
            <tb-empty-state icon="pi-send" [title]="t.notAssigned" />
          }
        </p-card>
      </div>

      <tb-assign-more-dialog
        #assignMore
        [assignmentId]="assignment.id"
        [assigned]="taskStudents()"
        (saved)="assigned($event)"
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
        (placed)="rememberBoard(assignment.id, $event)"
      />
    } @else {
      <tb-page-header [title]="t.assignment" back="/teacher/homework" [backLabel]="t.back" />
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()" />
    }
    <p-confirmdialog />
  `,
})
export class AssignmentPage implements OnInit {
  protected readonly t = T.page;
  protected readonly r = T.remove;
  private readonly api = inject(HomeworkApi);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly snackbar = inject(Snackbar);
  private readonly fileSaver = inject(FileSaver);
  private readonly dates = new DatePipe(inject(LOCALE_ID));

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
  protected readonly boardVisible = signal(false);
  /** A text, a picture or a textbook page to put on a board. */
  protected readonly hasBoardMaterial = computed(() => {
    const assignment = this.details();
    return (
      assignment !== null &&
      (!!assignment.description || assignmentBoard(assignment, new Date()).pictures.length > 0)
    );
  });
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

  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .assignment(this.assignmentId())
      .pipe(this.state.track())
      .subscribe((assignment) => {
        this.details.set(assignment);
      });
  }

  protected date(value: string): string {
    return this.dates.transform(value, 'dd.MM.yyyy HH:mm') ?? '';
  }

  /** «Сдано 12.10.2026 18:00» or «Не сдано». */
  protected submitted(task: TaskSummary): string {
    return task.submittedAt === null
      ? T.page.notSubmitted
      : T.page.submittedAt(this.date(task.submittedAt));
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

  /** Deletes the assignment with the answers and the files, then back to the list. */
  protected confirmDelete(assignment: AssignmentDetails): void {
    this.confirmation.confirm(
      dangerConfirmation({
        header: T.remove.header,
        message: T.remove.message(assignment.title),
        acceptLabel: T.remove.confirm,
        accept: () => {
          this.api.deleteAssignment(assignment.id).subscribe(() => {
            this.snackbar.success(T.remove.deleted(assignment.title));
            void this.router.navigate(['/teacher/homework']);
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

  /** The board the assignment went on: its students get «Перейти на доску». */
  protected rememberBoard(assignmentId: string, placed: Placed): void {
    this.api.placeOnBoard(assignmentId, placed.board.id).subscribe((updated) => {
      this.details.set(updated);
    });
  }

  protected assigned(updated: AssignmentDetails): void {
    this.details.set(updated);
    this.snackbar.success(T.page.assigned);
  }
}
