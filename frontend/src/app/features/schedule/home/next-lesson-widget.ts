import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { injectMobile } from '@core/layout/mobile';
import { Card } from 'primeng/card';
import { MyBoardLinks } from '@features/boards/parts';
import { LessonActions } from '../ui/lesson-actions';
import { ScheduleApi } from '../data-access/schedule-api';
import {
  ChangeKind,
  MyScheduleSummary,
  ScheduleSettings,
  ScheduledLesson,
} from '../data-access/schedule.models';
import { lessonWith, requestKindLabel } from '../schedule-labels';
import { LessonTimeTile } from '../ui/lesson-time-tile';
import { injectLessonClock } from './lesson-clock';
import { ChangeRequestDialog } from '../student/change-request-dialog';
import { Snackbar } from '@core/snackbar/snackbar';
import { EmptyState } from '@shared/ui/empty-state';
import { T } from '../i18n/texts';

/**
 * Student's home: the nearest lesson as a calendar event, as the teacher's card — the time tile, the group
 * (or «Занятие»), the topic and the boards of the lesson as chips, the lessons of the week; the lesson link and a request to move or cancel it
 * (not while it runs) at the end. The title «Ближайшее занятие» is for screen readers only.
 */
@Component({
  selector: 'tb-next-lesson-widget',
  imports: [EmptyState, Card, ChangeRequestDialog, LessonActions, LessonTimeTile, MyBoardLinks],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card styleClass="tb-hero">
      <h2 class="tb-sr-only">{{ t.title }}</h2>
      @if (summary().next; as lesson) {
        <div class="tb-lesson-event">
          @if (time(); as time) {
            <tb-lesson-time-tile [time]="time" />
          }
          <div class="tb-lesson-event__info">
            <strong>{{ lesson.groupId !== null ? with(lesson) : t.lesson }}</strong>
            @if (lesson.topic !== null) {
              <span>{{ lesson.topic }}</span>
            }
            <tb-my-board-links [groupName]="lesson.groupId === null ? null : lesson.groupName" />
            @if (lesson.pendingRequests[0]; as request) {
              <small class="tb-muted">{{ t.requestSent(kind(request)) }}</small>
            }
            <small class="tb-muted">{{ t.week(summary().weekLessons) }}</small>
          </div>
          <div class="tb-lesson-event__actions">
            <tb-lesson-actions
              [joinUrl]="lesson.joinUrl"
              [requests]="lesson.pendingRequests.length === 0 && time()?.phase !== 'live'"
              [group]="lesson.groupId !== null"
              [stacked]="mobile()"
              [hero]="true"
              rescheduleIcon="tb-i tb-i-calendar_month"
              (ask)="ask(lesson, $event)"
            />
          </div>
        </div>
      } @else {
        <tb-empty-state [compact]="true" icon="tb-i-calendar_month" [title]="t.nothing" />
        <div class="tb-widget-footer">
          <span class="tb-muted">{{ t.week(summary().weekLessons) }}</span>
        </div>
      }
    </p-card>

    <tb-change-request-dialog
      [(visible)]="requestVisible"
      [lesson]="summary().next"
      [kind]="requestKind()"
      [lateCancellationMinutes]="settings()?.lateCancellationMinutes ?? 0"
      (sent)="onSent()"
    />
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }

    /* as the teacher's card: the tile, the text, the buttons at the end */
    .tb-lesson-event {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--tb-space-4);
    }

    .tb-lesson-event__info {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--tb-space-1);
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .tb-lesson-event__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: var(--tb-space-2);
    }

    tb-my-board-links:not(:empty) {
      margin-block: var(--tb-space-1);
    }

    tb-lesson-time-tile {
      align-self: stretch;
    }

    /* a phone: the buttons go under the tile and the text, across the width */
    @container (max-width: 40rem) {
      .tb-lesson-event {
        gap: var(--tb-space-3);
      }

      .tb-lesson-event__actions {
        grid-column: 1 / -1;
        display: grid;
        justify-content: stretch;
      }

      tb-lesson-time-tile {
        min-width: 6.5rem;
        padding-inline: var(--tb-space-2);
      }
    }
  `,
})
export class NextLessonWidget implements OnInit {
  protected readonly t = T.next;
  private readonly snackbar = inject(Snackbar);
  protected readonly mobile = injectMobile();
  private readonly api = inject(ScheduleApi);

  readonly summary = input.required<MyScheduleSummary>();
  /** A request was sent, or the lesson is over: the home page reloads the summary. */
  readonly changed = output();

  protected readonly kind = requestKindLabel;
  protected readonly with = lessonWith;
  protected readonly settings = signal<ScheduleSettings | null>(null);
  protected readonly requestVisible = signal(false);
  protected readonly requestKind = signal<ChangeKind>('RESCHEDULE');
  protected readonly time = injectLessonClock(
    computed(() => this.summary().next),
    () => {
      this.changed.emit();
    },
  );

  protected onSent(): void {
    this.snackbar.success(T.next.sent);
    this.changed.emit();
  }

  ngOnInit(): void {
    this.api.settings().subscribe((settings) => {
      this.settings.set(settings);
    });
  }

  ask(lesson: ScheduledLesson, kind: ChangeKind): void {
    if (lesson.pendingRequests.length === 0) {
      this.requestKind.set(kind);
      this.requestVisible.set(true);
    }
  }
}
