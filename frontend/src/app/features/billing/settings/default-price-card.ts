import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { guardUnsaved } from '@core/routing/unsaved-changes';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputNumber } from 'primeng/inputnumber';
import { Tooltip } from 'primeng/tooltip';
import { MoneyPipe } from '@shared/money/money.pipe';
import { toMajorUnits, toMinorUnits } from '@shared/money/money';
import { quietContext } from '@core/http/api-error.interceptor';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { BillingApi } from '../data-access/billing-api';
import { Snackbar } from '@core/snackbar/snackbar';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';
import { locale } from '@core/i18n/language';

/**
 * The lesson price of new students and groups in the settings category «Оплаты» (redesign spec §10.3),
 * changed in place: the field takes the whole width of the card under its label, the buttons are under it
 * (ADR-0018, ADR-0022).
 */
@Component({
  selector: 'tb-default-price-card',
  imports: [ReactiveFormsModule, Button, Card, InputNumber, LoadStateView, MoneyPipe, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="default-price">
      <tb-load-state [state]="state" [what]="t.what" [compact]="true" (retry)="load()">
        @if (editing()) {
          <form class="tb-form" [formGroup]="form" (ngSubmit)="save()">
            <div class="tb-field">
              <label for="default-price">{{ t.label }}</label>
              <p-inputnumber
                inputId="default-price"
                formControlName="price"
                mode="currency"
                currencyDisplay="narrowSymbol"
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
                severity="secondary"
                type="submit"
                [label]="c.save"
                icon="tb-i tb-i-check"
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
                icon="tb-i tb-i-edit"
                severity="secondary"
                [text]="true"
                [pTooltip]="t.edit"
                [rounded]="true"
                [ariaLabel]="t.edit"
                (onClick)="edit()"
              />
            </span>
            <small class="tb-muted">{{ t.hint }}</small>
          </div>
        }
      </tb-load-state>
    </p-card>
  `,
})
export class DefaultPriceCard implements OnInit {
  protected readonly locale = locale();
  protected readonly c = SHARED_T.common;
  protected readonly t = T.defaultPrice;
  private readonly api = inject(BillingApi);
  private readonly snackbar = inject(Snackbar);

  /** Minor units. */
  protected readonly price = signal(0);
  protected readonly currency = signal('RUB');
  protected readonly state = new LoadState();

  protected readonly editing = signal(false);
  protected readonly pending = signal(false);

  readonly form = new FormGroup({
    price: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  constructor() {
    guardUnsaved(() => this.editing() && this.form.dirty);
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .overview(quietContext())
      .pipe(this.state.track())
      .subscribe((overview) => {
        this.price.set(overview.defaultLessonPrice);
        this.currency.set(overview.currency);
      });
  }

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
        this.price.set(saved);
        this.snackbar.success(T.defaultPrice.saved);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }
}
