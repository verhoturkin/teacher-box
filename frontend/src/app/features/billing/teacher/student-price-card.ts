import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputNumber } from 'primeng/inputnumber';
import { locale } from '@core/i18n/language';
import { Snackbar } from '@core/snackbar/snackbar';
import { SHARED_T } from '@shared/i18n/texts';
import { toMajorUnits, toMinorUnits } from '@shared/money/money';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { BillingApi } from '../data-access/billing-api';
import { T } from '../i18n/texts';

/**
 * The lesson price of one student on the Профиль tab of the card (redesign spec §8), the one place it is
 * changed: the field under its label across the card, saved in place by the tonal «Сохранить» under it;
 * «Отмена» brings back the saved price.
 */
@Component({
  selector: 'tb-student-price-card',
  imports: [ReactiveFormsModule, Button, Card, InputNumber, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.lessonPrice">
      <tb-load-state [state]="state" [what]="t.what" [compact]="true" (retry)="load()">
        <form class="tb-form" [formGroup]="form" (ngSubmit)="save()">
          <div class="tb-field">
            <label for="lesson-price-input">{{ t.lessonPrice }}</label>
            <p-inputnumber
              inputId="lesson-price-input"
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
            @if (changed()) {
              <p-button
                [label]="c.cancel"
                severity="secondary"
                [text]="true"
                (onClick)="cancel()"
              />
            }
            <p-button
              type="submit"
              severity="secondary"
              [label]="c.save"
              icon="tb-i tb-i-check"
              [disabled]="!changed()"
              [loading]="pending()"
            />
          </div>
        </form>
      </tb-load-state>
    </p-card>
  `,
})
export class StudentPriceCard {
  protected readonly locale = locale();
  protected readonly c = SHARED_T.common;
  protected readonly t = T.studentPrice;
  private readonly api = inject(BillingApi);
  private readonly snackbar = inject(Snackbar);

  readonly studentId = input.required<string>();

  protected readonly state = new LoadState();
  /** The saved price, minor units; `null` until it is read. */
  protected readonly saved = signal<number | null>(null);
  protected readonly currency = signal('RUB');
  protected readonly pending = signal(false);

  readonly price = new FormControl<number | null>(null, [Validators.required, Validators.min(0)]);
  protected readonly form = new FormGroup({ price: this.price });
  private readonly value = toSignal(this.price.valueChanges, { initialValue: null });
  protected readonly changed = computed(() => {
    const saved = this.saved();
    const value = this.value();
    return saved !== null && value !== null && toMinorUnits(value, this.currency()) !== saved;
  });

  constructor() {
    effect(() => {
      this.studentId();
      untracked(() => {
        this.load();
      });
    });
  }

  protected load(): void {
    this.api
      .ledger(this.studentId())
      .pipe(this.state.track())
      .subscribe((ledger) => {
        this.currency.set(ledger.currency);
        this.show(ledger.lessonPrice);
      });
  }

  protected save(): void {
    const value = this.price.value;
    if (value === null || this.price.invalid || !this.changed() || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.api.changeLessonPrice(this.studentId(), toMinorUnits(value, this.currency())).subscribe({
      next: (saved) => {
        this.pending.set(false);
        this.show(saved);
        this.snackbar.success(this.t.changed);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  protected cancel(): void {
    const saved = this.saved();
    if (saved !== null) {
      this.show(saved);
    }
  }

  private show(price: number): void {
    this.saved.set(price);
    this.price.setValue(toMajorUnits(price, this.currency()));
  }
}
