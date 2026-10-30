import { PaneHeader } from '@shared/ui/panes';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { FileOpener } from '@shared/files/file-opener';
import { FileSaver } from '@shared/files/file-saver';
import { MarkdownView } from '@shared/ui/markdown-view';
import { HomeworkApi } from '../data-access/homework-api';
import { Attachment, BoundTextbook, TaskDetails } from '../data-access/homework.models';
import { AttachmentList } from '../ui/attachment-list';
import { TextbookList, boundTextbookFilename } from '../ui/textbook-list';
import { VideoList } from '../ui/video-list';
import { FilePicker } from '../ui/file-picker';
import { AssistChip } from '@shared/ui/assist-chip';
import { injectMobile } from '@core/layout/mobile';
import { SubmissionList } from '../ui/submission-list';
import { TaskStatusTag } from '../ui/task-status-tag';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { MyBoardButton } from '@features/boards/parts';
import { HelpButton } from '@features/help/parts';
import { Snackbar } from '@core/snackbar/snackbar';
import { pageDetail } from '@core/routing/page-detail';
import {
  readDeviceSetting,
  removeDeviceSetting,
  writeDeviceSetting,
} from '@shared/storage/device-settings';
import { T } from '../i18n/texts';
import { QuizSection } from './quiz-section';

/**
 * Student: the detail pane of the homework list-detail (redesign spec §9) — an assignment, the teacher's feedback
 * and handing in an answer, blocks on the pane's surface under labels; «Перейти на доску» when the teacher put
 * the assignment on one of the student's boards. On one pane the header has «back» to the list.
 */
