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
      <dl class="tb-figures">
        <div class="tb-figure">
          <dt class="tb-figure__label">{{ t.lessons }}</dt>
          <dd class="tb-figure__value">{{ f.conducted }}</dd>
        </div>
        <div class="tb-figure">
          <dt class="tb-figure__label">{{ t.missed }}</dt>
          <dd class="tb-figure__value">{{ f.missed }}</dd>
        </div>
        <div class="tb-figure">
          <dt class="tb-figure__label">{{ t.assigned }}</dt>
          <dd class="tb-figure__value">{{ f.assigned }}</dd>
        </div>
        <div class="tb-figure">
          <dt class="tb-figure__label">{{ t.onTime }}</dt>
          <dd class="tb-figure__value">{{ f.onTime }}</dd>
        </div>
      </dl>
    </p-card>
  `,
})
export class WeekFiguresCard {
  protected readonly t = T.week;
  readonly figures = input.required<WeekFigures>();
}
