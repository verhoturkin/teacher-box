import { PaneHeader } from '@shared/ui/panes';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  inject,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { FileSaver } from '@shared/files/file-saver';
import { MarkdownView } from '@shared/ui/markdown-view';
import { HomeworkApi } from '../data-access/homework-api';
import { Attachment, TaskDetails } from '../data-access/homework.models';
import { handedIn } from '../homework-labels';
import { AttachmentList } from '../ui/attachment-list';
import { SubmissionList } from '../ui/submission-list';
import { TaskStatusTag } from '../ui/task-status-tag';
import { PageHeader } from '@shared/ui/page-header';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { pageDetail } from '@core/routing/page-detail';
import { injectMobile } from '@core/layout/mobile';
import { T } from '../i18n/texts';
import { MaterialOpener } from './material-opener';
import { QuizReviewBlock } from './quiz-review';
import { NextWork, ReviewSheet } from './review-sheet';

/**
 * Teacher: review of one student's work (sketches 14, 15, 16). The header names the student, «<assignment> ·
 * сдано сегодня, 09:12 · вовремя», the place in the queue («1 из 2 на проверке») with the previous and the
 * next work; then the collapsed statement, the answer and the quiz as tonal blocks. The review form is the
 * side sheet beside the page (`sheet`, from large; a phone's toolbar) or lies under the answer.
 */