@Component({
  selector: 'tb-my-task-page',
  imports: [
    PaneHeader,
    VideoList,
    DatePipe,
    ReactiveFormsModule,
    Button,
    Message,
    Textarea,
    MarkdownView,
    AttachmentList,
    TextbookList,
    FilePicker,
    AssistChip,
    SubmissionList,
    TaskStatusTag,
    LoadStateView,
    PageHeader,
    HelpButton,
    MyBoardButton,
    QuizSection,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (task(); as task) {
      <ng-template tbPaneHeader
        ><tb-page-header
          [title]="task.assignment.title"
          [back]="single() ? '/cabinet/homework' : null"
          [backLabel]="t.back"
        >
          <tb-help-button help topic="cabinet/homework" />
          <span meta [class.tb-negative]="task.overdue">
            {{
              task.assignment.dueAt
                ? t.submitUntil((task.assignment.dueAt | date: 'dd.MM.yyyy HH:mm') ?? '')
                : t.noDueDate
            }}
          </span>
          <tb-task-status
            meta
            [status]="task.status"
            [overdue]="task.overdue"
            [grade]="task.grade"
          />
          @if (task.assignment.boardId; as boardId) {
            <tb-my-board-button [boardId]="boardId" />
          }</tb-page-header
      ></ng-template>

      <div class="tb-task">
        <div class="tb-task__main">
          @if (task.teacherComment && (task.status === 'RETURNED' || task.status === 'ACCEPTED')) {
            <p-message
              [severity]="task.status === 'ACCEPTED' ? 'success' : 'warn'"
              styleClass="tb-form-message"
            >
              <div>
                <div class="tb-strong">
                  {{ task.status === 'ACCEPTED' ? t.accepted : t.rework }}
                </div>
                <p class="tb-pre">{{ task.teacherComment }}</p>
              </div>
            </p-message>
          }

          <section>
            <h2 class="tb-task__label">{{ t.assignment }}</h2>
            <tb-markdown [text]="task.assignment.description" />
            @if (task.assignment.videos.length > 0) {
              <h3 class="tb-subtitle">{{ tv.title }}</h3>
              <tb-video-list [videos]="task.assignment.videos" />
            }
          </section>

          @if (task.status !== 'ACCEPTED') {
            <section
              class="tb-task__answer"
              [class.tb-task__answer--docked]="mobile()"
              [attr.aria-label]="t.myAnswer"
            >
              <div class="tb-task__answer-head">
                <h2 class="tb-task__answer-title">{{ t.myAnswer }}</h2>
                @if (draftSaved()) {
                  <span class="tb-task__muted">{{ t.draftSaved }}</span>
                }
              </div>
              <textarea
                pTextarea
                id="answer-text"
                [formControl]="text"
                [rows]="mobile() ? 2 : 5"
                [placeholder]="t.answerText"
                [attr.aria-label]="t.answerText"
              ></textarea>
              <tb-file-picker #filePicker [(files)]="files" [button]="false" />
              <tb-file-picker
                #photoPicker
                [(files)]="files"
                [button]="false"
                [list]="false"
                [capture]="true"
              />
              @if (error(); as message) {
                <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
              }
              <div class="tb-task__actions">
                <tb-assist-chip icon="photo_camera" (click)="photoPicker.choose()">
                  {{ t.photo }}
                </tb-assist-chip>
                <tb-assist-chip icon="attach_file" (click)="filePicker.choose()">
                  {{ t.file }}
                </tb-assist-chip>
                <span class="tb-task__spacer"></span>
                <p-button
                  [label]="t.submit"
                  icon="tb-i tb-i-send"
                  [loading]="pending()"
                  (onClick)="submit()"
                />
              </div>
            </section>
          }

          <section>
            <h2 class="tb-task__label">{{ t.myAnswers }}</h2>
            <tb-submission-list [submissions]="task.submissions" (download)="download($event)" />
          </section>
        </div>

        <aside class="tb-task__side">
          @if (task.assignment.attachments.length > 0 || task.assignment.textbooks.length > 0) {
            <section>
              <h2 class="tb-task__label">{{ t.materials }}</h2>
              <tb-attachment-list
                [attachments]="task.assignment.attachments"
                (download)="download($event)"
              />
              @if (task.assignment.textbooks.length > 0) {
                <h3 class="tb-subtitle">{{ t.textbooks }}</h3>
                <tb-textbook-list
                  [textbooks]="task.assignment.textbooks"
                  [downloadable]="true"
                  (opened)="openTextbook(task.taskId, $event)"
                  (download)="downloadTextbook(task.taskId, $event)"
                />
              }
            </section>
          }
          <tb-quiz-section [taskId]="task.taskId" />
        </aside>
      </div>
    } @else {
      <ng-template tbPaneHeader
        ><tb-page-header
          [title]="t.assignment"
          [back]="single() ? '/cabinet/homework' : null"
          [backLabel]="t.back"
      /></ng-template>
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()" />
    }
  `,
  styles: `
    /* a label over a block on the pane's surface (M3 label medium, as the teacher's assignment) */
    .tb-task__label {
      margin: 0 0 var(--tb-space-2);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    /* the task and the answer, the materials and the test beside; below on a narrow pane */
    .tb-task {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-6);
      align-items: flex-start;
    }

    .tb-task__main {
      display: flex;
      flex: 999 1 24rem;
      flex-direction: column;
      gap: var(--tb-space-4);
      min-inline-size: 0;
    }

    .tb-task__side {
      display: flex;
      flex: 1 1 16rem;
      flex-direction: column;
      gap: var(--tb-space-4);
      max-inline-size: 22rem;
    }

    .tb-task__answer {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      padding: var(--tb-space-4);
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-lowest);
    }

    /* a phone: the answer stays at the bottom of the pane while the task scrolls */
    .tb-task__answer--docked {
      position: sticky;
      inset-block-end: 0;
      z-index: 1;
      background: var(--p-md-surface-container);
    }

    .tb-task__answer-head,
    .tb-task__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
      align-items: center;
      justify-content: space-between;
    }

    .tb-task__answer-title {
      margin: 0;
      font: var(--tb-type-title-m);
    }

    .tb-task__muted {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
    }

    .tb-task__spacer {
      flex: 1;
    }
  `,
})
export class MyTaskPage {
  protected readonly t = T.myTask;
  protected readonly tv = T.videos;
  private readonly api = inject(HomeworkApi);
  private readonly snackbar = inject(Snackbar);
  private readonly fileSaver = inject(FileSaver);
  private readonly fileOpener = inject(FileOpener);

  /** Route parameter. */
  readonly taskId = input.required<string>();
  /** One pane at a time: the header has «back» to the list. */
  readonly single = input(false);
  /** The answer was handed in: the list reads the status again. */
  readonly changed = output<TaskDetails>();

  protected readonly task = signal<TaskDetails | null>(null);

  constructor() {
    pageDetail(() => this.task()?.assignment.title);
    this.text.valueChanges.subscribe((value) => {
      if (this.task() === null) {
        return;
      }
      if (value.trim() === '') {
        removeDeviceSetting(this.draftKey());
      } else {
        writeDeviceSetting(this.draftKey(), value);
      }
      this.draftSaved.set(value.trim() !== '');
    });
    // another work opens beside the list: its own answer form and its own load
    effect(() => {
      this.taskId();
      untracked(() => {
        this.task.set(null);
        this.text.reset();
        this.files.set([]);
        this.error.set(null);
        this.draftSaved.set(false);
        this.load();
      });
    });
  }
  /** The text of an unsent answer lives on this device, per task (so per student and assignment): see homework.md. */
  private draftKey(): string {
    return `tb.homework.draft.${this.taskId()}`;
  }
  protected readonly draftSaved = signal(false);
  protected readonly mobile = injectMobile();
  readonly text = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(20_000)],
  });
  readonly files = signal<File[]>([]);
  private readonly quiz = viewChild(QuizSection);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly state = new LoadState();

  private restoreDraft(task: TaskDetails): void {
    const draft = task.status === 'ACCEPTED' ? null : readDeviceSetting(this.draftKey());
    if (draft) {
      this.text.setValue(draft);
      this.draftSaved.set(true);
    }
  }

  protected load(): void {
    this.api
      .myTask(this.taskId())
      .pipe(this.state.track())
      .subscribe((task) => {
        this.task.set(task);
        this.restoreDraft(task);
      });
  }

  async submit(): Promise<void> {
    const text = this.text.value.trim();
    // a quiz alone is an answer: «Сдать» hands in the open attempt too
    const quiz = this.quiz();
    if (quiz?.started()) {
      await quiz.flush();
    }
    if (text === '' && this.files().length === 0 && !quiz?.started()) {
      this.error.set(T.myTask.empty);
      return;
    }
    if (this.pending()) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api.submit(this.taskId(), text === '' ? null : text, this.files()).subscribe({
      next: (task) => {
        this.pending.set(false);
        this.task.set(task);
        removeDeviceSetting(this.draftKey());
        this.draftSaved.set(false);
        this.text.setValue('');
        this.files.set([]);
        this.quiz()?.reload();
        this.changed.emit(task);
        this.snackbar.success(T.myTask.sent);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, T.myTask.failed));
      },
    });
  }

  /** The bound pages of a PDF or a picture open in a new tab; a Word file is saved. */
  protected openTextbook(taskId: string, textbook: BoundTextbook): void {
    this.fileOpener.open(
      this.api.myTextbook(taskId, textbook.textbookId),
      textbook.format !== 'DOCUMENT',
      (blob) => boundTextbookFilename(textbook, blob.type),
    );
  }

  protected downloadTextbook(taskId: string, textbook: BoundTextbook): void {
    this.api.myTextbook(taskId, textbook.textbookId).subscribe((blob) => {
      this.fileSaver.save(blob, boundTextbookFilename(textbook, blob.type));
    });
  }

  protected download(file: Attachment): void {
    this.api.myFile(file.id).subscribe((blob) => {
      this.fileSaver.save(blob, file.filename);
    });
  }
}
