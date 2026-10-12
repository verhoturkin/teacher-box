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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { AiApi } from '@features/ai/parts';
import { ToBoardDialog } from '@features/boards/parts';
import { FileSaver } from '@shared/files/file-saver';
import { MarkdownView } from '@shared/ui/markdown-view';
import { HomeworkApi } from '../data-access/homework-api';
import { Attachment, ReviewDecision, TaskDetails } from '../data-access/homework.models';
import { AttachmentList } from '../ui/attachment-list';
import { SubmissionList } from '../ui/submission-list';
import { TaskStatusTag } from '../ui/task-status-tag';
import { ASSIGNMENT_KIND_LABELS } from '../homework-labels';
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { Snackbar } from '@core/snackbar/snackbar';
import { pageDetail } from '@core/routing/page-detail';
import { T } from '../i18n/texts';

/** Teacher: review of one student's work. */
@Component({
  selector: 'tb-task-review-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    Button,
    Card,
    InputText,
    Message,
    Textarea,
    MarkdownView,
    AttachmentList,
    SubmissionList,
    TaskStatusTag,
    ToBoardDialog,
    PageHeader,
    HelpButton,
    LoadStateView,
    FieldErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (task(); as task) {
      <tb-page-header
        [title]="task.studentName"
        [back]="['/teacher/homework', task.assignment.id]"
        [backLabel]="task.assignment.title"
      >
        <tb-help-button help topic="teacher/homework" />
        @if (task.assignment.kind !== 'WRITTEN') {
          <span meta>{{ kinds[task.assignment.kind] }}</span>
        }
        <tb-task-status meta [status]="task.status" [overdue]="task.overdue" [grade]="task.grade" />
      </tb-page-header>

      <div class="tb-stack">
        <p-card [header]="t.answers">
          <tb-submission-list [submissions]="task.submissions" (download)="download($event)" />
        </p-card>

        @if (task.status === 'SUBMITTED' || task.status === 'ACCEPTED') {
          <p-card [header]="t.review">
            <form tbFieldErrors class="tb-form tb-form--narrow" [formGroup]="form">
              @if (aiEnabled() && task.status === 'SUBMITTED' && latestAnswer(task) !== null) {
                <div>
                  <p-button
                    [label]="t.draft"
                    icon="pi pi-sparkles"
                    severity="secondary"
                    [loading]="drafting()"
                    (onClick)="draftReview(task)"
                  />
                </div>
              }
              @if (suggestion(); as decision) {
                <p-message severity="info" styleClass="tb-form-message">
                  {{ decision === 'ACCEPT' ? t.suggestsAccept : t.suggestsReturn }}
                </p-message>
              }
              <div class="tb-field">
                <label for="review-grade">{{ t.grade }}</label>
                <input
                  pInputText
                  id="review-grade"
                  formControlName="grade"
                  autocomplete="off"
                  [placeholder]="t.gradePlaceholder"
                />
              </div>
              <div class="tb-field">
                <label for="review-comment">{{ t.comment }}</label>
                <textarea
                  pTextarea
                  id="review-comment"
                  formControlName="comment"
                  rows="4"
                ></textarea>
              </div>
              <div class="tb-form-actions">
                @if (task.status === 'SUBMITTED') {
                  <p-button
                    severity="success"
                    [label]="t.accept"
                    icon="pi pi-check"
                    [loading]="pending()"
                    (onClick)="review('ACCEPT')"
                  />
                }
                <p-button
                  class="tb-tonal"
                  [label]="t.return"
                  icon="pi pi-replay"
                  severity="danger"
                  [loading]="pending()"
                  (onClick)="review('RETURN')"
                />
                <p-button
                  [label]="t.toBoard"
                  icon="pi pi-th-large"
                  [text]="true"
                  [disabled]="commentValue().trim() === ''"
                  (onClick)="boardVisible.set(true)"
                />
              </div>
            </form>
          </p-card>
        } @else if (task.teacherComment) {
          <p-card [header]="t.yourComment">
            <p class="tb-pre">{{ task.teacherComment }}</p>
            <small class="tb-muted">{{ task.reviewedAt | date: 'dd.MM.yyyy HH:mm' }}</small>
          </p-card>
        }

        <p-card [header]="t.assignment(task.assignment.title)">
          <tb-markdown [text]="task.assignment.description" />
          <tb-attachment-list
            [attachments]="task.assignment.attachments"
            (download)="download($event)"
          />
        </p-card>
      </div>
      <tb-to-board-dialog
        [(visible)]="boardVisible"
        [title]="t.boardTitle(task.assignment.title)"
        [markdown]="reviewText()"
        [students]="[task.studentId]"
      />
    } @else {
      <tb-page-header [title]="t.title" back="/teacher/homework/review" [backLabel]="t.back" />
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()" />
    }
  `,
})
export class TaskReviewPage implements OnInit {
  protected readonly t = T.review;
  protected readonly kinds = ASSIGNMENT_KIND_LABELS;
  private readonly api = inject(HomeworkApi);
  private readonly snackbar = inject(Snackbar);
  private readonly fileSaver = inject(FileSaver);
  private readonly ai = inject(AiApi);

  /** Route parameter. */
  readonly taskId = input.required<string>();

  protected readonly task = signal<TaskDetails | null>(null);

  constructor() {
    pageDetail(() => this.task()?.studentName);
  }
  protected readonly pending = signal(false);
  protected readonly aiEnabled = toSignal(this.ai.enabled$, { initialValue: false });
  protected readonly drafting = signal(false);
  protected readonly suggestion = signal<ReviewDecision | null>(null);
  readonly form = new FormGroup({
    grade: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    comment: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(5000)] }),
  });

  protected readonly boardVisible = signal(false);
  protected readonly commentValue = toSignal(this.form.controls.comment.valueChanges, {
    initialValue: '',
  });
  private readonly gradeValue = toSignal(this.form.controls.grade.valueChanges, {
    initialValue: '',
  });
  /** The review for a board: the grade and the comment. */
  protected readonly reviewText = computed(() => {
    const grade = this.gradeValue().trim();
    return grade === ''
      ? this.commentValue()
      : `${T.review.gradeLine(grade)}\n\n${this.commentValue()}`;
  });

  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .task(this.taskId())
      .pipe(this.state.track())
      .subscribe((task) => {
        this.show(task);
      });
  }

  protected review(decision: ReviewDecision): void {
    const task = this.task();
    if (task === null || !revealErrors(this.form) || this.pending()) {
      return;
    }
    const { grade, comment } = this.form.getRawValue();
    this.pending.set(true);
    this.api
      .review(
        task.taskId,
        decision,
        grade.trim() === '' ? null : grade.trim(),
        comment.trim() === '' ? null : comment,
      )
      .subscribe({
        next: (reviewed) => {
          this.pending.set(false);
          this.show(reviewed);
          this.snackbar.success(decision === 'ACCEPT' ? T.review.accepted : T.review.returned);
        },
        error: () => {
          this.pending.set(false);
        },
      });
  }

  /** Text of the latest submission that has one (only text is sent to the AI, files are not). */
  protected latestAnswer(task: TaskDetails): string | null {
    const answer = task.submissions.find((submission) => (submission.text ?? '').trim() !== '');
    return answer?.text ?? null;
  }

  protected draftReview(task: TaskDetails): void {
    const answer = this.latestAnswer(task);
    if (answer === null || this.drafting()) {
      return;
    }
    this.drafting.set(true);
    this.ai
      .reviewDraft({
        title: task.assignment.title,
        description: task.assignment.description,
        answer,
      })
      .subscribe({
        next: (draft) => {
          this.drafting.set(false);
          this.form.patchValue({ grade: draft.grade ?? '', comment: draft.comment });
          this.suggestion.set(draft.accept ? 'ACCEPT' : 'RETURN');
        },
        error: () => {
          this.drafting.set(false);
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
    this.suggestion.set(null);
    this.form.reset({ grade: task.grade ?? '', comment: task.teacherComment ?? '' });
  }
}
