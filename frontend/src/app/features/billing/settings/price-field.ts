import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputNumber } from 'primeng/inputnumber';
import { locale } from '@core/i18n/language';
import { T } from '../i18n/texts';

/**
 * The lesson price of new students and groups in major units of `currency` (Settings › Занятия and the first
 * setup). The host saves on `committed` — leaving the field or Enter — or later.
 */
@Component({
  selector: 'tb-price-field',
  imports: [ReactiveFormsModule, InputNumber],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-field">
      <label [for]="inputId()">{{ short() ? t.shortLabel : t.label }}</label>
      <p-inputnumber
        [inputId]="inputId()"
        [formControl]="control()"
        mode="currency"
        currencyDisplay="narrowSymbol"
        [currency]="currency()"
        [locale]="locale"
        [min]="0"
        [fluid]="true"
        (onBlur)="committed.emit()"
        (keydown.enter)="committed.emit()"
      />
      @if (!short()) {
        <small class="tb-hint">{{ t.hint }}</small>
      }
    </div>
  `,
})
export class PriceField {
  readonly control = input.required<FormControl<number | null>>();
  readonly currency = input.required<string>();
  readonly inputId = input('default-price-input');
  /** Beside another field that shares its hint (sketch Lessons, OnbTime): the short label, no hint. */
  readonly short = input(false);
  readonly committed = output();

  protected readonly locale = locale();
  protected readonly t = T.defaultPrice;
}
