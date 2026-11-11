import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LABEL_COLORS, labelKey } from '@core/theme/label-colors';
import { Avatar } from '@shared/ui/avatar';

/** §2 Colours of students and groups: `data-tb-label="<colour>"` brings `--tb-label*` to an avatar or a lead. */
@Component({
  selector: 'tb-gallery-label-colours',
  imports: [Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-grid">
      @for (colour of colours; track colour) {
        <li class="tb-gallery-row">
          <tb-avatar name="Anna Petrova" [attr.data-tb-label]="colour" />
          <code class="tb-gallery-name">data-tb-label="{{ colour }}"</code>
        </li>
      }
      <li class="tb-gallery-row">
        <tb-avatar name="Anna Petrova" />
        <code class="tb-gallery-name">no colour</code>
      </li>
    </ul>
  `,
})
export class LabelColoursSample {
  protected readonly colours = LABEL_COLORS.map(labelKey);
}
