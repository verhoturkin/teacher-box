import { PaneHeader } from '@shared/ui/panes';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
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
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { Snackbar } from '@core/snackbar/snackbar';
import { pageDetail } from '@core/routing/page-detail';
import { T } from '../i18n/texts';
import { MaterialOpener } from './material-opener';

/** Teacher: review of one student's work. */
@Component({
  selector: 'tb-task-review-page',
  imports: [
    PaneHeader,
    DatePipe,
    ReactiveFormsModule,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    RouterLink,
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
      <ng-template tbPaneHeader
        ><tb-page-header
          [title]="task.assignment.title"
          [back]="single() ? '/teacher/homework' : null"
          [backLabel]="t.back"
        >
          <tb-help-button help topic="teacher/homework" />
          <span meta class="tb-task__meta">
            {{ task.studentName }} ·
            {{ task.assignment.dueAt ? t.due(date(task.assignment.dueAt)) : noDueDate }}
            <tb-task-status [status]="task.status" [overdue]="task.overdue" [grade]="task.grade" />
            · {{ t.attempt(task.submissions.length) }}
          </span>
          @if (task.assignment.boardId; as boardId) {
            <a pButton severity="secondary" [routerLink]="['/teacher/boards', boardId]">
              <i pButtonIcon aria-hidden="true" class="tb-i tb-i-arrow_outward"></i>
              <span pButtonLabel>{{ t.openBoard }}</span>
            </a>
          }
        </tb-page-header></ng-template
      >

      <div class="tb-stack" [class.tb-task__room]="toolbar()">
        <section class="tb-task__statement" [class.tb-task__statement--open]="statementOpen()">
          <button
            type="button"
            class="tb-task__statement-head"
            [attr.aria-expanded]="statementOpen()"
            (click)="statementOpen.set(!statementOpen())"
          >
            <i class="tb-i tb-i-draft" aria-hidden="true"></i>
            <span class="tb-task__statement-title">
              <span class="tb-task__label">{{ t.statement }}</span>
              @if (!statementOpen()) {
                <span class="tb-task__preview">{{ preview(task) }}</span>
              }
            </span>
            <i class="tb-i tb-i-expand_more tb-task__chevron" aria-hidden="true"></i>
          </button>
          @if (statementOpen()) {
            <div class="tb-task__statement-body">
              <tb-markdown [text]="task.assignment.description" />
              <tb-attachment-list
                [attachments]="task.assignment.attachments"
                [openable]="true"
                (opened)="materials.file($event)"
                (download)="download($event)"
              />
            </div>
          }
        </section>

        <section>
          <h2 class="tb-task__label">{{ t.answer }}</h2>
          <tb-submission-list [submissions]="task.submissions" (download)="download($event)" />
        </section>

        @if (sheet() && (task.status === 'SUBMITTED' || task.status === 'ACCEPTED')) {
          <!-- the review is in the side sheet beside the work (extra-large) -->
        } @else if (task.status === 'SUBMITTED' || task.status === 'ACCEPTED') {
          <section>
            <h2 class="tb-task__label">{{ t.review }}</h2>
            <form tbFieldErrors class="tb-form" [formGroup]="form">
              @if (aiEnabled() && task.status === 'SUBMITTED' && latestAnswer(task) !== null) {
                <div>
                  <p-button
                    [label]="t.draft"
                    icon="tb-i tb-i-auto_awesome"
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
                  rows="8"
                ></textarea>
              </div>
              <div class="tb-form-actions">
                @if (task.status === 'SUBMITTED') {
                  <p-button
                    [label]="t.accept"
                    icon="tb-i tb-i-check"
                    [loading]="pending()"
                    (onClick)="review('ACCEPT')"
                  />
                }
                <p-button
                  [label]="t.return"
                  icon="tb-i tb-i-replay"
                  severity="secondary"
                  [loading]="pending()"
                  (onClick)="review('RETURN')"
                />
                <p-button
                  [label]="t.toBoard"
                  icon="tb-i tb-i-co_present"
                  [text]="true"
                  [disabled]="commentValue().trim() === ''"
                  (onClick)="boardVisible.set(true)"
                />
              </div>
            </form>
          </section>
        } @else if (task.teacherComment) {
          <section>
            <h2 class="tb-task__label">{{ t.yourComment }}</h2>
            <p class="tb-pre">{{ task.teacherComment }}</p>
            <small class="tb-muted">{{ task.reviewedAt | date: 'dd.MM.yyyy HH:mm' }}</small>
          </section>
        }
      </div>
      <tb-to-board-dialog
        [(visible)]="boardVisible"
        [title]="t.boardTitle(task.assignment.title)"
        [markdown]="reviewText()"
        [students]="[task.studentId]"
      />
    } @else {
      <ng-template tbPaneHeader
        ><tb-page-header
          [title]="t.title"
          [back]="single() ? '/teacher/homework' : null"
          [backLabel]="t.back"
      /></ng-template>
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()" />
    }
  `,
  styles: `
    /* a label over a block on the pane's surface (M3 label medium, as «Ждут сдачи» in the list) */
    .tb-task__label {
      margin: 0 0 var(--tb-space-2);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    /* the floating toolbar: 64 dp and the 16 dp margins under it, and the same over it */
    .tb-task__room {
      padding-block-end: calc(5rem + var(--tb-space-4) + env(safe-area-inset-bottom));
    }

    .tb-task__meta {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-1) var(--tb-space-2);
    }

    /* the statement: a tonal block, collapsed to its first line (our decision: the sketch's «Задание») */
    .tb-task__statement {
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container);
    }

    .tb-task__statement-head {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      inline-size: 100%;
      padding: var(--tb-space-3) var(--tb-space-4);
      border: 0;
      border-radius: inherit;
      background: none;
      color: var(--p-md-on-surface);
      font: inherit;
      text-align: start;
      cursor: pointer;
    }

    .tb-task__statement-head:focus-visible {
      outline: 3px solid var(--p-md-secondary);
      outline-offset: -3px;
    }

    .tb-task__statement-title {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-inline-size: 0;
    }

    .tb-task__statement-title .tb-task__label {
      margin: 0;
    }

    .tb-task__preview {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tb-task__chevron {
      transition: rotate 200ms;
    }

    .tb-task__statement--open .tb-task__chevron {
      rotate: 180deg;
    }

    .tb-task__statement-body {
      padding: 0 var(--tb-space-4) var(--tb-space-4);
    }
  `,
})
export class TaskReviewPage {
  protected readonly t = T.review;
  private readonly api = inject(HomeworkApi);
  private readonly snackbar = inject(Snackbar);
  private readonly fileSaver = inject(FileSaver);
  private readonly ai = inject(AiApi);
  private readonly dates = new DatePipe(inject(LOCALE_ID));
  protected readonly materials = inject(MaterialOpener);

  /** Route parameter. */
  readonly taskId = input.required<string>();
  /** One pane at a time: the header has «back» to the list. */
  readonly single = input(false);
  /** The review is in the side sheet beside the work (extra-large): the page shows no form. */
  readonly sheet = input(false);
  /** A phone's floating toolbar lies over the foot of the page: it leaves room for it. */
  readonly toolbar = input(false);
  /** The work as the sheet changed it (a decision): the page shows it. */
  readonly update = input<TaskDetails | null>(null);
  /** The work was reviewed: the list beside it changes. */
  readonly changed = output();
  /** The work is read (or changed): the side sheet reviews it. */
  readonly loaded = output<TaskDetails>();
  protected readonly statementOpen = signal(false);
  protected readonly noDueDate = T.noDueDate;

  protected readonly task = signal<TaskDetails | null>(null);

  constructor() {
    pageDetail(() => this.task()?.studentName);
    // the page stays when the list opens another work
    effect(() => {
      this.taskId();
      untracked(() => {
        this.task.set(null);
        this.load();
      });
    });
    effect(() => {
      const update = this.update();
      untracked(() => {
        if (update !== null && update.taskId === this.taskId()) {
          this.show(update);
        }
      });
    });
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
          this.changed.emit();
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

  protected date(value: string): string {
    return this.dates.transform(value, 'dd.MM.yyyy HH:mm') ?? '';
  }

  /** The first line of the statement under «Задание» while it is collapsed. */
  protected preview(task: TaskDetails): string {
    const text = (task.assignment.description ?? '').replace(/[#*_`>-]/g, '').trim();
    return text.split('\n')[0] ?? '';
  }

  private show(task: TaskDetails): void {
    this.task.set(task);
    this.loaded.emit(task);
    this.suggestion.set(null);
    this.form.reset({ grade: task.grade ?? '', comment: task.teacherComment ?? '' });
  }
}
