import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Drawer } from 'primeng/drawer';
import { ProgressBar } from 'primeng/progressbar';
import type { Debtor } from '@features/billing/parts';
import { HomeworkApi } from '@features/homework/parts';
import type { ReviewQueueItem } from '@features/homework/parts';
import {
  ScheduleApi,
  formatLessonStart,
  lessonWith,
  requestKindLabel,
} from '@features/schedule/parts';
import type { ChangeRequest, ScheduledLesson } from '@features/schedule/parts';
import { injectMobile } from '@core/layout/mobile';
import { SHARED_T } from '@shared/i18n/texts';
import { formatMoney } from '@shared/money/money';
import { hideHint, isHintHidden } from '@shared/storage/device-settings';
import { Avatar } from '@shared/ui/avatar';
import { Busy } from '@shared/ui/busy';
import { EmptyState } from '@shared/ui/empty-state';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { ProgressLabel } from '@shared/ui/progress-label.directive';
import { T } from './i18n/texts';

/** Browser storage key: the teacher hid the first-run steps. */
export const CHECKLIST_DISMISSED_KEY = 'tb.first-run-checklist.dismissed';

/** Rows of one source shown at once; the rest is counted. */
const PER_SOURCE = 5;

/** Where the teacher is in setting up the portal (`null` while unknown). */
export interface SetupProgress {
  readonly hasStudents: boolean | null;
  readonly priceSet: boolean | null;
  readonly messengerConfigured: boolean | null;
  readonly hasLessons: boolean | null;
}

interface Step {
  readonly done: boolean;
  readonly title: string;
  readonly hint: string;
  readonly link: string;
  readonly query?: Readonly<Record<string, string>>;
}

/** One row of the queue: who it is about, what is to do and the action in place. */
interface Row {
  readonly key: string;
  readonly kind: 'lesson' | 'request' | 'review' | 'debt';
  readonly name: string;
  readonly photo: string | null;
  readonly text: string;
  readonly link: string;
  readonly query?: Readonly<Record<string, string>>;
  /** A lesson with one student: «Проведено | Пропуск» in place. */
  readonly lessonId?: string;
}

/**
 * Teacher's Today, column two (spec §6): one queue of what waits for the teacher — unmarked lessons,
 * change requests, work to review, debts — each row with its action in place, and under it the
 * unfinished first-run steps (a dashed card with progress that disappears when done or hidden).
 */
