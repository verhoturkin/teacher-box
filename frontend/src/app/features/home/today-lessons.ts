import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { locale } from '@core/i18n/language';
import { STATUS_LABELS, lessonWith } from '@features/schedule/parts';
import type { ScheduledLesson } from '@features/schedule/parts';
import { Avatar } from '@shared/ui/avatar';
import { T } from './i18n/texts';

const TIME = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' });

/** Spec §6: «Занятия сегодня» under the hero — time, avatar, name, topic, status; the next one is selected. */
@Component({
  selector: 'tb-today-lessons',
  imports: [Card, Tag, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      <ul class="tb-list">
        @for (lesson of lessons(); track lesson.id) {
          <li class="tb-today-lesson" [class.tb-today-lesson--next]="lesson.id === nextId()">
            <time class="tb-today-lesson__time" [attr.datetime]="lesson.startsAt">{{
              time(lesson)
            }}</time>
            <tb-avatar [name]="with(lesson)" [photo]="lesson.studentAvatar" />
            <div class="tb-list__text">
              <span class="tb-list__title">{{ with(lesson) }}</span>
              @if (lesson.topic !== null) {
                <span class="tb-list__supporting">{{ lesson.topic }}</span>
              }
            </div>
            @if (lesson.id === nextId()) {
              <p-tag [value]="t.next" />
            } @else {
              <p-tag
                [value]="status(lesson).label"
                [severity]="status(lesson).severity ?? undefined"
              />
            }
          </li>
        }
      </ul>
    </p-card>
  `,
  styles: `
    .tb-today-lesson {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      padding: var(--tb-space-2);
      border-radius: var(--tb-shape-medium, 0.75rem);
    }

    .tb-today-lesson--next {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    .tb-today-lesson__time {
      font: var(--tb-type-label-l);
      min-width: 3rem;
      font-variant-numeric: tabular-nums;
    }

    .tb-list__text {
      flex: 1;
      min-width: 0;
    }
  `,
})
export class TodayLessons {
  protected readonly t = T.todayLessons;
  /** Lessons of today, cancelled ones included. */
  readonly all = input.required<readonly ScheduledLesson[]>();
  /** The nearest lesson that has not ended: it is the selected row. */
  readonly next = input<ScheduledLesson | null>(null);

  protected readonly lessons = computed(() =>
    [...this.all()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  );
  protected readonly nextId = computed(() => this.next()?.id ?? null);
  protected readonly with = lessonWith;

  protected time(lesson: ScheduledLesson): string {
    return TIME.format(new Date(lesson.startsAt));
  }

  protected status(lesson: ScheduledLesson): (typeof STATUS_LABELS)[keyof typeof STATUS_LABELS] {
    return STATUS_LABELS[lesson.status];
  }
}
