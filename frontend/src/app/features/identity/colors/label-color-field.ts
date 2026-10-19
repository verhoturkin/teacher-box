import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { LABEL_COLORS, LabelColor, labelKey, labelName } from '@core/theme/label-colors';
import { T } from '../i18n/texts';

interface Option {
  readonly value: LabelColor | null;
  readonly label: string;
  readonly key: string | null;
}

/** «Без цвета» first, then the palette in the order of the hues. */
const OPTIONS: Option[] = [
  { value: null, label: T.colors.none, key: null },
  ...LABEL_COLORS.map((color) => ({ value: color, label: labelName(color), key: labelKey(color) })),
];

/**
 * The colour of a student or a group in their dialog: a select of the fixed palette, every option with its
 * swatch (the label container, as on the avatar).
 */
@Component({
  selector: 'tb-label-color-field',
  imports: [ReactiveFormsModule, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-field">
      <label [for]="inputId()">{{ t.label }}</label>
      <p-select
        [inputId]="inputId()"
        [formControl]="control()"
        [options]="options"
        optionLabel="label"
        optionValue="value"
        appendTo="body"
        [fluid]="true"
      >
        <ng-template #selectedItem let-option>
          <span class="tb-label-option">
            <span class="tb-label-swatch" [attr.data-tb-label]="option.key"></span>
            {{ option.label }}
          </span>
        </ng-template>
        <ng-template #item let-option>
          <span class="tb-label-option">
            <span class="tb-label-swatch" [attr.data-tb-label]="option.key"></span>
            {{ option.label }}
          </span>
        </ng-template>
      </p-select>
    </div>
  `,
})
export class LabelColorField {
  protected readonly t = T.colors;
  protected readonly options = OPTIONS;

  readonly inputId = input.required<string>();
  readonly control = input.required<FormControl<LabelColor | null>>();
}
