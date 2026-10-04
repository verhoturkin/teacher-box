import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { Observable } from 'rxjs';
import { describeError } from '@core/http/error-messages';
import { problemCode } from '@core/http/problem-detail';
import { ScheduleApi } from '../data-access/schedule-api';
import { ChangeRequest } from '../data-access/schedule.models';
import { KIND_LABELS, formatLessonStart, optionalText } from '../schedule-labels';

/**
 * The teacher answers a student's request: a move is approved for the proposed (or another) time,
 * a cancellation may be charged as a missed lesson (suggested when it is late).
 */
@Component({
  selector: 'tb-request-answer-dialog',
  imports: [FormsModule, Button, Checkbox, DatePicker, Dialog, Message, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      header="Запрос ученика"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
    >
      @if (request(); as request) {
        <div class="tb-form">
          <p>
            @if (request.groupId !== null && request.kind === 'CANCEL') {
              <strong>{{ request.studentName ?? 'Ученик' }}</strong> не придёт на занятие группы «{{
                request.groupName
              }}» {{ start(request.lessonStartsAt) }}
            } @else {
              <strong>{{ request.studentName ?? 'Ученик' }}</strong
              >: {{ kinds[request.kind].toLowerCase() }} занятия
              {{ start(request.lessonStartsAt) }}
              @if (request.groupId !== null) {
                (группа «{{ request.groupName }}» — занятие перенесётся для всех)
              }
            }
          </p>
          @if (request.comment !== null) {
            <p class="tb-muted">«{{ request.comment }}»</p>
          }
          @if (request.kind === 'RESCHEDULE') {
            <div class="tb-field">
              <label for="answer-start">Новое время</label>
              <p-datepicker
                inputId="answer-start"
                [(ngModel)]="startsAt"
                dateFormat="dd.mm.yy"
                [showTime]="true"
                hourFormat="24"
                [stepMinute]="5"
                [showIcon]="true"
                [showOnFocus]="false"
                appendTo="body"
                [fluid]="true"
              />
            </div>
          } @else {
            @if (request.late) {
              <p class="tb-hint">Отмена поздняя — по правилам её можно засчитать как пропуск.</p>
            }
            <label class="tb-switch" for="answer-charge">
              <p-checkbox [(ngModel)]="charge" [binary]="true" inputId="answer-charge" />
              <span>Засчитать как пропуск (оплачивается)</span>
            </label>
          }
          @if (busy()) {
            <p-message severity="warn" styleClass="tb-form-message">
              В это время у вас другое занятие или дела в календаре.
              <p-button
                severity="success"
                label="Всё равно перенести"
                [text]="true"
                (onClick)="approve(true)"
              />
            </p-message>
          }
          @if (error(); as message) {
            <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
          }
          <div class="tb-field">
            <label for="answer-comment">Комментарий ученику</label>
            <textarea
              pTextarea
              id="answer-comment"
              rows="2"
              [(ngModel)]="answer"
              maxlength="500"
            ></textarea>
          </div>
        </div>
      }
      <ng-template #footer>
        <p-button
          label="Отклонить"
          severity="danger"
          [text]="true"
          [loading]="pending()"
          (onClick)="decline()"
        />
        <p-button
          severity="success"
          label="Согласовать"
          [loading]="pending()"
          (onClick)="approve()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class RequestAnswerDialog {
  private readonly api = inject(ScheduleApi);

  readonly visible = model(false);
  readonly request = input<ChangeRequest | null>(null);
  readonly answered = output<ChangeRequest>();

  protected readonly kinds = KIND_LABELS;
  protected readonly pending = signal(false);
  protected readonly startsAt = signal<Date | null>(null);
  protected readonly charge = signal(false);
  protected readonly answer = signal('');
  /** The teacher is busy at the new time of the move. */
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const request = this.request();
      if (this.visible() && request !== null) {
        this.startsAt.set(
          request.proposedStartsAt === null ? null : new Date(request.proposedStartsAt),
        );
        this.charge.set(request.late);
        this.answer.set('');
        this.busy.set(false);
        this.error.set(null);
      }
    });
  }

  protected start(iso: string): string {
    return formatLessonStart(iso);
  }

  /** @param allowBusy move even if the teacher is busy at the new time */
  approve(allowBusy = false): void {
    this.run((request) =>
      this.api.approve(request.id, {
        startsAt: request.kind === 'RESCHEDULE' ? (this.startsAt()?.toISOString() ?? null) : null,
        charge: request.kind === 'CANCEL' && this.charge(),
        answer: optionalText(this.answer()),
        allowBusy,
      }),
    );
  }

  decline(): void {
    this.run((request) => this.api.decline(request.id, optionalText(this.answer())));
  }

  private run(action: (request: ChangeRequest) => Observable<unknown>): void {
    const request = this.request();
    if (request === null || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.busy.set(false);
    this.error.set(null);
    action(request).subscribe({
      next: () => {
        this.pending.set(false);
        this.visible.set(false);
        this.answered.emit(request);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        if (problemCode(error) === 'schedule.slot-busy') {
          this.busy.set(true);
        } else {
          this.error.set(describeError(error, 'Не удалось ответить на запрос'));
        }
      },
    });
  }
}
