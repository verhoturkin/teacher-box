import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ScheduleApi } from '../data-access/schedule-api';
import { ChangeKind, MyScheduleSummary, ScheduleSettings, ScheduledLesson } from '../data-access/schedule.models';
import { KIND_LABELS, formatLessonTime } from '../schedule-labels';
import { ChangeRequestDialog } from '../student/change-request-dialog';

/** Student's home: the nearest lesson with the lesson link and a request to move or cancel it. */
@Component({
  selector: 'tb-next-lesson-widget',
  imports: [RouterLink, Button, Card, ChangeRequestDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Ближайшее занятие">
      @if (summary().next; as lesson) {
        <div class="tb-next">
          <span class="tb-next__time">{{ time(lesson) }}</span>
          @if (lesson.topic !== null) {
            <span>{{ lesson.topic }}</span>
          }
          @if (lesson.pendingRequest; as request) {
            <small class="tb-muted">{{ kinds[request.kind] }}: запрос отправлен, ждём ответа учителя.</small>
          }
          <div class="tb-actions">
            @if (lesson.meetingUrl !== null) {
              <a class="p-button tb-next__join" [href]="lesson.meetingUrl" target="_blank" rel="noopener">
                <i class="pi pi-video" aria-hidden="true"></i>
                <span>Войти в урок</span>
              </a>
            }
            @if (lesson.pendingRequest === null) {
              <p-button label="Перенести" icon="pi pi-calendar" [outlined]="true" (onClick)="ask(lesson, 'RESCHEDULE')" />
              <p-button label="Отменить" severity="secondary" [text]="true" (onClick)="ask(lesson, 'CANCEL')" />
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
      gap: 0.5rem;
    }

    .tb-next__time {
      font-size: 1.25rem;
      font-weight: 600;
    }

    .tb-next__join {
      display: inline-flex;
      gap: 0.5rem;
      text-decoration: none;
    }
  `,
})
export class NextLessonWidget implements OnInit {
  private readonly api = inject(ScheduleApi);

  readonly summary = input.required<MyScheduleSummary>();
  /** A request was sent. */
  readonly changed = output();

  protected readonly kinds = KIND_LABELS;
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
    if (lesson.pendingRequest === null) {
      this.requestKind.set(kind);
      this.requestVisible.set(true);
    }
  }
}