@Component({
  selector: 'tb-todo-queue',
  imports: [
    Avatar,
    Button,
    Card,
    Drawer,
    EmptyState,
    ModalDrawer,
    ProgressBar,
    ProgressLabel,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      @if (loaded() && rows().length === 0 && !setupVisible()) {
        <tb-empty-state [compact]="true" icon="tb-i-check_circle" [title]="t.nothing" />
      }
      @if (rows().length > 0) {
        <ul class="tb-list tb-queue">
          @for (row of rows(); track row.key) {
            <li>
              <tb-avatar [name]="row.name" [photo]="row.photo" />
              <span class="tb-list__text">
                <span class="tb-list__title">{{ row.name }}</span>
                <small class="tb-muted">{{ row.text }}</small>
              </span>
              @if (mobile()) {
                <!-- a phone: the row stays one line; its action is the whole row, two actions open a sheet -->
                <span class="tb-list__trail tb-list__trail--icons">
                  <p-button
                    class="tb-list__stretched"
                    icon="tb-i tb-i-chevron_right"
                    severity="secondary"
                    [text]="true"
                    [rounded]="true"
                    [ariaLabel]="
                      row.name +
                      ': ' +
                      (row.lessonId ? t.held + ' | ' + t.missed : actionLabel(row))
                    "
                    (onClick)="open(row)"
                  />
                </span>
              } @else {
                <span class="tb-list__trail tb-queue__actions">
                  @if (row.lessonId; as lessonId) {
                    <p-button
                      [label]="t.held"
                      severity="secondary"
                      [loading]="busy.is(lessonId + 'CONDUCTED')"
                      (onClick)="mark(lessonId, 'CONDUCTED')"
                    />
                    <p-button
                      [label]="t.missed"
                      severity="secondary"
                      [text]="true"
                      [loading]="busy.is(lessonId + 'MISSED')"
                      (onClick)="mark(lessonId, 'MISSED')"
                    />
                  } @else {
                    <a class="tb-link" [routerLink]="row.link" [queryParams]="row.query">{{
                      actionLabel(row)
                    }}</a>
                  }
                </span>
              }
            </li>
          }
        </ul>
        @if (more() > 0) {
          <small class="tb-muted">{{ t.more(more()) }}</small>
        }
      }
      @if (setupVisible()) {
        <section class="tb-queue__setup" [attr.aria-label]="t.setupTitle">
          <strong>{{ t.setupTitle }}</strong>
          <p-progressbar
            [value]="percent()"
            [showValue]="false"
            styleClass="tb-queue__progress"
            [tbProgressLabel]="t.progress(doneCount(), steps().length)"
          />
          <ol class="tb-queue__steps">
            @for (step of left(); track step.title) {
              <li>
                <i class="tb-i tb-i-radio_button_unchecked" aria-hidden="true"></i>
                <div>
                  <a [routerLink]="step.link" [queryParams]="step.query" class="tb-link">{{
                    step.title
                  }}</a>
                  <small class="tb-muted">{{ step.hint }}</small>
                </div>
              </li>
            }
          </ol>
          <div class="tb-widget-footer">
            <span class="tb-muted">{{ t.progress(doneCount(), steps().length) }}</span>
            <p-button [label]="t.hide" severity="secondary" [text]="true" (onClick)="dismiss()" />
          </div>
        </section>
      }
    </p-card>

    <p-drawer
      tbModalDrawer
      [blockScroll]="true"
      [ariaCloseLabel]="c.close"
      [visible]="sheet() !== null"
      (visibleChange)="$event || sheet.set(null)"
      position="bottom"
      styleClass="tb-sheet"
      [header]="sheet()?.name ?? ''"
    >
      @if (sheet(); as row) {
        <p class="tb-muted">{{ row.text }}</p>
        <div class="tb-queue__sheet-actions">
          <p-button
            [label]="t.held"
            [loading]="busy.is(row.lessonId + 'CONDUCTED')"
            (onClick)="markFromSheet(row, 'CONDUCTED')"
          />
          <p-button
            [label]="t.missed"
            severity="secondary"
            [loading]="busy.is(row.lessonId + 'MISSED')"
            (onClick)="markFromSheet(row, 'MISSED')"
          />
        </div>
      }
    </p-drawer>
  `,
  styles: `
    /* the bottom sheet of a lesson to mark: its buttons one under another, across the width */
    .tb-queue__sheet-actions {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
    }

    .tb-queue__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-1);
      align-items: center;
      justify-content: flex-end;
    }

    .tb-queue__setup {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      margin-top: var(--tb-space-4);
      padding: var(--tb-space-4);
      border: 1px dashed var(--p-md-outline);
      border-radius: var(--tb-shape-lg);
    }

    :host ::ng-deep .tb-queue__progress {
      height: 0.5rem;
    }

    .tb-queue__steps {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: flex-start;
        gap: var(--tb-space-3);

        > i {
          margin-top: var(--tb-space-1);
          color: var(--p-md-on-surface-variant);
        }

        div {
          display: flex;
          flex-direction: column;
        }
      }
    }
  `,
})
export class TodoQueue implements OnInit {
  protected readonly t = T.queue;
  private readonly scheduleApi = inject(ScheduleApi);
  private readonly homeworkApi = inject(HomeworkApi);
  private readonly router = inject(Router);
  protected readonly busy = new Busy();
  protected readonly c = SHARED_T.common;
  protected readonly mobile = injectMobile();
  /** The lesson row whose «Проведено | Пропуск» sheet is open (phone). */
  protected readonly sheet = signal<Row | null>(null);

  readonly progress = input.required<SetupProgress>();
  readonly debtors = input<readonly Debtor[]>([]);
  readonly currency = input('RUB');
  /** A lesson was marked: the schedule counters of the page are stale. */
  readonly marked = output();

  protected readonly loaded = signal(false);
  private readonly lessons = signal<readonly ScheduledLesson[]>([]);
  private readonly requests = signal<readonly ChangeRequest[]>([]);
  private readonly reviews = signal<readonly ReviewQueueItem[]>([]);
  private readonly dismissed = signal(isHintHidden(CHECKLIST_DISMISSED_KEY));

  private readonly all = computed((): Row[][] => [
    this.lessons().map((lesson) => ({
      key: `lesson-${lesson.id}`,
      kind: 'lesson',
      name: lessonWith(lesson),
      photo: lesson.studentAvatar,
      text: T.queue.lesson(formatLessonStart(lesson.startsAt)),
      link: '/teacher/schedule',
      ...(lesson.groupId === null ? { lessonId: lesson.id } : {}),
    })),
    this.requests().map((request) => ({
      key: `request-${request.id}`,
      kind: 'request',
      name: request.groupName ?? request.studentName ?? '',
      photo: request.studentAvatar,
      text: T.queue.request(requestKindLabel(request)),
      link: '/teacher/schedule',
    })),
    this.reviews().map((item) => ({
      key: `review-${item.taskId}-${item.assignmentId}`,
      kind: 'review',
      name: item.studentName,
      photo: item.studentAvatar,
      text: T.queue.review(item.title),
      link: '/teacher/homework/review',
    })),
    this.debtors().map((debtor) => ({
      key: `debt-${debtor.studentId}`,
      kind: 'debt',
      name: debtor.displayName,
      photo: debtor.avatar,
      text: T.queue.debt(formatMoney(-debtor.balance, this.currency())),
      link: `/teacher/students/${debtor.studentId}`,
      query: { tab: 'payments' },
    })),
  ]);
  protected readonly rows = computed(() => this.all().flatMap((rows) => rows.slice(0, PER_SOURCE)));
  protected readonly more = computed(() =>
    this.all().reduce((sum, rows) => sum + Math.max(0, rows.length - PER_SOURCE), 0),
  );

  protected readonly steps = computed((): Step[] => {
    const progress = this.progress();
    return [
      {
        done: progress.hasStudents === true,
        title: T.queue.student,
        hint: T.queue.studentHint,
        link: '/teacher/students',
        query: { create: 'student' },
      },
      {
        done: progress.priceSet === true,
        title: T.queue.price,
        hint: T.queue.priceHint,
        link: '/teacher/billing',
      },
      {
        done: progress.messengerConfigured === true,
        title: T.queue.messenger,
        hint: T.queue.messengerHint,
        link: '/teacher/settings/messengers',
      },
      {
        done: progress.hasLessons === true,
        title: T.queue.lessonStep,
        hint: T.queue.lessonStepHint,
        link: '/teacher/schedule',
        query: { create: 'lesson' },
      },
    ];
  });
  protected readonly left = computed(() => this.steps().filter((step) => !step.done));
  protected readonly doneCount = computed(() => this.steps().length - this.left().length);
  protected readonly percent = computed(() =>
    Math.round((this.doneCount() / this.steps().length) * 100),
  );
  /** Shown once everything is known, until all steps are done or the teacher hides it. */
  protected readonly setupVisible = computed(() => {
    const known = Object.values(this.progress()).every((value) => value !== null);
    return known && !this.dismissed() && this.doneCount() < this.steps().length;
  });

  ngOnInit(): void {
    forkJoin({
      lessons: this.scheduleApi.unmarked(),
      requests: this.scheduleApi.pendingRequests(),
      reviews: this.homeworkApi.reviewQueue(),
    }).subscribe(({ lessons, requests, reviews }) => {
      this.lessons.set(lessons);
      this.requests.set(requests);
      this.reviews.set(reviews);
      this.loaded.set(true);
    });
  }

  /** The link of a row without an in-place action: «Отметить» a group lesson, «Ответить», «Проверить», «Открыть». */
  protected actionLabel(row: Row): string {
    switch (row.kind) {
      case 'lesson':
        return T.queue.mark;
      case 'request':
        return T.queue.reply;
      case 'review':
        return T.queue.check;
      case 'debt':
        return T.queue.open;
    }
  }

  /** A phone: a row with two actions opens the sheet, any other goes to its page. */
  protected open(row: Row): void {
    if (row.lessonId === undefined) {
      void this.router.navigate([row.link], { queryParams: row.query });
    } else {
      this.sheet.set(row);
    }
  }

  protected markFromSheet(row: Row, outcome: 'CONDUCTED' | 'MISSED'): void {
    if (row.lessonId === undefined) {
      return;
    }
    this.mark(row.lessonId, outcome);
  }

  protected mark(lessonId: string, outcome: 'CONDUCTED' | 'MISSED'): void {
    this.busy
      .guard(lessonId + outcome, this.scheduleApi.setOutcome(lessonId, outcome))
      .subscribe(() => {
        this.sheet.set(null);
        this.lessons.update((lessons) => lessons.filter((lesson) => lesson.id !== lessonId));
        this.marked.emit();
      });
  }

  protected dismiss(): void {
    hideHint(CHECKLIST_DISMISSED_KEY);
    this.dismissed.set(true);
  }
}
