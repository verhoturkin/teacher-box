import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { FileSaver } from '@shared/files/file-saver';
import { MarkdownView } from '@shared/ui/markdown-view';
import { HomeworkApi } from '../data-access/homework-api';
import { Attachment, TaskDetails } from '../data-access/homework.models';
import { AttachmentList } from '../ui/attachment-list';
import { FilePicker } from '../ui/file-picker';
import { SubmissionList } from '../ui/submission-list';
import { TaskStatusTag } from '../ui/task-status-tag';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { Snackbar } from '@core/snackbar/snackbar';
import { pageDetail } from '@core/routing/page-detail';

/** Student: an assignment, the teacher's feedback and handing in an answer. */
@Component({
  selector: 'tb-my-task-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    Button,
    Card,
    Message,
    Textarea,
    MarkdownView,
    AttachmentList,
    FilePicker,
    SubmissionList,
    TaskStatusTag,
    LoadStateView,
    PageHeader,
    HelpButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (task(); as task) {
      <tb-page-header [title]="task.assignment.title" back="/cabinet/homework" backLabel="Задания">
        <tb-help-button help topic="cabinet/homework" />
        <span meta [class.tb-negative]="task.overdue">
          {{
            task.assignment.dueAt
              ? 'Сдать до ' + (task.assignment.dueAt | date: 'dd.MM.yyyy HH:mm')
              : 'Без срока'
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
                {{ task.status === 'ACCEPTED' ? 'Работа принята' : 'Нужно доработать' }}
              </div>
              <p class="tb-pre">{{ task.teacherComment }}</p>
            </div>
          </p-message>
        }

        <p-card header="Задание">
          <tb-markdown [text]="task.assignment.description" />
          <tb-attachment-list
            [attachments]="task.assignment.attachments"
            (download)="download($event)"
          />
        </p-card>

        @if (task.status !== 'ACCEPTED') {
          <p-card [header]="task.submissions.length === 0 ? 'Ваш ответ' : 'Новый ответ'">
            <div class="tb-form">
              <div class="tb-field">
                <label for="answer-text">Текст ответа</label>
                <textarea pTextarea id="answer-text" [formControl]="text" rows="6"></textarea>
              </div>
              <tb-file-picker [(files)]="files" />
              @if (error(); as message) {
                <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
              }
              <div class="tb-form-actions">
                <p-button
                  severity="success"
                  label="Отправить на проверку"
                  icon="pi pi-send"
                  [loading]="pending()"
                  (onClick)="submit()"
                />
              </div>
            </div>
          </p-card>
        }

        <p-card header="Мои ответы">
          <tb-submission-list [submissions]="task.submissions" (download)="download($event)" />
        </p-card>
      </div>
    } @else {
      <tb-page-header title="Задание" back="/cabinet/homework" backLabel="Задания" />
      <tb-load-state [state]="state" what="задание" (retry)="load()" />
    }
  `,
})
export class MyTaskPage implements OnInit {
  private readonly api = inject(HomeworkApi);
  private readonly snackbar = inject(Snackbar);
  private readonly fileSaver = inject(FileSaver);

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

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .myTask(this.taskId())
      .pipe(this.state.track())
      .subscribe((task) => {
        this.task.set(task);
      });
  }

  submit(): void {
    const text = this.text.value.trim();
    if (text === '' && this.files().length === 0) {
      this.error.set('Напишите ответ или прикрепите файл');
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
        this.snackbar.success('Ответ отправлен учителю');
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, 'Не удалось отправить ответ'));
      },
    });
  }

  protected download(file: Attachment): void {
    this.api.myFile(file.id).subscribe((blob) => {
      this.fileSaver.save(blob, file.filename);
    });
  }
}
