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
 * Student's home: the nearest lesson as a calendar event — the time tile, the group and the topic — with
 * the lesson link and a request to move or cancel it (not while it runs).
 */
@Component({
  selector: 'tb-next-lesson-widget',
  imports: [EmptyState, Card, ChangeRequestDialog, LessonActions, LessonTimeTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title" styleClass="tb-hero">
      @if (summary().next; as lesson) {
        <div class="tb-lesson-event">
          @if (time(); as time) {
            <tb-lesson-time-tile [time]="time" />
          }
          <div class="tb-lesson-event__info">
            @if (lesson.groupId !== null) {
              <strong>{{ with(lesson) }}</strong>
            }
            @if (lesson.topic !== null) {
              <span>{{ lesson.topic }}</span>
            }
            @if (lesson.pendingRequests[0]; as request) {
              <small class="tb-muted">{{ t.requestSent(kind(request)) }}</small>
            }
          </div>
        </div>
        <div class="tb-actions">
          <tb-lesson-actions
            [joinUrl]="lesson.joinUrl"
            [requests]="lesson.pendingRequests.length === 0 && time()?.phase !== 'live'"
            [group]="lesson.groupId !== null"
            [stacked]="mobile()"
            rescheduleIcon="pi pi-calendar"
            (ask)="ask(lesson, $event)"
          />
        </div>
      } @else {
        <tb-empty-state [compact]="true" icon="pi-calendar" [title]="t.nothing" />
      }
      <div class="tb-widget-footer">
        <span class="tb-muted">{{ t.week(summary().weekLessons) }}</span>
      </div>
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
    .tb-lesson-event {
      display: flex;
      align-items: center;
      gap: var(--tb-space-4);
    }

    .tb-lesson-event__info {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
      min-width: 0;
      overflow-wrap: anywhere;
    }

    tb-lesson-time-tile {
      align-self: stretch;
    }

    .tb-actions {
      margin-top: var(--tb-space-4);
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
