import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Snackbar } from '@core/snackbar/snackbar';
import { ScheduleApi } from './schedule-api';
import { AttendanceMark, ScheduledLesson } from './schedule.models';
import { T } from '../i18n/texts';

/**
 * Marking a lesson needs no confirmation: the result is told in a snackbar with «Отменить», which puts the
 * state the lesson had before back through the same correction endpoints (the backend revokes the charge).
 */
@Injectable({ providedIn: 'root' })
export class LessonMarkUndo {
  private readonly api = inject(ScheduleApi);
  private readonly snackbar = inject(Snackbar);

  /** `before` is the lesson as it was, `after` — as the server saved it; `restored` runs once it is back. */
  offer(
    before: ScheduledLesson,
    after: ScheduledLesson,
    restored: (lesson: ScheduledLesson) => void,
  ): void {
    this.snackbar.undoable(this.message(after), () => {
      this.undo(before).subscribe(restored);
    });
  }

  private message(after: ScheduledLesson): string {
    return after.status === 'MISSED' ? T.page.markedMissed : T.page.markedConducted;
  }

  private undo(before: ScheduledLesson): Observable<ScheduledLesson> {
    if (before.status === 'SCHEDULED') {
      return this.api.reopen(before.id);
    }
    if (before.groupId !== null) {
      const marks: Record<string, AttendanceMark> = {};
      for (const participant of before.participants) {
        if (participant.attendance !== 'EXPECTED') {
          marks[participant.studentId] = participant.attendance;
        }
      }
      return this.api.markAttendance(before.id, marks);
    }
    return this.api.setOutcome(before.id, before.status === 'MISSED' ? 'MISSED' : 'CONDUCTED');
  }
}
