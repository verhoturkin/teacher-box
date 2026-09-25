import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { FileSaver } from '@shared/files/file-saver';
import { MarkdownView } from '@shared/ui/markdown-view';
import { HomeworkApi } from '../data-access/homework-api';
import { Attachment, ReviewDecision, TaskDetails } from '../data-access/homework.models';
import { AttachmentList } from '../ui/attachment-list';
import { SubmissionList } from '../ui/submission-list';
import { TaskStatusTag } from '../ui/task-status-tag';

/** Teacher: review of one student's work. */
@Component({
  selector: 'tb-task-review-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Card,
    InputText,
    Textarea,
    MarkdownView,
    AttachmentList,
    SubmissionList,
    TaskStatusTag,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (task(); as task) {
      <a pButton [routerLink]="['/teacher/homework', task.assignment.id]" [text]="true" class="tb-back">
        <i pButtonIcon class="pi pi-arrow-left"></i>
        <span pButtonLabel>{{ task.assignment.title }}</span>
      </a>
      <div class="tb-page-header">
        <div>
          <h1 class="tb-page-title">{{ task.studentName }}</h1>
          <tb-task-status [status]="task.status" [overdue]="task.overdue" [grade]="task.grade" />
        </div>
      </div>

      <div class="tb-stack">
        <p-card header="Ответы ученика">
          <tb-submission-list [submissions]="task.submissions" (download)="download($event)" />
        </p-card>

        @if (task.status === 'SUBMITTED' || task.status === 'ACCEPTED') {
          <p-card header="Проверка">
            <form class="tb-form tb-form--narrow" [formGroup]="form">
              <div class="tb-field">
                <label for="review-grade">Оценка</label>
                <input pInputText id="review-grade" formControlName="grade" autocomplete="off" placeholder="например, 5" />
              </div>
              <div class="tb-field">
                <label for="review-comment">Комментарий</label>
                <textarea pTextarea id="review-comment" formControlName="comment" rows="4"></textarea>
              </div>
              <div class="tb-actions">
                @if (task.status === 'SUBMITTED') {
                  <p-button label="Принять" icon="pi pi-check" severity="success" [loading]="pending()" [disabled]="form.invalid" (onClick)="review('ACCEPT')" />
                }
                <p-button label="Вернуть на доработку" icon="pi pi-replay" severity="warn" [outlined]="true" [loading]="pending()" [disabled]="form.invalid" (onClick)="review('RETURN')" />
              </div>
            </form>
          </p-card>
        } @else if (task.teacherComment) {
          <p-card header="Ваш комментарий">
            <p class="tb-pre">{{ task.teacherComment }}</p>
            <small class="tb-muted">{{ task.reviewedAt | date: 'dd.MM.yyyy HH:mm' }}</small>
          </p-card>
        }

        <p-card [header]="'Задание: ' + task.assignment.title">
          <tb-markdown [text]="task.assignment.description" />
          <tb-attachment-list [attachments]="task.assignment.attachments" (download)="download($event)" />
        </p-card>
      </div>
    }
  `,
})
export class TaskReviewPage implements OnInit {
  private readonly api = inject(HomeworkApi);
  private readonly messages = inject(MessageService);
  private readonly fileSaver = inject(FileSaver);

  /** Route parameter. */
  readonly taskId = input.required<string>();

  protected readonly task = signal<TaskDetails | null>(null);
  protected readonly pending = signal(false);
  readonly form = new FormGroup({
    grade: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    comment: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(5000)] }),
  });

  ngOnInit(): void {
    this.api.task(this.taskId()).subscribe((task) => {
      this.show(task);
    });
  }

  protected review(decision: ReviewDecision): void {
    const task = this.task();
    if (task === null || this.form.invalid || this.pending()) {
      return;
    }
    const { grade, comment } = this.form.getRawValue();
    this.pending.set(true);
    this.api
      .review(task.taskId, decision, grade.trim() === '' ? null : grade.trim(), comment.trim() === '' ? null : comment)
      .subscribe({
        next: (reviewed) => {
          this.pending.set(false);
          this.show(reviewed);
          this.messages.add({
            severity: 'success',
            summary: 'Готово',
            detail: decision === 'ACCEPT' ? 'Работа принята' : 'Работа возвращена на доработку',
          });
        },
        error: () => {
          this.pending.set(false);
        },
      });
  }

  protected download(file: Attachment): void {
    this.api.teacherFile(file.id).subscribe((blob) => {
      this.fileSaver.save(blob, file.filename);
    });
  }

  private show(task: TaskDetails): void {
    this.task.set(task);
    this.form.reset({ grade: task.grade ?? '', comment: task.teacherComment ?? '' });
  }
}
