import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputNumber } from 'primeng/inputnumber';
import { Tooltip } from 'primeng/tooltip';
import { MoneyPipe } from '@shared/money/money.pipe';
import { toMajorUnits, toMinorUnits } from '@shared/money/money';
import { BillingApi } from '../data-access/billing-api';

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
            <label for="default-price">Цена для новых учеников</label>
            <p-inputnumber
              inputId="default-price"
              formControlName="price"
              mode="currency"
              [currency]="currency()"
              locale="ru-RU"
              [min]="0"
              [fluid]="true"
            />
            <small class="tb-hint">Цена каждого ученика меняется в его строке</small>
          </div>
          <div class="tb-form-actions">
            <p-button
              label="Отмена"
              severity="danger"
              [text]="true"
              (onClick)="editing.set(false)"
            />
            <p-button
              class="tb-tonal"
              severity="success"
              type="submit"
              label="Сохранить"
              icon="pi pi-check"
              [loading]="pending()"
            />
          </div>
        </form>
      } @else {
        <div class="tb-stat">
          <span class="tb-muted">Цена для новых учеников</span>
          <span class="tb-stat__value">
            {{ price() | money: currency() }}
            <p-button
              icon="pi pi-pencil"
              severity="secondary"
              [text]="true"
              pTooltip="Изменить цену для новых учеников"
              [rounded]="true"
              ariaLabel="Изменить цену для новых учеников"
              (onClick)="edit()"
            />
          </span>
          <small class="tb-muted">цена каждого ученика меняется в его строке</small>
        </div>
      }
    </p-card>
  `,
})
export class DefaultPriceCard {
  private readonly api = inject(BillingApi);
  private readonly messages = inject(MessageService);

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
        this.messages.add({
          severity: 'success',
          summary: 'Сохранено',
          detail: 'Новые ученики и группы получат эту цену',
        });
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }
}
