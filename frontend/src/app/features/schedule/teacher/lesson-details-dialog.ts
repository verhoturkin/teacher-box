import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
  linkedSignal,
  model,
  output,
  signal,
} from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Tooltip } from 'primeng/tooltip';
import { describeError } from '@core/http/error-messages';
import { problemCode } from '@core/http/problem-detail';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';
import { Confirm } from '@shared/ui/confirm';
import { DialogHeaderActions, TbDialog } from '@shared/ui/dialog/dialog';
import { LessonMarkUndo } from '../data-access/lesson-mark-undo';
import { ScheduleApi } from '../data-access/schedule-api';
import { ChangeRequest, ScheduledLesson } from '../data-access/schedule.models';
import { lessonWith } from '../schedule-labels';
import { T } from '../i18n/texts';
import { LessonCard, OutcomeChange } from '../ui/lesson-card';
import { AttendanceDialog } from './attendance-dialog';
import { LessonCancelDialog } from './lesson-cancel-dialog';
import { LessonDeleteDialog } from './lesson-delete-dialog';
import { LessonSummarySection } from './lesson-summary-section';

/** The lesson of a list with the details of the same lesson. */
function withDetails(lesson: ScheduledLesson, details: ScheduledLesson): ScheduledLesson {
  return {
    ...lesson,
    summary: details.summary,
    nextPlan: details.nextPlan,
    summaryUpdatedAt: details.summaryUpdatedAt,
    notes: details.notes,
  };
}

/**
 * A lesson with the teacher's actions (ADR-0050): a `sheet` whose headline is who the lesson is with,
 * whose body is the shared `<tb-lesson-card>` («Итог» of a past lesson with one student is a toggle
 * there) and, once the lesson has started, its summary `<tb-lesson-summary>` in place,
 * whose header has ✎ and the menu «⋮» (cancel, unmark a group lesson, delete) and whose
 * footer has the one action of the state: «Отметить посещаемость» of a past group lesson,
 * «Восстановить» of a cancelled one. Cancelling and deleting a series lesson are dialogs of their own
 * that open once the card closed.
 */
