import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Card } from 'primeng/card';
import { T } from './i18n/texts';

/** Figures of the current week for the Today page (spec §6, column 3). */
export interface WeekFigures {
  readonly conducted: number;
  readonly missed: number;
  readonly assigned: number;
  readonly onTime: number;
}

@Component({
  selector: 'tb-week-figures',
  imports: [Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = figures();
    <p-card [header]="t.title">
      <dl class="tb-week">
        <div class="tb-week__row">
          <dt>{{ t.lessons }}</dt>
          <dd>{{ f.conducted }}</dd>
        </div>
        <div class="tb-week__row">
          <dt>{{ t.missed }}</dt>
          <dd>{{ f.missed }}</dd>
        </div>
        <div class="tb-week__row">
          <dt>{{ t.assigned }}</dt>
          <dd>{{ f.assigned }}</dd>
        </div>
        <div class="tb-week__row">
          <dt>{{ t.onTime }}</dt>
          <dd>{{ f.onTime }}</dd>
        </div>
      </dl>
    </p-card>
  `,
  styles: `
    .tb-week {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      margin: 0;
    }

    .tb-week__row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: baseline;
      column-gap: var(--tb-space-4);

      dt {
        font: var(--tb-type-body-l);
      }

      dd {
        margin: 0;
        font: var(--tb-type-title-m);
      }
    }
  `,
})
export class WeekFiguresCard {
  protected readonly t = T.week;
  readonly figures = input.required<WeekFigures>();
}
