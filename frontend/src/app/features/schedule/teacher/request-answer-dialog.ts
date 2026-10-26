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
import { Checkbox } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { Observable } from 'rxjs';
import { describeError } from '@core/http/error-messages';
import { problemCode } from '@core/http/problem-detail';
import { ScheduleApi } from '../data-access/schedule-api';
import { ChangeRequest } from '../data-access/schedule.models';
import { formatLessonStart, optionalText } from '../schedule-labels';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';
import { Confirm } from '@shared/ui/confirm';
import { TbDialog } from '@shared/ui/dialog/dialog';

/**
 * The teacher answers a student's request: a move is approved for the proposed (or another) time,
 * a cancellation may be charged as a missed lesson (suggested when it is late).
 */
@Component({
  selector: 'tb-request-answer-dialog',
  imports: [FormsModule, Checkbox, DatePicker, SelectButton, TbDialog, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="t.title"
      [confirmLabel]="approving() ? t.approve : t.decline"
      [confirmSeverity]="approving() ? 'primary' : 'danger'"
      formId="request-answer-form"
      [pending]="pending()"
      [error]="error()"
    >
      @if (request(); as request) {
        <form id="request-answer-form" class="tb-form" (ngSubmit)="answerRequest()">
          <p>
            @if (request.groupId !== null && request.kind === 'CANCEL') {
              <strong>{{ request.studentName ?? c.student }}</strong>
              {{ t.groupAbsence(request.groupName ?? '', start(request.lessonStartsAt)) }}
            } @else {
              <strong>{{ request.studentName ?? c.student }}</strong
              >{{
                request.kind === 'RESCHEDULE'
                  ? t.asksReschedule(start(request.lessonStartsAt))
                  : t.asksCancel(start(request.lessonStartsAt))
              }}
              @if (request.groupId !== null) {
                {{ t.forAll(request.groupName ?? '') }}
              }
            }
          </p>
          @if (request.comment !== null) {
            <p class="tb-muted">«{{ request.comment }}»</p>
          }
          <p-selectbutton
            [options]="choices"
            optionLabel="label"
            optionValue="value"
            [allowEmpty]="false"
            [ngModel]="choice()"
            (ngModelChange)="choice.set($event)"
            [ngModelOptions]="{ standalone: true }"
            [ariaLabel]="t.title"
          />
          @if (approving() && request.kind === 'RESCHEDULE') {
            <div class="tb-field">
              <label for="answer-start">{{ t.newTime }}</label>
              <p-datepicker
                inputId="answer-start"
                [(ngModel)]="startsAt"
                [ngModelOptions]="{ standalone: true }"
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
          } @else if (approving() && request.kind === 'CANCEL') {
            @if (request.late) {
              <p class="tb-hint">{{ t.late }}</p>
            }
            <label class="tb-switch" for="answer-charge">
              <p-checkbox
                [(ngModel)]="charge"
                [ngModelOptions]="{ standalone: true }"
                [binary]="true"
                inputId="answer-charge"
              />
              <span>{{ t.charge }}</span>
            </label>
          }
          <div class="tb-field">
            <label for="answer-comment">{{ t.comment }}</label>
            <textarea
              pTextarea
              id="answer-comment"
              rows="2"
              [(ngModel)]="answer"
              [ngModelOptions]="{ standalone: true }"
              maxlength="500"
            ></textarea>
          </div>
        </form>
      }
    </tb-dialog>
  `,
})
export class RequestAnswerDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.answer;
  private readonly api = inject(ScheduleApi);
  private readonly confirm = inject(Confirm);

  readonly visible = model(false);
  readonly request = input<ChangeRequest | null>(null);
  readonly answered = output<ChangeRequest>();

  protected readonly pending = signal(false);
  /** Approve or decline: one confirm button follows the choice. */
  protected readonly choice = signal<'APPROVE' | 'DECLINE'>('APPROVE');
  protected readonly approving = computed(() => this.choice() === 'APPROVE');
  protected readonly choices = [
    { label: T.answer.approve, value: 'APPROVE' },
    { label: T.answer.decline, value: 'DECLINE' },
  ];
  protected readonly startsAt = signal<Date | null>(null);
  protected readonly charge = signal(false);
  protected readonly answer = signal('');
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
        this.choice.set('APPROVE');
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

  protected answerRequest(): void {
    if (this.approving()) {
      this.approve();
    } else {
      this.decline();
    }
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
          void this.moveAnyway();
        } else {
          this.error.set(describeError(error, T.answer.failed));
        }
      },
    });
  }

  /** The teacher is busy at the new time of the move: ask whether to move anyway. */
  private async moveAnyway(): Promise<void> {
    const sure = await this.confirm.safe({
      header: this.t.busyTitle,
      message: this.t.busy,
      acceptLabel: this.t.moveAnyway,
    });
    if (sure) {
      this.approve(true);
    }
  }
}
