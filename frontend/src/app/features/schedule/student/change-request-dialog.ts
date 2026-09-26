import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
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

/**
 * A student asks to move a lesson to another time or to cancel it; the teacher answers. A late
 * cancellation may be charged as a missed lesson — the dialog says so beforehand.
 */
@Component({
  selector: 'tb-change-request-dialog',
  imports: [FormsModule, Button, DatePicker, Dialog, Message, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [header]="title()" [(visible)]="visible" [modal]="true" [style]="{ width: '30rem' }" [draggable]="false">
      @if (lesson(); as lesson) {
        <div class="tb-form">
          <p>Занятие: {{ time() }}</p>
          @if (kind() === 'RESCHEDULE') {
            <div class="tb-field">
              <label for="request-start">Удобное время</label>
              <p-datepicker
                inputId="request-start"
                [(ngModel)]="proposed"
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
          } @else if (late()) {
            <p-message severity="warn" styleClass="tb-form-message">
              До занятия осталось мало времени: учитель может засчитать его как пропуск.
            </p-message>
          }
          <div class="tb-field">
            <label for="request-comment">Комментарий учителю</label>
            <textarea pTextarea id="request-comment" rows="2" [(ngModel)]="comment" maxlength="500"></textarea>
          </div>
          @if (error(); as message) {
            <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
          }
        </div>
      }
      <ng-template #footer>
        <p-button label="Отмена" severity="secondary" [text]="true" (onClick)="visible.set(false)" />
        <p-button
          label="Отправить учителю"
          [loading]="pending()"
          [disabled]="kind() === 'RESCHEDULE' && proposed() === null"
          (onClick)="send()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class ChangeRequestDialog {
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
  protected readonly title = computed(() => (this.kind() === 'RESCHEDULE' ? 'Перенести занятие' : 'Отменить занятие'));
  protected readonly time = computed(() => {
    const lesson = this.lesson();
    return lesson === null ? '' : formatLessonTime(lesson.startsAt, lesson.endsAt);
  });
  protected readonly late = computed(() => {
    const lesson = this.lesson();
    return (
      lesson !== null &&
      new Date(lesson.startsAt).getTime() - this.now().getTime() < this.lateCancellationMinutes() * 60_000
    );
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.proposed.set(null);
        this.comment.set('');
        this.error.set(null);
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
          this.error.set(describeError(error, 'Не удалось отправить запрос'));
        },
      });
  }
}
