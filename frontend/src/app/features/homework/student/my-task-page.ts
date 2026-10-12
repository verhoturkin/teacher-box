import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { FileOpener } from '@shared/files/file-opener';
import { FileSaver } from '@shared/files/file-saver';
import { MarkdownView } from '@shared/ui/markdown-view';
import { HomeworkApi } from '../data-access/homework-api';
import {
  Attachment,
  BoundTextbook,
  InteractiveResult,
  TaskDetails,
} from '../data-access/homework.models';
import { InteractiveFrame } from '../ui/interactive-frame';
import { AttachmentList } from '../ui/attachment-list';
import { TextbookList, boundTextbookFilename } from '../ui/textbook-list';
import { FilePicker } from '../ui/file-picker';
import { SubmissionList } from '../ui/submission-list';
import { TaskStatusTag } from '../ui/task-status-tag';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { Snackbar } from '@core/snackbar/snackbar';
import { pageDetail } from '@core/routing/page-detail';
import { T } from '../i18n/texts';

/**
 * Student: an assignment, the teacher's feedback and handing it in — an answer to written homework, «Готово» to
 * homework on a board or interactive homework (whose page runs here, in a sandbox).
 */
@Component({
  selector: 'tb-my-task-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Card,
    Message,
    Textarea,
    MarkdownView,
    AttachmentList,
    TextbookList,
    FilePicker,
    InteractiveFrame,
    SubmissionList,
    TaskStatusTag,
    LoadStateView,
    PageHeader,
    HelpButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (task(); as task) {
      <tb-page-header [title]="task.assignment.title" back="/cabinet/homework" [backLabel]="t.back">
        <tb-help-button help topic="cabinet/homework" />
        <span meta [class.tb-negative]="task.overdue">
          {{
            task.assignment.dueAt
              ? t.submitUntil((task.assignment.dueAt | date: 'dd.MM.yyyy HH:mm') ?? '')
              : t.noDueDate
          }}
        </span>
        <tb-task-status meta [status]="task.status" [overdue]="task.overdue" [grade]="task.grade" />
      </tb-page-header>

      <div class="tb-stack">
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

        <p-card [header]="t.assignment">
          <tb-markdown [text]="task.assignment.description" />
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
          @if (task.assignment.kind === 'INTERACTIVE') {
            @if (pageUrl(); as url) {
              <tb-interactive-frame
                [url]="url"
                [title]="t.page"
                (result)="pageResult.set($event)"
              />
            } @else if (pageFailed()) {
              <p-message severity="error" styleClass="tb-form-message">{{
                t.pageFailed
              }}</p-message>
            }
          }
        </p-card>

        @if (task.status !== 'ACCEPTED' && task.assignment.kind !== 'WRITTEN') {
          <p-card [header]="t.doneTitle">
            <div class="tb-form">
              <p>{{ task.assignment.kind === 'BOARD' ? t.boardHint : t.interactiveHint }}</p>
              @if (pageResult(); as result) {
                @if (result.score !== null && result.maxScore !== null) {
                  <p class="tb-strong">{{ ui.pageResult(result.score, result.maxScore) }}</p>
                }
              }
              @if (error(); as message) {
                <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
              }
              <div class="tb-form-actions">
                @if (task.assignment.kind === 'BOARD') {
                  <a pButton routerLink="/cabinet/boards" severity="secondary" [outlined]="true">
                    <i pButtonIcon aria-hidden="true" class="pi pi-th-large"></i>
                    <span pButtonLabel>{{ t.openBoards }}</span>
                  </a>
                }
                <p-button
                  severity="success"
                  [label]="t.done"
                  icon="pi pi-check"
                  [loading]="pending()"
                  (onClick)="done()"
                />
              </div>
            </div>
          </p-card>
        } @else if (task.status !== 'ACCEPTED') {
          <p-card [header]="task.submissions.length === 0 ? t.yourAnswer : t.newAnswer">
            <div class="tb-form">
              <div class="tb-field">
                <label for="answer-text">{{ t.answerText }}</label>
                <textarea pTextarea id="answer-text" [formControl]="text" rows="6"></textarea>
              </div>
              <tb-file-picker [(files)]="files" />
              @if (error(); as message) {
                <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
              }
              <div class="tb-form-actions">
                <p-button
                  severity="success"
                  [label]="t.submit"
                  icon="pi pi-send"
                  [loading]="pending()"
                  (onClick)="submit()"
                />
              </div>
            </div>
          </p-card>
        }

        <p-card [header]="t.myAnswers">
          <tb-submission-list [submissions]="task.submissions" (download)="download($event)" />
        </p-card>
      </div>
    } @else {
      <tb-page-header [title]="t.assignment" back="/cabinet/homework" [backLabel]="t.back" />
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()" />
    }
  `,
})
export class MyTaskPage implements OnInit {
  protected readonly t = T.myTask;
  protected readonly ui = T.ui;
  private readonly api = inject(HomeworkApi);
  private readonly snackbar = inject(Snackbar);
  private readonly fileSaver = inject(FileSaver);
  private readonly fileOpener = inject(FileOpener);

  /** Route parameter. */
  readonly taskId = input.required<string>();

  protected readonly task = signal<TaskDetails | null>(null);

  constructor() {
    pageDetail(() => this.task()?.assignment.title);
  }
  readonly text = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(20_000)],
  });
  readonly files = signal<File[]>([]);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly state = new LoadState();
  /** The link to the page of interactive homework; asked for once the task is loaded. */
  protected readonly pageUrl = signal<string | null>(null);
  protected readonly pageFailed = signal(false);
  /** The last result the page reported; goes with «Готово». */
  protected readonly pageResult = signal<InteractiveResult | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .myTask(this.taskId())
      .pipe(this.state.track())
      .subscribe((task) => {
        this.task.set(task);
        if (task.assignment.kind === 'INTERACTIVE') {
          this.loadPage();
        }
      });
  }

  private loadPage(): void {
    this.pageFailed.set(false);
    this.api.myInteractiveLink(this.taskId()).subscribe({
      next: (link) => {
        this.pageUrl.set(link.url);
      },
      error: () => {
        this.pageFailed.set(true);
      },
    });
  }

  /** «Готово» of homework on a board or interactive homework, with the last result of the page. */
  done(): void {
    if (this.pending()) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api.markDone(this.taskId(), this.pageResult()).subscribe({
      next: (task) => {
        this.pending.set(false);
        this.task.set(task);
        this.snackbar.success(T.myTask.doneSent);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, T.myTask.doneFailed));
      },
    });
  }

  submit(): void {
    const text = this.text.value.trim();
    if (text === '' && this.files().length === 0) {
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
        this.text.setValue('');
        this.files.set([]);
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
