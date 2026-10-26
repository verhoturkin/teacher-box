import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import { ScheduledLesson } from '../data-access/schedule.models';
import { STATUS_LABELS, excusedFrom, lessonWith, requestKindLabel } from '../schedule-labels';
import { T } from '../i18n/texts';

/**
 * The lines of a student's lesson under its time: the group, the topic, the status and a request
 * waiting for the teacher — in the row of «Ближайшие занятия».
 */
@Component({
  selector: 'tb-lesson-summary',
  imports: [Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @let item = lesson();
    @if (item.groupId !== null) {
      <span class="tb-list__supporting">{{ with(item) }}</span>
    }
    @if (item.topic !== null) {
      <span class="tb-list__supporting">{{ item.topic }}</span>
    }
    @if (item.status !== 'SCHEDULED') {
      <p-tag [value]="statuses[item.status].label" [severity]="statuses[item.status].severity" />
    }
    @if (excused()) {
      <p-tag [value]="t.excused" severity="secondary" />
    }
    @if (item.pendingRequests[0]; as request) {
      <span class="tb-list__supporting">{{ t.pending(kind(request)) }}</span>
    }
  `,
})
export class LessonSummary {
  protected readonly t = T.summary;
  readonly lesson = input.required<ScheduledLesson>();

  protected readonly with = lessonWith;
  protected readonly kind = requestKindLabel;
  protected readonly statuses = STATUS_LABELS;
  protected readonly excused = computed(() => excusedFrom(this.lesson()));
}