@Component({
  selector: 'tb-task-review-page',
  imports: [
    PaneHeader,
    DatePipe,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    RouterLink,
    Tooltip,
    MarkdownView,
    AttachmentList,
    SubmissionList,
    QuizReviewBlock,
    ReviewSheet,
    TaskStatusTag,
    PageHeader,
    LoadStateView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (task(); as task) {
      <ng-template tbPaneHeader
        ><tb-page-header
          class="tb-page-header--one-line"
          [title]="task.studentName"
          [back]="single() ? back() : null"
          [backLabel]="t.back"
        >
          @if (mobile()) {
            <!-- a phone (sketch 16): «1 из 2 на проверке» under the name, the line of the work under the header -->
            @if (total() > 0 && place() > 0) {
              <span meta>{{ t.position(place(), total()) }}</span>
            }
          } @else {
            <span meta class="tb-task__meta">
              {{ meta(task) }}
              @if (task.status !== 'SUBMITTED') {
                <tb-task-status inline [status]="task.status" [grade]="task.grade" />
              }
            </span>
          }
          @if (total() > 0 && place() > 0) {
            @if (!mobile()) {
              <span class="tb-task__place">{{ t.position(place(), total()) }}</span>
              <button
                pButton
                type="button"
                [text]="true"
                [rounded]="true"
                severity="secondary"
                [disabled]="previous() === null"
                [attr.aria-label]="t.previousWork"
                [pTooltip]="t.previousWork"
                (click)="openPrevious()"
              >
                <i pButtonIcon class="tb-i tb-i-chevron_left" aria-hidden="true"></i>
              </button>
            }
            <button
              pButton
              type="button"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [disabled]="next() === null"
              [attr.aria-label]="t.nextWork"
              [pTooltip]="t.nextWork"
              (click)="openNext()"
            >
              <i pButtonIcon class="tb-i tb-i-chevron_right" aria-hidden="true"></i>
            </button>
          }
          @if (task.assignment.boardId; as boardId) {
            <a pButton severity="secondary" [routerLink]="['/teacher/boards', boardId]">
              <i pButtonIcon aria-hidden="true" class="tb-i tb-i-arrow_outward"></i>
              <span pButtonLabel>{{ t.openBoard }}</span>
            </a>
          }
        </tb-page-header></ng-template
      >

      <div class="tb-stack" [class.tb-task__room]="toolbar()">
        @if (mobile()) {
          <p class="tb-task__meta tb-task__meta--below">
            {{ meta(task) }}
            @if (task.status !== 'SUBMITTED') {
              <tb-task-status inline [status]="task.status" [grade]="task.grade" />
            }
          </p>
        }
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

        <section class="tb-task__block">
          <h2 class="tb-task__label">{{ t.answer }}</h2>
          <tb-submission-list [submissions]="task.submissions" (download)="download($event)" />
        </section>

        @if (task.quiz; as quiz) {
          <tb-quiz-review [taskId]="task.taskId" [quiz]="quiz" (changed)="quizChanged($event)" />
        }

        @if (sheet() && (task.status === 'SUBMITTED' || task.status === 'ACCEPTED')) {
          <!-- the review is in the side sheet beside the work (from large) or a phone's toolbar -->
        } @else if (task.status === 'SUBMITTED' || task.status === 'ACCEPTED') {
          <tb-review-sheet
            [inline]="true"
            [task]="task"
            [next]="next()"
            (reviewed)="decided($event)"
          />
        } @else if (task.teacherComment) {
          <section>
            <h2 class="tb-task__label">{{ t.yourComment }}</h2>
            <p class="tb-pre">{{ task.teacherComment }}</p>
            <small class="tb-muted">{{ task.reviewedAt | date: 'dd.MM.yyyy HH:mm' }}</small>
          </section>
        }
      </div>
    } @else {
      <ng-template tbPaneHeader
        ><tb-page-header [title]="t.title" [back]="single() ? back() : null" [backLabel]="t.back"
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

    /* the answer: a tonal block (sketch 14: surface container, 20 dp corners, 16 dp padding) */
    .tb-task__block {
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg-plus);
      background: var(--p-md-surface-container);
    }

    .tb-task__meta--below {
      margin: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }

    .tb-task__place {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
      white-space: nowrap;
    }

    .tb-task__meta {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-1) var(--tb-space-2);
    }

    /* the statement: a tonal block, collapsed to its first line (our decision: the sketch's «Задание») */
    .tb-task__statement {
      border-radius: var(--tb-shape-lg-plus);
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
  private readonly fileSaver = inject(FileSaver);
  protected readonly mobile = injectMobile();
  private readonly dates = new DatePipe(inject(LOCALE_ID));
  protected readonly materials = inject(MaterialOpener);

  /** Route parameter. */
  readonly taskId = input.required<string>();
  /** One pane at a time: the header has «back» to the list. */
  readonly single = input(false);
  /** Where «back» leads: the screen the review started from. */
  readonly back = input<string | readonly unknown[]>('/teacher/homework');
  /** The review is in the side sheet beside the work (extra-large): the page shows no form. */
  readonly sheet = input(false);
  /** A phone's floating toolbar lies over the foot of the page: it leaves room for it. */
  readonly toolbar = input(false);
  /** The work as the sheet changed it (a decision): the page shows it. */
  readonly update = input<TaskDetails | null>(null);
  /** The place of the work in the review queue and its length: «1 из 2 на проверке» (0: not in it). */
  readonly place = input(0);
  readonly total = input(0);
  /** The works before and after this one in the queue. */
  readonly previous = input<string | null>(null);
  readonly next = input<NextWork | null>(null);
  /** The teacher opens another work of the queue. */
  readonly opened = output<string>();
  /** A decision on the work (the form under the answer): the queue goes on. */
  readonly reviewed = output<TaskDetails>();
  /** The work is read (or changed): the side sheet reviews it. */
  readonly loaded = output<TaskDetails>();
  protected readonly statementOpen = signal(false);

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
  protected readonly state = new LoadState();

  protected load(): void {
    this.api
      .task(this.taskId())
      .pipe(this.state.track())
      .subscribe((task) => {
        this.show(task);
      });
  }

  protected decided(task: TaskDetails): void {
    this.show(task);
    this.reviewed.emit(task);
  }

  protected openPrevious(): void {
    const previous = this.previous();
    if (previous !== null) {
      this.opened.emit(previous);
    }
  }

  protected openNext(): void {
    const next = this.next();
    if (next !== null) {
      this.opened.emit(next.taskId);
    }
  }

  /** A verdict on an answer: the score and the suggested grade follow, what the teacher typed stays. */
  protected quizChanged(task: TaskDetails): void {
    this.task.set(task);
    this.loaded.emit(task);
  }

  protected download(file: Attachment): void {
    this.api.teacherFile(file.id).subscribe((blob) => {
      this.fileSaver.save(blob, file.filename);
    });
  }

  /** «<assignment> · сдано сегодня, 09:12 · вовремя» (or «с опозданием»); not handed in — the due date. */
  protected meta(task: TaskDetails): string {
    const parts = [task.assignment.title];
    const submitted = task.submissions[0]?.submittedAt ?? task.submittedAt;
    const due = task.assignment.dueAt;
    if (submitted) {
      parts.push(handedIn(submitted, Date.now(), this.dates));
      if (due !== null) {
        parts.push(submitted > due ? this.t.late : this.t.onTime);
      }
    } else if (due !== null) {
      parts.push(this.t.due(this.dates.transform(due, 'dd.MM.yyyy HH:mm') ?? ''));
    }
    return parts.join(' · ');
  }

  /** The first line of the statement under «Задание» while it is collapsed. */
  protected preview(task: TaskDetails): string {
    const text = (task.assignment.description ?? '').replace(/[#*_`>-]/g, '').trim();
    return text.split('\n')[0] ?? '';
  }

  private show(task: TaskDetails): void {
    this.task.set(task);
    this.loaded.emit(task);
  }
}