@Component({
  selector: 'tb-lesson-details-dialog',
  imports: [
    Button,
    Menu,
    Tooltip,
    TbDialog,
    DialogHeaderActions,
    LessonCard,
    AttendanceDialog,
    LessonCancelDialog,
    LessonDeleteDialog,
    LessonSummarySection,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="sheet"
      [(visible)]="visible"
      [headline]="headline()"
      [confirmLabel]="footerAction()"
      [cancelLabel]="null"
      [pending]="busy.is('restore')"
      (confirm)="footerConfirm()"
    >
      <ng-template tbDialogHeaderActions>
        @if (shown(); as item) {
          @if (item.status === 'SCHEDULED') {
            <p-button
              icon="tb-i tb-i-edit"
              severity="secondary"
              [text]="true"
              [rounded]="true"
              [pTooltip]="t.edit"
              [ariaLabel]="t.edit"
              (onClick)="editLesson()"
            />
          }
          @if (menuItems().length > 0) {
            <p-button
              icon="tb-i tb-i-more_vert"
              severity="secondary"
              [text]="true"
              [rounded]="true"
              [pTooltip]="t.more"
              [ariaLabel]="t.more"
              aria-haspopup="menu"
              (onClick)="menu.toggle($event)"
            />
            <p-menu #menu [model]="menuItems()" [popup]="true" appendTo="body" />
          }
        }
      </ng-template>
      @if (visible() && shown(); as item) {
        <tb-lesson-card
          role="teacher"
          [lesson]="item"
          [now]="now()"
          [busy]="busy.is('outcome')"
          (outcomeChange)="mark($event)"
          (answer)="answerRequest($event)"
        />
        @if (summarizable()) {
          <tb-lesson-summary [lesson]="item" (saved)="onSummarySaved($event)" />
        }
      }
    </tb-dialog>

    <tb-attendance-dialog
      [(visible)]="attendanceVisible"
      [lesson]="shown()"
      (saved)="onChanged($event, false)"
      (restored)="onChanged($event)"
    />
    <tb-lesson-cancel-dialog
      [(visible)]="cancelVisible"
      [lesson]="shown()"
      (cancelled)="onChanged($event)"
    />
    <tb-lesson-delete-dialog
      [(visible)]="deleteVisible"
      [lesson]="shown()"
      (deleted)="deleted.emit($event)"
    />
  `,
})
export class LessonDetailsDialog {
  protected readonly t = T.details;
  private readonly api = inject(ScheduleApi);
  private readonly confirm = inject(Confirm);
  private readonly snackbar = inject(Snackbar);
  private readonly markUndo = inject(LessonMarkUndo);
  protected readonly busy = new Busy();

  readonly visible = model(false);
  readonly lesson = input<ScheduledLesson | null>(null);
  /** Current time, for deciding whether the outcome can be marked. */
  readonly now = input<Date>(new Date());
  readonly changed = output<ScheduledLesson>();
  /** The lesson was deleted. */
  readonly deleted = output<string>();
  readonly edit = output<ScheduledLesson>();
  /** The teacher answers a request of the student: the card has closed, the answer opens. */
  readonly answerOpened = output<ChangeRequest>();

  /** A reloaded list gives the same lesson again: only another lesson needs its details. */
  private readonly lessonId = computed(() => this.lesson()?.id ?? null);

  protected readonly attendanceVisible = signal(false);
  protected readonly cancelVisible = signal(false);
  protected readonly deleteVisible = signal(false);

  /** The details of the lesson (summary, plan, old private notes) as the server last gave them or the teacher saved. */
  private readonly details = signal<ScheduledLesson | null>(null);

  /**
   * The lesson as the card shows it: what the page gave, then what the last action returned. The
   * lists carry no summary, so a reloaded list lesson keeps the details already loaded for it.
   */
  protected readonly shown = linkedSignal<ScheduledLesson | null, ScheduledLesson | null>({
    source: () => this.lesson(),
    computation: (next) => {
      const known = untracked(this.details);
      return next !== null && known?.id === next.id ? withDetails(next, known) : next;
    },
  });

  /** The card is open: the lesson comes with its summary, the plan and the notes. */
  constructor() {
    effect((onCleanup) => {
      const id = this.lessonId();
      if (!this.visible() || id === null) {
        return;
      }
      const request = this.api.lesson(id).subscribe((loaded) => {
        this.details.set(loaded);
        this.shown.update((current) =>
          current?.id === loaded.id ? withDetails(current, loaded) : current,
        );
      });
      onCleanup(() => {
        request.unsubscribe();
      });
    });
  }

  protected readonly headline = computed(() => {
    const lesson = this.shown();
    return lesson === null ? '' : (lesson.title ?? lessonWith(lesson));
  });
  protected readonly started = computed(() => {
    const lesson = this.shown();
    return lesson !== null && new Date(lesson.startsAt) <= this.now();
  });
  /** A summary belongs to a lesson that has started: not a cancelled one, not a missed one with one student. */
  protected readonly summarizable = computed(() => {
    const lesson = this.shown();
    return (
      lesson !== null &&
      this.started() &&
      lesson.status !== 'CANCELLED' &&
      !(lesson.groupId === null && lesson.status === 'MISSED')
    );
  });
  /** Not held and nobody charged: planned, or cancelled without a charge (that one is «missed»). */
  protected readonly deletable = computed(() => {
    const lesson = this.shown();
    return (
      lesson !== null &&
      (lesson.status === 'SCHEDULED' || lesson.status === 'CANCELLED') &&
      lesson.participants.every((participant) => participant.attendance !== 'MISSED')
    );
  });
  /** One action at most, by the state (audit §5.2): none for a lesson to come or with one student. */
  protected readonly footerAction = computed(() => {
    const lesson = this.shown();
    if (lesson === null) {
      return null;
    }
    if (lesson.status === 'CANCELLED') {
      return this.t.restore;
    }
    return this.started() && lesson.groupId !== null ? this.t.markAttendance : null;
  });
  /** The actions with consequences are in the menu of the header, away from the footer (ADR-0026). */
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const lesson = this.shown();
    if (lesson === null) {
      return [];
    }
    const items: MenuItem[] = [];
    if (lesson.status === 'SCHEDULED') {
      items.push({
        label: this.t.cancelItem,
        icon: 'tb-i tb-i-cancel',
        command: () => {
          this.visible.set(false);
          this.cancelVisible.set(true);
        },
      });
    }
    // a lesson with one student is unmarked by pressing the chosen «Итог» again
    if (lesson.groupId !== null && (lesson.status === 'CONDUCTED' || lesson.status === 'MISSED')) {
      items.push({
        label: this.t.unmark,
        icon: 'tb-i tb-i-undo',
        command: () => {
          this.unmarkGroup();
        },
      });
    }
    if (this.deletable()) {
      items.push({
        label: this.t.deleteItem,
        icon: 'tb-i tb-i-delete',
        styleClass: 'tb-menu-item--danger',
        command: () => {
          void this.deleteLesson();
        },
      });
    }
    return items;
  });

  protected editLesson(): void {
    const lesson = this.shown();
    if (lesson !== null) {
      this.visible.set(false);
      this.edit.emit(lesson);
    }
  }

  protected answerRequest(request: ChangeRequest): void {
    this.visible.set(false);
    this.answerOpened.emit(request);
  }

  protected footerConfirm(): void {
    const lesson = this.shown();
    if (lesson?.status === 'CANCELLED') {
      this.restore();
    } else {
      // the attendance replaces the card: a window does not open over a window (ADR-0026)
      this.visible.set(false);
      this.attendanceVisible.set(true);
    }
  }

  /** A save of the summary: the card keeps the lesson it returned; the page needs no reload. */
  protected onSummarySaved(lesson: ScheduledLesson): void {
    this.details.set(lesson);
    this.shown.set(lesson);
    this.changed.emit(lesson);
  }

  /** `announce` is false when the action told its result itself (attendance with «Отменить»). */
  protected onChanged(lesson: ScheduledLesson, announce = true): void {
    this.visible.set(false);
    this.emitChanged(lesson, announce);
  }

  /** One snackbar per action: the page only reloads, the card tells what nothing else told. */
  private emitChanged(lesson: ScheduledLesson, announce: boolean): void {
    if (announce) {
      this.snackbar.success(T.page.updated);
    }
    this.changed.emit(lesson);
  }

  /** «Итог»: saves at once; a failure puts the toggle back (the request tells the reason itself). */
  mark(change: OutcomeChange): void {
    const lesson = this.shown();
    if (lesson === null) {
      change.revert();
      return;
    }
    const request =
      change.outcome === null
        ? this.api.reopen(lesson.id)
        : this.api.setOutcome(lesson.id, change.outcome);
    this.busy.guard('outcome', request).subscribe({
      next: (updated) => {
        this.shown.set(updated);
        // a mark is told by the undo snackbar, a reopen by the card
        this.emitChanged(updated, change.outcome === null);
        if (change.outcome !== null) {
          this.markUndo.offer(lesson, updated, (restored) => {
            this.shown.set(restored);
            this.emitChanged(restored, true);
          });
        }
      },
      error: () => {
        change.revert();
      },
    });
  }

  private unmarkGroup(): void {
    const lesson = this.shown();
    if (lesson === null) {
      return;
    }
    this.busy.guard('outcome', this.api.reopen(lesson.id)).subscribe((updated) => {
      this.shown.set(updated);
      this.emitChanged(updated, true);
    });
  }

  private restore(allowOverlap = false): void {
    const lesson = this.shown();
    if (lesson === null) {
      return;
    }
    this.busy.guard('restore', this.api.restore(lesson.id, allowOverlap)).subscribe({
      next: (restored) => {
        this.onChanged(restored);
      },
      error: (error: unknown) => {
        if (problemCode(error) === 'schedule.overlap') {
          void this.restoreAnyway();
        } else {
          this.snackbar.error(describeError(error, this.t.restoreFailed));
        }
      },
    });
  }

  private async restoreAnyway(): Promise<void> {
    if (
      await this.confirm.safe({
        header: this.t.busyTitle,
        message: this.t.restoreBusy,
        acceptLabel: this.t.restore,
      })
    ) {
      this.restore(true);
    }
  }

  /** A lesson of a series asks which of them first (a dialog of its own); a single one only confirms. */
  private async deleteLesson(): Promise<void> {
    const lesson = this.shown();
    if (lesson === null) {
      return;
    }
    this.visible.set(false);
    if (lesson.seriesId !== null) {
      this.deleteVisible.set(true);
      return;
    }
    const confirmed = await this.confirm.danger({
      header: this.t.deleteHeader,
      message:
        lesson.status === 'SCHEDULED'
          ? `${this.t.deleteWarning} ${this.t.deleteNotice}`
          : this.t.deleteWarning,
      acceptLabel: this.t.deleteLesson,
    });
    if (confirmed) {
      this.api
        .deleteLesson(lesson.id, 'ONLY', lesson.version, lesson.repeatVersion)
        .subscribe(() => {
          this.deleted.emit(lesson.id);
        });
    }
  }
}
