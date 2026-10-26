import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
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
import { ScheduleApi } from '../data-access/schedule-api';
import { ChangeRequest, ScheduledLesson } from '../data-access/schedule.models';
import { lessonWith } from '../schedule-labels';
import { T } from '../i18n/texts';
import { LessonCard, OutcomeChange } from '../ui/lesson-card';
import { AttendanceDialog } from './attendance-dialog';
import { LessonCancelDialog } from './lesson-cancel-dialog';
import { LessonDeleteDialog } from './lesson-delete-dialog';

/**
 * A lesson with the teacher's actions (ADR-0050): a `sheet` whose headline is who the lesson is with,
 * whose body is the shared `<tb-lesson-card>` («Итог» of a past lesson with one student is a toggle
 * there), whose header has ✎ and the menu «⋮» (cancel, unmark a group lesson, delete) and whose
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
      }
    </tb-dialog>

    <tb-attendance-dialog
      [(visible)]="attendanceVisible"
      [lesson]="shown()"
      (saved)="onChanged($event)"
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

  protected readonly attendanceVisible = signal(false);
  protected readonly cancelVisible = signal(false);
  protected readonly deleteVisible = signal(false);

  /** The lesson as the card shows it: what the page gave, then what the last action returned. */
  protected readonly shown = linkedSignal(() => this.lesson());

  protected readonly headline = computed(() => {
    const lesson = this.shown();
    return lesson === null ? '' : lessonWith(lesson);
  });
  protected readonly started = computed(() => {
    const lesson = this.shown();
    return lesson !== null && new Date(lesson.startsAt) <= this.now();
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

  protected onChanged(lesson: ScheduledLesson): void {
    this.visible.set(false);
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
        this.changed.emit(updated);
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
      this.changed.emit(updated);
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
