import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputNumber } from 'primeng/inputnumber';
import { Tooltip } from 'primeng/tooltip';
import { MoneyPipe } from '@shared/money/money.pipe';
import { toMajorUnits, toMinorUnits } from '@shared/money/money';
import { BillingApi } from '../data-access/billing-api';
import { Snackbar } from '@core/snackbar/snackbar';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';
import { locale } from '@core/i18n/language';

/**
 * The lesson price of new students and groups, changed in place: the field takes the whole width
 * of the card under its label, the buttons are under it (ADR-0018, ADR-0022).
 */
@Component({
  selector: 'tb-default-price-card',
  imports: [ReactiveFormsModule, Button, Card, InputNumber, MoneyPipe, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      @if (editing()) {
        <form class="tb-form" [formGroup]="form" (ngSubmit)="save()">
          <div class="tb-field">
            <label for="default-price">{{ t.label }}</label>
            <p-inputnumber
              inputId="default-price"
              formControlName="price"
              mode="currency"
              [currency]="currency()"
              [locale]="locale"
              [min]="0"
              [fluid]="true"
            />
            <small class="tb-hint">{{ t.hint }}</small>
          </div>
          <div class="tb-form-actions">
            <p-button
              [label]="c.cancel"
              severity="secondary"
              [text]="true"
              (onClick)="editing.set(false)"
            />
            <p-button
              class="tb-tonal"
              severity="success"
              type="submit"
              [label]="c.save"
              icon="pi pi-check"
              [loading]="pending()"
            />
          </div>
        </form>
      } @else {
        <div class="tb-stat">
          <span class="tb-muted">{{ t.label }}</span>
          <span class="tb-stat__value">
            {{ price() | money: currency() }}
            <p-button
              icon="pi pi-pencil"
              severity="secondary"
              [text]="true"
              [pTooltip]="t.edit"
              [rounded]="true"
              [ariaLabel]="t.edit"
              (onClick)="edit()"
            />
          </span>
          <small class="tb-muted">{{ t.rowHint }}</small>
        </div>
      }
    </p-card>
  `,
})
export class DefaultPriceCard {
  protected readonly locale = locale();
  protected readonly c = SHARED_T.common;
  protected readonly t = T.defaultPrice;
  private readonly api = inject(BillingApi);
  private readonly snackbar = inject(Snackbar);

  /** Minor units. */
  readonly price = input.required<number>();
  readonly currency = input.required<string>();
  readonly changed = output<number>();

  protected readonly editing = signal(false);
  protected readonly pending = signal(false);

  readonly form = new FormGroup({
    price: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  edit(): void {
    this.form.setValue({ price: toMajorUnits(this.price(), this.currency()) });
    this.editing.set(true);
  }

  save(): void {
    const price = this.form.controls.price.value;
    if (this.form.invalid || price === null || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.api.changeDefaultPrice(toMinorUnits(price, this.currency())).subscribe({
      next: (saved) => {
        this.pending.set(false);
        this.editing.set(false);
        this.changed.emit(saved);
        this.snackbar.success(T.defaultPrice.saved);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }
}
