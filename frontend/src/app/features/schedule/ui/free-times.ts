import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toIsoDate } from '@shared/dates/iso-date';
import { AssistChip } from '@shared/ui/assist-chip';
import { ScheduleApi } from '../data-access/schedule-api';
import { T } from '../i18n/texts';
import { toTime } from '../teacher/lesson-time';

/**
 * Free start times of a day as chips to move a lesson to; the date picker stays for any other time.
 * Nothing is drawn when the day has no free time.
 */
@Component({
  selector: 'tb-free-times',
  imports: [AssistChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (times().length > 0) {
      <div class="tb-free-times" role="group" [attr.aria-label]="t.label">
        @for (time of times(); track time) {
          <tb-assist-chip (click)="picked.emit(time)">{{ label(time) }}</tb-assist-chip>
        }
      </div>
    }
  `,
  styles: `
    .tb-free-times {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }
  `,
})
export class FreeTimes {
  protected readonly t = T.freeTimes;
  private readonly api = inject(ScheduleApi);

  readonly lessonId = input.required<string>();
  readonly date = input.required<Date>();
  /** The teacher's endpoint (any lesson) or the student's (own lessons). */
  readonly asTeacher = input(false);
  readonly picked = output<Date>();

  protected readonly times = signal<Date[]>([]);

  constructor() {
    effect((onCleanup) => {
      const day = toIsoDate(this.date());
      const subscription = this.api.freeTimes(this.lessonId(), day, this.asTeacher()).subscribe({
        next: (times) => {
          this.times.set(times.map((time) => new Date(time)));
        },
        error: () => {
          this.times.set([]);
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
  }

  protected label(time: Date): string {
    return toTime(time);
  }
}
