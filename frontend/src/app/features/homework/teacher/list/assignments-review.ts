import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { injectWindowSize } from '@core/layout/mobile';
import { TeacherColors } from '@features/identity/parts';
import { Avatar } from '@shared/ui/avatar';
import { ReviewQueueItem } from '@features/homework/data-access/homework.models';
import { handedIn } from '@features/homework/homework-labels';
import { T } from '@features/homework/i18n/texts';

/** How many works of the review strip show their own card; the rest go to «Проверить все подряд». */
const SHOWN_WORKS = 3;

/** Medium shows two cards in the strip (sketch 17). */
const SHOWN_WORKS_MEDIUM = 2;

/**
 * «Ждут проверки» of the homework list: the latest works handed in as cards, «Проверить» opens one,
 * «Проверить все подряд» starts the queue; a dashed card counts the works still to be handed in.
 */
@Component({
  selector: 'tb-assignments-review',
  imports: [Avatar, Button, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <section class="tb-hw__review" [attr.aria-label]="t.awaiting(works().length)">
      <div class="tb-hw__review-head">
        <h2 class="tb-hw__label">{{ t.awaiting(works().length) }}</h2>
        <p-button
          [label]="t.checkAll"
          icon="tb-i tb-i-arrow_forward"
          iconPos="right"
          [text]="true"
          (onClick)="reviewAll.emit()"
        />
      </div>
      <ul class="tb-hw__cards">
        @for (work of shownWorks(); track work.taskId) {
          <li class="tb-hw__card">
            <div class="tb-hw__card-head">
              <tb-avatar
                [attr.data-tb-label]="colors.studentLabel(work.studentId)"
                [name]="work.studentName"
                [photo]="work.studentAvatar"
              />
              <div class="tb-list__text">
                <span class="tb-list__title">{{ work.studentName }}</span>
                <span class="tb-list__supporting">{{ handedIn(work) }}</span>
              </div>
              @if (isLate(work)) {
                <p-tag [value]="t.lateTag" severity="danger" />
              }
            </div>
            <span class="tb-hw__card-task">{{ work.title }}</span>
            <div class="tb-hw__card-foot">
              @if (work.quizScore !== null && work.quizMax !== null) {
                <p-tag [value]="t.quizScore(work.quizScore, work.quizMax)" severity="secondary" />
              }
              <p-button
                class="tb-hw__card-action"
                [label]="t.check"
                severity="secondary"
                [ariaLabel]="t.reviewOf(work.studentName, work.title)"
                (onClick)="review.emit(work.taskId)"
              />
            </div>
          </li>
        }
        @if (waiting() > 0) {
          <li class="tb-hw__card tb-hw__card--waiting">
            <i class="tb-i tb-i-hourglass_top" aria-hidden="true"></i>
            {{ t.stillWaiting(waiting()) }}
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    /* a label over a block (M3 \`label medium\`, upper case) */
    .tb-hw__label {
      margin: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .tb-hw__review {
      margin-block-end: var(--tb-space-5);
    }

    /* the label and «Проверить все подряд» stay one line each, a phone too (sketch 5) */
    .tb-hw__review-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-3);
      margin-block-end: var(--tb-space-2);
      white-space: nowrap;
    }

    /* the cards lie in a row; on a phone the row scrolls sideways */
    .tb-hw__cards {
      display: flex;
      gap: var(--tb-space-3);
      margin: 0;
      padding: 0;
      overflow-x: auto;
      list-style: none;
      scrollbar-width: none;
    }

    .tb-hw__cards::-webkit-scrollbar {
      display: none;
    }

    .tb-hw__card {
      display: flex;
      flex: 1 1 15rem;
      flex-direction: column;
      gap: var(--tb-space-3);
      min-inline-size: 15rem;
      max-inline-size: 22rem;
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--tb-list-item);
    }

    @media (width < 37.5em) {
      .tb-hw__card {
        flex: 0 0 15rem;
      }
    }

    .tb-hw__card--waiting {
      align-items: center;
      justify-content: center;
      border: 1px dashed var(--p-md-outline-variant);
      background: none;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
      text-align: center;
    }

    .tb-hw__card-head {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
    }

    .tb-hw__card-head .tb-list__text {
      flex: 1;
      min-inline-size: 0;
    }

    /* sketch 1: the name and the title are one line each, cut with «…» however long */
    .tb-hw__card-head .tb-list__title,
    .tb-hw__card-task {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tb-hw__card-task {
      font: var(--tb-type-title-s);
    }

    .tb-hw__card-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-2);
      margin-block-start: auto;
    }

    .tb-hw__card-action {
      margin-inline-start: auto;
    }
  `,
})
export class AssignmentsReview {
  protected readonly t = T.list;
  protected readonly colors = inject(TeacherColors);
  private readonly dates = new DatePipe(inject(LOCALE_ID));
  private readonly size = injectWindowSize();

  /** The works handed in, waiting for review, oldest first. */
  readonly works = input.required<readonly ReviewQueueItem[]>();
  /** Works somebody still has to hand in (or hand in again). */
  readonly waiting = input.required<number>();
  /** The moment the lists were read. */
  readonly now = input.required<number>();
  readonly review = output<string>();
  readonly reviewAll = output();

  protected readonly shownWorks = computed(() =>
    this.works().slice(0, this.size() === 'medium' ? SHOWN_WORKS_MEDIUM : SHOWN_WORKS),
  );

  protected handedIn(work: ReviewQueueItem): string {
    return work.submittedAt === null ? '' : handedIn(work.submittedAt, this.now(), this.dates);
  }

  /** Handed in after the due date. */
  protected isLate(work: ReviewQueueItem): boolean {
    return work.dueAt !== null && work.submittedAt !== null && work.submittedAt > work.dueAt;
  }
}
