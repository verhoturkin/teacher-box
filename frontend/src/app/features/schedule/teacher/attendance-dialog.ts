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
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { describeError } from '@core/http/error-messages';
import { ScheduleApi } from '../data-access/schedule-api';
import { AttendanceMark, ScheduledLesson } from '../data-access/schedule.models';
import { formatLessonTime, lessonWith } from '../schedule-labels';

interface MarkOption {
  readonly label: string;
  readonly value: AttendanceMark;
}

/** Choices of the attendance of one student. */
export const MARK_OPTIONS: readonly MarkOption[] = [
  { label: 'Был', value: 'ATTENDED' },
  { label: 'Пропуск', value: 'MISSED' },
  { label: 'Предупредил', value: 'EXCUSED' },
];

/**
 * The teacher marks who came to a group lesson: «Был» and «Пропуск» are charged, «Предупредил»
 * is not. Students who said beforehand that they would not come are marked already.
 */
@Component({
  selector: 'tb-attendance-dialog',
  imports: [FormsModule, Button, Dialog, Message, SelectButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      header="Кто был на занятии"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '34rem' }"
      [draggable]="false"
    >
      @if (lesson(); as lesson) {
        <p class="tb-muted">{{ with(lesson) }}, {{ time() }}</p>
        <ul class="tb-attendance">
          @for (participant of lesson.participants; track participant.studentId) {
            <li>
              <span>{{ participant.studentName ?? 'Ученик' }}</span>
              <p-selectbutton
                [options]="options"
                optionLabel="label"
                optionValue="value"
                [allowEmpty]="false"
                [ngModel]="marks()[participant.studentId]"
                (ngModelChange)="set(participant.studentId, $event)"
                [ariaLabel]="'Посещаемость: ' + (participant.studentName ?? 'ученик')"
                size="small"
              />
            </li>
          }
        </ul>
        <small class="tb-hint"
          >«Был» и «Пропуск» спишутся по цене занятия, «Предупредил» — нет.</small
        >
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      }
      <ng-template #footer>
        <p-button
          label="Отмена"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button
          severity="success"
          label="Сохранить"
          [loading]="pending()"
          [disabled]="!anybody()"
          (onClick)="save()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .tb-attendance {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      margin: 0 0 var(--tb-space-3);
      padding: 0;
      list-style: none;

      li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--tb-space-2);
      }
    }
  `,
})
export class AttendanceDialog {
  private readonly api = inject(ScheduleApi);

  readonly visible = model(false);
  readonly lesson = input<ScheduledLesson | null>(null);
  readonly saved = output<ScheduledLesson>();

  protected readonly options = [...MARK_OPTIONS];
  protected readonly with = lessonWith;
  readonly marks = signal<Readonly<Record<string, AttendanceMark>>>({});
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly time = computed(() => {
    const lesson = this.lesson();
    return lesson === null ? '' : formatLessonTime(lesson.startsAt, lesson.endsAt);
  });
  /** Somebody attended or missed: otherwise the lesson should be cancelled. */
  protected readonly anybody = computed(() =>
    Object.values(this.marks()).some((mark) => mark !== 'EXCUSED'),
  );

  constructor() {
    // Everybody «attended» unless marked otherwise before.
    effect(() => {
      const lesson = this.lesson();
      if (this.visible() && lesson !== null) {
        this.error.set(null);
        this.marks.set(
          Object.fromEntries(
            lesson.participants.map((participant) => [
              participant.studentId,
              participant.attendance === 'EXPECTED' ? 'ATTENDED' : participant.attendance,
            ]),
          ),
        );
      }
    });
  }

  set(studentId: string, mark: AttendanceMark): void {
    this.marks.update((marks) => ({ ...marks, [studentId]: mark }));
  }

  save(): void {
    const lesson = this.lesson();
    if (lesson === null || this.pending() || !this.anybody()) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api.markAttendance(lesson.id, this.marks()).subscribe({
      next: (saved) => {
        this.pending.set(false);
        this.visible.set(false);
        this.saved.emit(saved);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, 'Не удалось сохранить отметки'));
      },
    });
  }
}
