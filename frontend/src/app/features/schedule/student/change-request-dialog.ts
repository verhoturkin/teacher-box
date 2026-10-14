import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { ScheduleApi } from '../data-access/schedule-api';
import { ChangeKind, ChangeRequest, ScheduledLesson } from '../data-access/schedule.models';
import { formatLessonTime, optionalText } from '../schedule-labels';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/**
 * A student asks to move a lesson to another time or to cancel it; the teacher answers. A late
 * cancellation may be charged as a missed lesson — the dialog says so beforehand.
 */
@Component({
  selector: 'tb-change-request-dialog',
  imports: [FormsModule, Button, DatePicker, Dialog, Message, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="title()"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
    >
      @if (lesson(); as lesson) {
        <div class="tb-form">
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
              maxlength="500"
            ></textarea>
          </div>
          @if (error(); as message) {
            <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
          }
        </div>
      }
      <ng-template #footer>
        <p-button
          [label]="c.cancel"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button
          [severity]="cancelsOwnLesson() ? 'danger' : 'primary'"
          [label]="sendLabel()"
          [loading]="pending()"
          [disabled]="kind() === 'RESCHEDULE' && (proposed() === null || busyAt())"
          (onClick)="send()"
        />
      </ng-template>
    </p-dialog>
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
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
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

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.proposed.set(null);
        this.busyAt.set(false);
        this.comment.set('');
        this.error.set(null);
      }
    });
  }

  /** A new time is chosen: the teacher's busy time for it is checked at once. */
  choose(proposed: Date | null): void {
    this.proposed.set(proposed);
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
    const lesson = this.lesson();
    const proposed = this.proposed();
    if (lesson === null || this.pending() || (this.kind() === 'RESCHEDULE' && proposed === null)) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api
      .requestChange(lesson.id, {
        kind: this.kind(),
        proposedStartsAt: this.kind() === 'RESCHEDULE' ? (proposed?.toISOString() ?? null) : null,
        comment: optionalText(this.comment()),
      })
      .subscribe({
        next: (request) => {
          this.pending.set(false);
          this.visible.set(false);
          this.sent.emit(request);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, T.changeRequest.failed));
        },
      });
  }
}
