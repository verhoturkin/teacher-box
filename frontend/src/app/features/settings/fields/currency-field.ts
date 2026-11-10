import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { T } from '../i18n/texts';
import { Option, currencyOptions } from '../lesson-options';
import { controlValue } from './control-value';

/**
 * The currency of the portal: any ISO code until the first charge or payment, then locked with a hint. The
 * host saves on `committed` (a choice) and disables the control while `locked`.
 */
@Component({
  selector: 'tb-currency-field',
  imports: [ReactiveFormsModule, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../../shared/ui/support-hint.scss',
  template: `
    <div class="tb-field">
      <label [for]="inputId()">{{ t.currencyLabel }}</label>
      <p-select
        [inputId]="inputId()"
        optionLabel="label"
        optionValue="value"
        appendTo="body"
        [filter]="true"
        filterBy="label"
        [options]="currencies()"
        [formControl]="control()"
        (onChange)="committed.emit($event.value)"
      />
      @if (locked()) {
        <small class="tb-hint tb-hint--icon"
          ><i class="tb-i tb-i-lock" aria-hidden="true"></i>{{ t.currencyLocked }}</small
        >
      } @else if (!short()) {
        <small class="tb-hint">{{ t.currencyHint }}</small>
      }
    </div>
  `,
})
export class CurrencyField {
  readonly control = input.required<FormControl<string>>();
  readonly inputId = input('currency-input');
  readonly locked = input(false);
  /** The hint is said elsewhere (the first setup): only the locked state stays under the field. */
  readonly short = input(false);
  readonly committed = output<string>();

  protected readonly t = T.page;
  protected readonly value = controlValue(() => this.control());
  protected readonly currencies = computed<Option[]>(() => {
    const code = this.value();
    return code === undefined || code === '' ? [] : currencyOptions(code);
  });
}
