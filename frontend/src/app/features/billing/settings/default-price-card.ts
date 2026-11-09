import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputNumber } from 'primeng/inputnumber';
import { toMajorUnits, toMinorUnits } from '@shared/money/money';
import { quietContext } from '@core/http/api-error.interceptor';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { BillingApi } from '../data-access/billing-api';
import { Snackbar } from '@core/snackbar/snackbar';
import { T } from '../i18n/texts';
import { locale } from '@core/i18n/language';

/**
 * The lesson price of new students and groups, a row of «Время и цена» in the settings category «Занятия»
 * (sketch Lessons): the field is always there and saves on change — on leaving it or Enter.
 */
@Component({
  selector: 'tb-default-price-card',
  imports: [ReactiveFormsModule, InputNumber, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-load-state [state]="state" [what]="t.what" [compact]="true" (retry)="load()">
      <form id="default-price" class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="tb-field">
          <label for="default-price-input">{{ short() ? t.shortLabel : t.label }}</label>
          <p-inputnumber
            inputId="default-price-input"
            formControlName="price"
            mode="currency"
            currencyDisplay="narrowSymbol"
            [currency]="currency()"
            [locale]="locale"
            [min]="0"
            [fluid]="true"
            (onBlur)="save()"
          />
          @if (!short()) {
            <small class="tb-hint">{{ t.hint }}</small>
          }
        </div>
      </form>
    </tb-load-state>
  `,
})
export class DefaultPriceCard implements OnInit {
  protected readonly locale = locale();
  protected readonly t = T.defaultPrice;
  private readonly api = inject(BillingApi);
  private readonly snackbar = inject(Snackbar);

  /** Minor units, as last saved. */
  private readonly price = signal(0);
  protected readonly currency = signal('RUB');
  protected readonly state = new LoadState();
  private pending = false;

  /** Beside another field that shares its hint (sketch Lessons): the short label, no hint. */
  readonly short = input(false);

  readonly form = new FormGroup({
    price: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  ngOnInit(): void {
    this.load();
  }

  /** Also after the currency changed: the price is shown in the new one. */
  load(): void {
    this.api
      .overview(quietContext())
      .pipe(this.state.track())
      .subscribe((overview) => {
        this.price.set(overview.defaultLessonPrice);
        this.currency.set(overview.currency);
        this.form.setValue({ price: toMajorUnits(overview.defaultLessonPrice, overview.currency) });
      });
  }

  save(): void {
    const value = this.form.controls.price.value;
    if (this.form.invalid || value === null || this.pending) {
      return;
    }
    const minor = toMinorUnits(value, this.currency());
    if (minor === this.price()) {
      return;
    }
    this.pending = true;
    this.api.changeDefaultPrice(minor).subscribe({
      next: (saved) => {
        this.pending = false;
        this.price.set(saved);
        this.snackbar.success(T.defaultPrice.saved);
      },
      error: () => {
        this.pending = false;
      },
    });
  }
}
