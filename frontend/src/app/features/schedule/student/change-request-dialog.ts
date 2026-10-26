import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { EMPTY } from 'rxjs';
import { ScheduleApi } from '../data-access/schedule-api';
import { ChangeKind, ChangeRequest, ScheduledLesson } from '../data-access/schedule.models';
import { formatLessonTime, optionalText } from '../schedule-labels';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';

/**
 * A student asks to move a lesson to another time or to cancel it; the teacher answers. A late
 * cancellation may be charged as a missed lesson — the dialog says so beforehand.
 */
@Component({
  selector: 'tb-change-request-dialog',
  imports: [FormsModule, DatePicker, Message, TbDialog, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="title()"
      [confirmLabel]="sendLabel()"
      [confirmSeverity]="cancelsOwnLesson() ? 'danger' : 'primary'"
      formId="change-request-form"
      [pending]="submit.pending()"
      [error]="submit.error()"
    >
      @if (lesson(); as lesson) {
        <form id="change-request-form" class="tb-form" (ngSubmit)="send()">
          <p>{{ t.lesson(time()) }}</p>
          @if (lesson.groupId !== null) {
            <p class="tb-muted">
              {{
                kind() === 'RESCHEDULE'
                  ? t.groupReschedule(lesson.groupName ?? '')
                  : t.groupAbsence(lesson.groupName ?? '')
              }}
            </p>
          }
          @if (kind() === 'RESCHEDULE') {
            <div class="tb-field">
              <label for="request-start">{{ t.time }}</label>
              <p-datepicker
                inputId="request-start"
                [ngModel]="proposed()"
                (ngModelChange)="choose($event)"
                [ngModelOptions]="{ standalone: true }"
                dateFormat="dd.mm.yy"
                [showTime]="true"
                hourFormat="24"
                [stepMinute]="5"
                [minDate]="now()"
                [showIcon]="true"
                [showOnFocus]="false"
                appendTo="body"
                [fluid]="true"
              />
            </div>
            @if (busyAt()) {
              <p-message severity="warn" styleClass="tb-form-message">{{ t.busy }}</p-message>
            } @else if (missing()) {
              <small class="tb-field__error" role="alert">{{ t.pickTime }}</small>
            }
          } @else if (late()) {
            <p-message severity="warn" styleClass="tb-form-message">{{ t.late }}</p-message>
          }
          <div class="tb-field">
            <label for="request-comment">{{ t.comment }}</label>
            <textarea
              pTextarea
              id="request-comment"
              rows="2"
              [(ngModel)]="comment"
              [ngModelOptions]="{ standalone: true }"
              maxlength="500"
            ></textarea>
          </div>
        </form>
      }
    </tb-dialog>
  `,
})
export class ChangeRequestDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.changeRequest;
  private readonly api = inject(ScheduleApi);

  readonly visible = model(false);
  readonly lesson = input<ScheduledLesson | null>(null);
  readonly kind = input<ChangeKind>('RESCHEDULE');
  /** A cancellation later than this before the lesson is late. */
  readonly lateCancellationMinutes = input(0);
  readonly now = input<Date>(new Date());
  readonly sent = output<ChangeRequest>();

  /** The time the student proposes (bound to the date picker). */
  readonly proposed = signal<Date | null>(null);
  protected readonly comment = signal('');
  /** «Send» was pressed without a time. */
  protected readonly missing = signal(false);
  /** The teacher is busy at the chosen time. */
  protected readonly busyAt = signal(false);
  /** «I will not come» to a group lesson. */
  protected readonly absence = computed(
    () => this.kind() === 'CANCEL' && (this.lesson()?.groupId ?? null) !== null,
  );
  /** Asking to cancel a lesson of one's own: the one red button of the dialog (ADR-0026). */
  protected readonly cancelsOwnLesson = computed(() => this.kind() === 'CANCEL' && !this.absence());
  protected readonly sendLabel = computed(() => {
    if (this.cancelsOwnLesson()) {
      return T.changeRequest.askCancel;
    }
    return this.absence() && !this.late() ? T.changeRequest.warn : T.changeRequest.send;
  });
  protected readonly title = computed(() => {
    if (this.kind() === 'RESCHEDULE') {
      return T.changeRequest.rescheduleTitle;
    }
    return this.absence() ? T.changeRequest.absenceTitle : T.changeRequest.cancelTitle;
  });
  protected readonly time = computed(() => {
    const lesson = this.lesson();
    return lesson === null ? '' : formatLessonTime(lesson.startsAt, lesson.endsAt);
  });
  protected readonly late = computed(() => {
    const lesson = this.lesson();
    return (
      lesson !== null &&
      new Date(lesson.startsAt).getTime() - this.now().getTime() <
        this.lateCancellationMinutes() * 60_000
    );
  });

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    reset: () => {
      this.proposed.set(null);
      this.busyAt.set(false);
      this.missing.set(false);
      this.comment.set('');
    },
    failed: T.changeRequest.failed,
    request: () => {
      const lesson = this.lesson();
      if (lesson === null) {
        return EMPTY;
      }
      return this.api.requestChange(lesson.id, {
        kind: this.kind(),
        proposedStartsAt:
          this.kind() === 'RESCHEDULE' ? (this.proposed()?.toISOString() ?? null) : null,
        comment: optionalText(this.comment()),
      });
    },
    done: (request) => {
      this.sent.emit(request);
    },
  });

  /** A new time is chosen: the teacher's busy time for it is checked at once. */
  choose(proposed: Date | null): void {
    this.proposed.set(proposed);
    this.missing.set(false);
    this.busyAt.set(false);
    const lesson = this.lesson();
    if (proposed === null || lesson === null) {
      return;
    }
    const minutes =
      (new Date(lesson.endsAt).getTime() - new Date(lesson.startsAt).getTime()) / 60_000;
    const end = new Date(proposed.getTime() + minutes * 60_000);
    this.api.teacherBusy(proposed.toISOString(), end.toISOString()).subscribe((busy) => {
      if (this.proposed() === proposed) {
        this.busyAt.set(busy.length > 0);
      }
    });
  }

  send(): void {
    if (this.kind() === 'RESCHEDULE' && this.proposed() === null) {
      this.missing.set(true);
      return;
    }
    if (this.lesson() !== null && !this.busyAt()) {
      this.submit.run();
    }
  }
}
