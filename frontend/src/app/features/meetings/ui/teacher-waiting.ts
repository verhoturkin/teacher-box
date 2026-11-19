import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, interval, of, startWith, switchMap } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';
import { MeetingsApi } from '../data-access/meetings-api';
import { MyCall } from '../data-access/meetings.models';
import { T } from '../i18n/texts';
import { SUMMON_REFRESH_MS } from './call-summon';

/**
 * The student's side of «Позвать»: «Учитель ждёт в звонке» while the teacher is in the portal's room
 * of the lesson — the student's own room, or the group's. Shows nothing otherwise or when the
 * presence is unknown.
 */
@Component({
  selector: 'tb-teacher-waiting',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (present()) {
      <i class="tb-i tb-i-video_call" aria-hidden="true"></i>
      <span role="status">{{ t.teacherWaiting }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      font: var(--tb-type-body-s);
    }

    :host:empty {
      display: none;
    }

    .tb-i {
      font-size: 1.125rem;
    }
  `,
})
export class TeacherWaiting {
  protected readonly t = T.summon;
  private readonly api = inject(MeetingsApi);

  /** The group of the lesson; `null` — the student's own room. */
  readonly groupId = input<string | null>(null);

  private readonly calls = signal<readonly MyCall[]>([]);
  protected readonly present = computed(() => {
    const group = this.groupId();
    return this.calls().some(
      (call) =>
        call.teacherPresent &&
        (group === null ? call.ownerType === 'STUDENT' : call.ownerId === group),
    );
  });

  constructor() {
    interval(SUMMON_REFRESH_MS)
      .pipe(
        startWith(0),
        // only a hint: a failed refresh hides it, never a toast
        switchMap(() => this.api.myCalls(quietContext()).pipe(catchError(() => of([])))),
        takeUntilDestroyed(),
      )
      .subscribe((calls) => {
        this.calls.set(calls);
      });
  }
}
