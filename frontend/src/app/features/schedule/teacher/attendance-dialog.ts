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
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { EMPTY } from 'rxjs';
import { ScheduleApi } from '../data-access/schedule-api';
import { AttendanceMark, ScheduledLesson } from '../data-access/schedule.models';
import { formatLessonTime, lessonWith } from '../schedule-labels';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';

interface MarkOption {
  readonly label: string;
  readonly value: AttendanceMark;
}

/** Choices of the attendance of one student. */
export const MARK_OPTIONS: readonly MarkOption[] = [
  { label: T.attendance.ATTENDED, value: 'ATTENDED' },
  { label: T.attendance.MISSED, value: 'MISSED' },
  { label: T.attendance.EXCUSED, value: 'EXCUSED' },
];

/**
 * The teacher marks who came to a group lesson: «Был» and «Пропуск» are charged, «Предупредил»
 * is not. Students who said beforehand that they would not come are marked already.
 */
@Component({
  selector: 'tb-attendance-dialog',
  imports: [FormsModule, Message, SelectButton, TbDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="t.title"
      [confirmLabel]="c.save"
      formId="attendance-form"
      [pending]="submit.pending()"
      [error]="submit.error()"
    >
      @if (lesson(); as lesson) {
        <form id="attendance-form" (ngSubmit)="save()">
          <p class="tb-muted">{{ with(lesson) }}, {{ time() }}</p>
          <ul class="tb-attendance">
            @for (participant of lesson.participants; track participant.studentId) {
              <li>
                <span>{{ participant.studentName ?? c.student }}</span>
                <p-selectbutton
                  [options]="options"
                  optionLabel="label"
                  optionValue="value"
                  [allowEmpty]="false"
                  [ngModel]="marks()[participant.studentId]"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="set(participant.studentId, $event)"
                  [ariaLabel]="t.of(participant.studentName ?? t.student)"
                />
              </li>
            }
          </ul>
          <small class="tb-hint">{{ t.hint }}</small>
          @if (!anybody()) {
            <p-message severity="warn" styleClass="tb-form-message">{{ t.nobody }}</p-message>
          }
        </form>
      }
    </tb-dialog>
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
  protected readonly c = SHARED_T.common;
  protected readonly t = T.attendanceDialog;
  private readonly api = inject(ScheduleApi);

  readonly visible = model(false);
  readonly lesson = input<ScheduledLesson | null>(null);
  readonly saved = output<ScheduledLesson>();

  protected readonly options = [...MARK_OPTIONS];
  protected readonly with = lessonWith;
  readonly marks = signal<Readonly<Record<string, AttendanceMark>>>({});
  protected readonly time = computed(() => {
    const lesson = this.lesson();
    return lesson === null ? '' : formatLessonTime(lesson.startsAt, lesson.endsAt);
  });
  /** Somebody attended or missed: otherwise the lesson should be cancelled. */
  protected readonly anybody = computed(() =>
    Object.values(this.marks()).some((mark) => mark !== 'EXCUSED'),
  );

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    // Everybody «attended» unless marked otherwise before.
    reset: () => {
      const lesson = this.lesson();
      this.marks.set(
        Object.fromEntries(
          (lesson?.participants ?? []).map((participant) => [
            participant.studentId,
            participant.attendance === 'EXPECTED' ? 'ATTENDED' : participant.attendance,
          ]),
        ),
      );
    },
    failed: T.attendanceDialog.failed,
    request: () => {
      const lesson = this.lesson();
      return lesson === null ? EMPTY : this.api.markAttendance(lesson.id, this.marks());
    },
    done: (saved) => {
      this.saved.emit(saved);
    },
  });

  set(studentId: string, mark: AttendanceMark): void {
    this.marks.update((marks) => ({ ...marks, [studentId]: mark }));
  }

  save(): void {
    if (this.anybody()) {
      this.submit.run();
    }
  }
}
