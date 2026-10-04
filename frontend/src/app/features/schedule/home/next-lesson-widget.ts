import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
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
import { formatLessonTime, lessonWith, requestKindLabel } from '../schedule-labels';
import { ChangeRequestDialog } from '../student/change-request-dialog';
import { Snackbar } from '@core/snackbar/snackbar';
import { EmptyState } from '@shared/ui/empty-state';

/** Student's home: the nearest lesson with the lesson link and a request to move or cancel it. */
@Component({
  selector: 'tb-next-lesson-widget',
  imports: [EmptyState, RouterLink, Card, ChangeRequestDialog, LessonActions],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Ближайшее занятие" styleClass="tb-hero">
      @if (summary().next; as lesson) {
        <div class="tb-next">
          <span class="tb-next__time">{{ time(lesson) }}</span>
          @if (lesson.groupId !== null) {
            <span>{{ with(lesson) }}</span>
          }
          @if (lesson.topic !== null) {
            <span>{{ lesson.topic }}</span>
          }
          @if (lesson.pendingRequests[0]; as request) {
            <small class="tb-muted"
              >{{ kind(request) }}: запрос отправлен, ждём ответа учителя.</small
            >
          }
          <div class="tb-actions">
            <tb-lesson-actions
              [joinUrl]="lesson.joinUrl"
              [requests]="lesson.pendingRequests.length === 0"
              [group]="lesson.groupId !== null"
              [stacked]="mobile()"
              rescheduleIcon="pi pi-calendar"
              (ask)="ask(lesson, $event)"
            />
          </div>
        </div>
      } @else {
        <tb-empty-state [compact]="true" icon="pi-calendar" title="Ближайших занятий нет" />
      }
      <div class="tb-widget-footer">
        <span class="tb-muted">Занятий на неделе: {{ summary().weekLessons }}</span>
        <a routerLink="/cabinet/schedule">Расписание</a>
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
    .tb-next {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
    }

    .tb-next__time {
      font: var(--tb-type-headline-s);
    }
  `,
})
export class NextLessonWidget implements OnInit {
  private readonly snackbar = inject(Snackbar);
  protected readonly mobile = injectMobile();
  private readonly api = inject(ScheduleApi);

  readonly summary = input.required<MyScheduleSummary>();
  /** A request was sent. */
  readonly changed = output();

  protected readonly kind = requestKindLabel;
  protected readonly with = lessonWith;
  protected readonly settings = signal<ScheduleSettings | null>(null);
  protected readonly requestVisible = signal(false);
  protected readonly requestKind = signal<ChangeKind>('RESCHEDULE');

  protected onSent(): void {
    this.snackbar.success('Учитель получит ваш запрос');
    this.changed.emit();
  }

  ngOnInit(): void {
    this.api.settings().subscribe((settings) => {
      this.settings.set(settings);
    });
  }

  protected time(lesson: ScheduledLesson): string {
    return formatLessonTime(lesson.startsAt, lesson.endsAt);
  }

  ask(lesson: ScheduledLesson, kind: ChangeKind): void {
    if (lesson.pendingRequests.length === 0) {
      this.requestKind.set(kind);
      this.requestVisible.set(true);
    }
  }
}
