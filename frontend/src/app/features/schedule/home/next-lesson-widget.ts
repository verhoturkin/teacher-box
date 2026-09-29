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
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { JoinLessonButton } from '@features/meetings/parts';
import { ScheduleApi } from '../data-access/schedule-api';
import {
  ChangeKind,
  MyScheduleSummary,
  ScheduleSettings,
  ScheduledLesson,
} from '../data-access/schedule.models';
import { formatLessonTime, lessonWith, requestKindLabel } from '../schedule-labels';
import { ChangeRequestDialog } from '../student/change-request-dialog';

/** Student's home: the nearest lesson with the lesson link and a request to move or cancel it. */
@Component({
  selector: 'tb-next-lesson-widget',
  imports: [RouterLink, Button, Card, ChangeRequestDialog, JoinLessonButton],
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
            @if (lesson.joinUrl; as url) {
              <tb-join-lesson-button [url]="url" />
            }
            @if (lesson.pendingRequests.length === 0) {
              <p-button
                label="Перенести"
                icon="pi pi-calendar"
                severity="secondary"
                (onClick)="ask(lesson, 'RESCHEDULE')"
              />
              <p-button
                [label]="lesson.groupId === null ? 'Отменить' : 'Не приду'"
                severity="secondary"
                [text]="true"
                (onClick)="ask(lesson, 'CANCEL')"
              />
            }
          </div>
        </div>
      } @else {
        <p class="tb-muted">Ближайших занятий нет.</p>
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
      (sent)="changed.emit()"
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
  private readonly api = inject(ScheduleApi);

  readonly summary = input.required<MyScheduleSummary>();
  /** A request was sent. */
  readonly changed = output();

  protected readonly kind = requestKindLabel;
  protected readonly with = lessonWith;
  protected readonly settings = signal<ScheduleSettings | null>(null);
  protected readonly requestVisible = signal(false);
  protected readonly requestKind = signal<ChangeKind>('RESCHEDULE');

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
