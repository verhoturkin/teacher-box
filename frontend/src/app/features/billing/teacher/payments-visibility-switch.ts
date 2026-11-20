import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Snackbar } from '@core/snackbar/snackbar';
import { BillingApi } from '../data-access/billing-api';
import { PaymentVisibility } from '../data-access/billing.models';
import { T } from '../i18n/texts';

/**
 * «Оплаты видит только родитель» in the «Родители» card of a student (ADR-0069, 452.3): a settings tile with a
 * switch, shown only while the student has a parent; changed at once. A failed load shows nothing — the card
 * around it still works.
 */
@Component({
  selector: 'tb-payments-visibility-switch',
  imports: [FormsModule, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visibility(); as visibility) {
      @if (visibility.hasGuardians) {
        <div class="tb-tiles">
          <label class="tb-tile" for="payments-guardians-only">
            <i class="tb-i tb-i-visibility_off tb-tile__icon" aria-hidden="true"></i>
            <span class="tb-tile__text">
              <b>{{ t.label }}</b>
              <span>{{ t.hint }}</span>
            </span>
            <p-toggleswitch
              inputId="payments-guardians-only"
              [ngModel]="visibility.guardiansOnly"
              [disabled]="pending()"
              (ngModelChange)="change($event)"
            />
          </label>
        </div>
      }
    }
  `,
})
export class PaymentsVisibilitySwitch {
  protected readonly t = T.paymentsVisibility;
  private readonly api = inject(BillingApi);
  private readonly snackbar = inject(Snackbar);

  readonly studentId = input.required<string>();
  /** How many parents the card shows: a parent linked or unlinked reads the flag again. */
  readonly guardians = input(0);

  protected readonly visibility = signal<PaymentVisibility | null>(null);
  protected readonly pending = signal(false);

  constructor() {
    effect(() => {
      const studentId = this.studentId();
      this.guardians();
      untracked(() => {
        this.load(studentId);
      });
    });
  }

  private load(studentId: string): void {
    this.api.paymentVisibility(studentId).subscribe({
      next: (visibility) => {
        this.visibility.set(visibility);
      },
      error: () => {
        this.visibility.set(null);
      },
    });
  }

  protected change(guardiansOnly: boolean): void {
    const current = this.visibility();
    if (current === null || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.visibility.set({ ...current, guardiansOnly });
    this.api.changePaymentVisibility(current.studentId, guardiansOnly).subscribe({
      next: (saved) => {
        this.pending.set(false);
        this.visibility.set(saved);
        this.snackbar.success(saved.guardiansOnly ? this.t.on : this.t.off);
      },
      error: () => {
        this.pending.set(false);
        this.visibility.set(current);
      },
    });
  }
}
