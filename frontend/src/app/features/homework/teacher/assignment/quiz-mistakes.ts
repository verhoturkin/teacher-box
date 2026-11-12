import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { QuizStats } from '@features/homework/data-access/homework.models';
import { T } from '@features/homework/i18n/texts';

/**
 * The mistakes of an assignment's test by question: the number, a bar of the share of students who got it
 * wrong and the count.
 */
@Component({
  selector: 'tb-quiz-mistakes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <section class="tb-asg__side">
      <h2 class="tb-asg__label">{{ tq.stats }}</h2>
      @if (stats().students === 0) {
        <p class="tb-muted">{{ tq.statsNone }}</p>
      } @else {
        <ol class="tb-asg-stats">
          @for (q of stats().questions; track q.questionId; let n = $index) {
            <li class="tb-asg-stats__row" [attr.title]="plain(q.text)">
              <span class="tb-asg-stats__n">{{ n + 1 }}</span>
              <span class="tb-asg-stats__bar" aria-hidden="true"
                ><span [style.inline-size.%]="(q.wrong / stats().students) * 100"></span
              ></span>
              <span class="tb-asg-stats__count">{{ tq.statsRow(q.wrong, stats().students) }}</span>
            </li>
          }
        </ol>
      }
    </section>
  `,
  styles: `
    /* a label over a block on the pane's surface (M3 label medium, as «Ждут сдачи» in the list) */
    .tb-asg__label {
      margin: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .tb-asg__side {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      padding: var(--tb-space-4);
      border-radius: 20px;
      background: var(--p-md-surface-container-low);
    }

    /* the mistakes of a question: the number, a bar of the share of students and the count (our decision) */
    .tb-asg-stats {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-asg-stats__row {
      display: grid;
      grid-template-columns: 2rem minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--tb-space-3);
    }

    .tb-asg-stats__n,
    .tb-asg-stats__count {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      white-space: nowrap;
    }

    .tb-asg-stats__bar {
      block-size: 8px;
      border-radius: var(--tb-shape-full, 999px);
      background: var(--p-md-surface-container-highest);
      overflow: hidden;
    }

    .tb-asg-stats__bar > span {
      display: block;
      block-size: 100%;
      background: var(--p-md-error);
    }
  `,
})
export class QuizMistakes {
  protected readonly tq = T.quizReview;

  readonly stats = input.required<QuizStats>();

  /** A question's Markdown as one plain line for the stats. */
  protected plain(text: string): string {
    return text.replace(/[#*_`>-]/g, '').trim();
  }
}
