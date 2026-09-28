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
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { OwnerBoardLinks } from '@features/boards/parts';
import { JoinLessonButton } from '@features/meetings/parts';
import { describeError } from '@core/http/error-messages';
import { problemCode } from '@core/http/problem-detail';
import { Observable } from 'rxjs';
import { ScheduleApi } from '../data-access/schedule-api';
import { LessonOutcome, ScheduledLesson } from '../data-access/schedule.models';
import {
  ATTENDANCE_LABELS,
  STATUS_LABELS,
  formatLessonStart,
  formatLessonTime,
  lessonWith,
  requestKindLabel,
} from '../schedule-labels';
import { AttendanceDialog } from './attendance-dialog';

/**
 * A lesson with the teacher's actions: change it, mark the outcome (the attendance of a group) after
 * it has started, withdraw the outcome, cancel it (a lesson with one student also on the student's
 * behalf, optionally charged as a missed lesson), restore a cancelled one or delete one that was not
 * held.
 */
@Component({
  selector: 'tb-lesson-details-dialog',
  imports: [
    FormsModule,
    Button,
    Checkbox,
    Dialog,
    Message,
    Tag,
    Textarea,
    AttendanceDialog,
    JoinLessonButton,
    OwnerBoardLinks,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      header="Занятие"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '32rem' }"
      [draggable]="false"
    >
      @if (lesson(); as lesson) {
        <div class="tb-lesson-details">
          <div class="tb-lesson-details__head">
            <strong>{{ with(lesson) }}</strong>
            <p-tag [value]="statusLabel().label" [severity]="statusLabel().severity" />
          </div>
          <div>{{ time() }}</div>
          @if (lesson.originalStartsAt !== null) {
            <small class="tb-muted">Перенесено с {{ start(lesson.originalStartsAt) }}</small>
          }
          @if (lesson.topic !== null) {
            <div>Тема: {{ lesson.topic }}</div>
          }
          @if (lesson.joinUrl; as url) {
            <div>
              <tb-join-lesson-button
                [url]="url"
                label="Начать урок"
                [teacher]="true"
                [small]="true"
              />
            </div>
          }
          @if (visible()) {
            <tb-owner-board-links [ownerIds]="[lesson.groupId ?? lesson.studentId]" />
          }
          @if (lesson.cancelReason !== null) {
            <div class="tb-muted">Причина отмены: {{ lesson.cancelReason }}</div>
          }
          @if (lesson.groupId !== null) {
            <ul class="tb-lesson-details__participants">
              @for (participant of lesson.participants; track participant.studentId) {
                <li>
                  <span>{{ participant.studentName ?? 'Ученик' }}</span>
                  @if (participant.attendance !== 'EXPECTED') {
                    <p-tag
                      [value]="attendance[participant.attendance].label"
                      [severity]="attendance[participant.attendance].severity"
                    />
                  }
                </li>
              }
            </ul>
          }
          @for (request of lesson.pendingRequests; track request.id) {
            <div class="tb-lesson-details__request">
              {{ lesson.groupId === null ? 'Запрос ученика' : (request.studentName ?? 'Ученик') }}:
              {{ kind(request) }}
              @if (request.proposedStartsAt !== null) {
                на {{ start(request.proposedStartsAt) }}
              }
              @if (request.comment !== null) {
                — «{{ request.comment }}»
              }
            </div>
          }
        </div>

        @if (deleting()) {
          <p-message severity="warn" styleClass="tb-lesson-details__cancel">
            Занятие исчезнет из расписания, календарей и отчётов.
            @if (lesson.status === 'SCHEDULED') {
              Ученику придёт уведомление, что занятие отменено.
            }
          </p-message>
        }
        @if (overlap()) {
          <p-message severity="warn" styleClass="tb-lesson-details__cancel">
            В это время уже есть другое занятие.
            <p-button
              label="Всё равно восстановить"
              [link]="true"
              size="small"
              (onClick)="restore(true)"
            />
          </p-message>
        }
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-lesson-details__cancel">{{
            message
          }}</p-message>
        }
        @if (cancelling()) {
          <div class="tb-form tb-lesson-details__cancel">
            <label for="lesson-cancel-reason">Причина</label>
            <textarea
              pTextarea
              id="lesson-cancel-reason"
              rows="2"
              [(ngModel)]="reason"
              maxlength="500"
            ></textarea>
            @if (lesson.groupId === null) {
              <label class="tb-switch" for="lesson-cancel-by-student">
                <p-checkbox
                  [(ngModel)]="byStudent"
                  [binary]="true"
                  inputId="lesson-cancel-by-student"
                />
                <span>По просьбе ученика</span>
              </label>
            }
            @if (byStudent()) {
              <label class="tb-switch" for="lesson-cancel-charge">
                <p-checkbox [(ngModel)]="charge" [binary]="true" inputId="lesson-cancel-charge" />
                <span>Засчитать как пропуск (оплачивается)</span>
              </label>
            }
          </div>
        }
      }
      <ng-template #footer>
        @if (lesson(); as lesson) {
          @if (deleting()) {
            <p-button
              label="Назад"
              severity="secondary"
              [text]="true"
              (onClick)="deleting.set(false)"
            />
            <p-button
              label="Удалить занятие"
              severity="danger"
              [loading]="pending()"
              (onClick)="deleteLesson()"
            />
          } @else if (cancelling()) {
            <p-button
              label="Назад"
              severity="secondary"
              [text]="true"
              (onClick)="cancelling.set(false)"
            />
            <p-button
              label="Отменить занятие"
              severity="danger"
              [loading]="pending()"
              (onClick)="cancel()"
            />
          } @else {
            @if (deletable()) {
              <p-button
                label="Удалить"
                icon="pi pi-trash"
                severity="danger"
                [text]="true"
                (onClick)="deleting.set(true)"
              />
            }
            @if (lesson.status === 'CANCELLED') {
              <p-button
                label="Восстановить"
                icon="pi pi-replay"
                [loading]="pending()"
                (onClick)="restore()"
              />
            }
            @if (lesson.status === 'SCHEDULED') {
              <p-button
                label="Отменить"
                severity="danger"
                [text]="true"
                (onClick)="cancelling.set(true)"
              />
              <p-button
                label="Изменить"
                severity="secondary"
                [outlined]="true"
                (onClick)="editLesson()"
              />
            }
            @if (lesson.status === 'CONDUCTED' || lesson.status === 'MISSED') {
              <p-button
                label="Снять отметку"
                severity="secondary"
                [text]="true"
                [loading]="pending()"
                (onClick)="reopen()"
              />
            }
            @if (started() && lesson.status !== 'CANCELLED' && lesson.groupId !== null) {
              <p-button
                label="Отметить посещаемость"
                icon="pi pi-users"
                (onClick)="attendanceVisible.set(true)"
              />
            } @else if (started() && lesson.status !== 'CANCELLED') {
              @if (lesson.status !== 'MISSED') {
                <p-button
                  label="Пропуск"
                  severity="warn"
                  [outlined]="true"
                  [loading]="pending()"
                  (onClick)="mark('MISSED')"
                />
              }
              @if (lesson.status !== 'CONDUCTED') {
                <p-button
                  label="Проведено"
                  severity="success"
                  [loading]="pending()"
                  (onClick)="mark('CONDUCTED')"
                />
              }
            }
          }
        }
      </ng-template>
    </p-dialog>

    <tb-attendance-dialog
      [(visible)]="attendanceVisible"
      [lesson]="lesson()"
      (saved)="onMarked($event)"
    />
  `,
  styles: `
    .tb-lesson-details {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
    }

    .tb-lesson-details__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-4);
    }

    .tb-lesson-details__participants {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--tb-space-2);
      }
    }

    .tb-lesson-details__request {
      padding: var(--tb-space-2) var(--tb-space-3);
      border-radius: var(--p-border-radius-md);
      background: var(--p-highlight-background);
    }

    .tb-lesson-details__cancel {
      margin-top: var(--tb-space-4);
    }
  `,
})
export class LessonDetailsDialog {
  private readonly api = inject(ScheduleApi);

  readonly visible = model(false);
  readonly lesson = input<ScheduledLesson | null>(null);
  /** Current time, for deciding whether the outcome can be marked. */
  readonly now = input<Date>(new Date());
  readonly changed = output<ScheduledLesson>();
  /** The lesson was deleted. */
  readonly deleted = output<string>();
  readonly edit = output<ScheduledLesson>();

  protected readonly kind = requestKindLabel;
  protected readonly with = lessonWith;
  protected readonly attendance = ATTENDANCE_LABELS;
  protected readonly attendanceVisible = signal(false);
  protected readonly pending = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly deleting = signal(false);
  protected readonly overlap = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Not held and nobody charged: planned, or cancelled without a charge (that one is «missed»). */
  protected readonly deletable = computed(() => {
    const lesson = this.lesson();
    return (
      lesson !== null &&
      (lesson.status === 'SCHEDULED' || lesson.status === 'CANCELLED') &&
      lesson.participants.every((participant) => participant.attendance !== 'MISSED')
    );
  });
  protected readonly reason = signal('');
  protected readonly byStudent = signal(false);
  protected readonly charge = signal(false);
  protected readonly statusLabel = computed(
    () => STATUS_LABELS[this.lesson()?.status ?? 'SCHEDULED'],
  );
  protected readonly time = computed(() => {
    const lesson = this.lesson();
    return lesson === null ? '' : formatLessonTime(lesson.startsAt, lesson.endsAt);
  });
  protected readonly started = computed(() => {
    const lesson = this.lesson();
    return lesson !== null && new Date(lesson.startsAt) <= this.now();
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.cancelling.set(false);
        this.deleting.set(false);
        this.overlap.set(false);
        this.error.set(null);
        this.reason.set('');
        this.byStudent.set(false);
        this.charge.set(false);
      }
    });
  }

  protected start(iso: string): string {
    return formatLessonStart(iso);
  }

  editLesson(): void {
    const lesson = this.lesson();
    if (lesson !== null) {
      this.visible.set(false);
      this.edit.emit(lesson);
    }
  }

  mark(outcome: LessonOutcome): void {
    this.run((lesson) => this.api.setOutcome(lesson.id, outcome));
  }

  onMarked(lesson: ScheduledLesson): void {
    this.visible.set(false);
    this.changed.emit(lesson);
  }

  reopen(): void {
    this.run((lesson) => this.api.reopen(lesson.id));
  }

  cancel(): void {
    const reason = this.reason().trim();
    this.run((lesson) =>
      this.api.cancel(lesson.id, {
        reason: reason === '' ? null : reason,
        byStudent: this.byStudent(),
        charge: this.byStudent() && this.charge(),
      }),
    );
  }

  deleteLesson(): void {
    const lesson = this.lesson();
    if (lesson === null || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.api.deleteLesson(lesson.id).subscribe({
      next: () => {
        this.pending.set(false);
        this.visible.set(false);
        this.deleted.emit(lesson.id);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  restore(allowOverlap = false): void {
    const lesson = this.lesson();
    if (lesson === null || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.overlap.set(false);
    this.error.set(null);
    this.api.restore(lesson.id, allowOverlap).subscribe({
      next: (restored) => {
        this.pending.set(false);
        this.visible.set(false);
        this.changed.emit(restored);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        if (problemCode(error) === 'schedule.overlap') {
          this.overlap.set(true);
        } else {
          this.error.set(describeError(error, 'Не удалось восстановить занятие'));
        }
      },
    });
  }

  private run(action: (lesson: ScheduledLesson) => Observable<ScheduledLesson>): void {
    const lesson = this.lesson();
    if (lesson === null || this.pending()) {
      return;
    }
    this.pending.set(true);
    action(lesson).subscribe({
      next: (updated) => {
        this.pending.set(false);
        this.visible.set(false);
        this.changed.emit(updated);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }
}
