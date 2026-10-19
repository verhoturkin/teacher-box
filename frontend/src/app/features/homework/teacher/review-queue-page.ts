import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { HomeworkApi } from '../data-access/homework-api';
import { ReviewQueueItem } from '../data-access/homework.models';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { Avatar } from '@shared/ui/avatar';
import { TeacherColors } from '@features/identity/parts';
import { T } from '../i18n/texts';

/** Teacher: submitted tasks waiting for review, oldest first — a card per work. */
@Component({
  selector: 'tb-review-queue-page',
  imports: [Avatar, EmptyState, RouterLink, Card, PageHeader, HelpButton, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title" back="/teacher/homework" [backLabel]="t.back">
      <tb-help-button help topic="teacher/homework" />
    </tb-page-header>
    <p-card>
      <h2 class="tb-sr-only">{{ t.title }}</h2>
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
        @if (items().length > 0) {
          <ul class="tb-list" [attr.aria-label]="t.title">
            @for (item of items(); track item.taskId) {
              <li [attr.data-tb-label]="colors.studentLabel(item.studentId)">
                <tb-avatar [name]="item.studentName" [photo]="item.studentAvatar" />
                <div class="tb-list__text">
                  <a
                    class="tb-list__title tb-link"
                    [routerLink]="['/teacher/homework/tasks', item.taskId]"
                    [attr.aria-label]="t.reviewOf(item.studentName, item.title)"
                    >{{ item.studentName }}</a
                  >
                  <span class="tb-list__supporting">{{ details(item) }}</span>
                </div>
              </li>
            }
          </ul>
        } @else {
          <tb-empty-state icon="tb-i-check_circle" [title]="t.emptyTitle" [hint]="t.emptyHint" />
        }
      </tb-load-state>
    </p-card>
  `,
})
export class ReviewQueuePage implements OnInit {
  protected readonly t = T.queue;
  protected readonly colors = inject(TeacherColors);
  private readonly api = inject(HomeworkApi);
  private readonly dates = new DatePipe(inject(LOCALE_ID));

  protected readonly items = signal<ReviewQueueItem[]>([]);
  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .reviewQueue()
      .pipe(this.state.track())
      .subscribe((items) => {
        this.items.set(items);
      });
  }

  /** «Дроби · сдано 12.10.2026 18:00 · срок 13.10.2026 18:00». */
  protected details(item: ReviewQueueItem): string {
    return [
      item.title,
      item.submittedAt === null ? null : T.queue.submittedAt(this.date(item.submittedAt)),
      item.dueAt === null ? null : T.queue.until(this.date(item.dueAt)),
    ]
      .filter((part) => part !== null)
      .join(' · ');
  }

  private date(value: string): string {
    return this.dates.transform(value, 'dd.MM.yyyy HH:mm') ?? '';
  }
}
