import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputNumber } from 'primeng/inputnumber';
import { formatMoney, toMajorUnits, toMinorUnits } from '@shared/money/money';
import { MoneyPipe } from '@shared/money/money.pipe';
import { BillingApi } from '../data-access/billing-api';
import { BillingStudent, Lesson, Payment, StudentLedger } from '../data-access/billing.models';
import { BalanceAmount } from '../ledger/balance-amount';
import { LedgerTable } from '../ledger/ledger-table';
import { LessonDialog } from './lesson-dialog';
import { PaymentDialog } from './payment-dialog';

/** Teacher: the history of one student, lesson price, corrections. */
@Component({
  selector: 'tb-student-ledger-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Card,
    ConfirmDialog,
    InputNumber,
    MoneyPipe,
    BalanceAmount,
    LedgerTable,
    LessonDialog,
    PaymentDialog,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a pButton routerLink="/teacher/billing" [text]="true" class="tb-back">
      <i pButtonIcon class="pi pi-arrow-left"></i>
      <span pButtonLabel>Все ученики</span>
    </a>
    @if (ledger(); as ledger) {
      <div class="tb-page-header">
        <h1 class="tb-page-title">{{ ledger.displayName }}</h1>
        <div class="tb-actions">
          <p-button label="Занятие" icon="pi pi-plus" (onClick)="lessonVisible.set(true)" />
          <p-button label="Оплата" icon="pi pi-wallet" severity="success" (onClick)="paymentVisible.set(true)" />
        </div>
      </div>

      <div class="tb-stats">
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">Баланс</span>
            <span class="tb-stat__value"><tb-balance-amount [balance]="ledger.balance" [currency]="ledger.currency" /></span>
          </div>
        </p-card>
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">Начислено за всё время</span>
            <span class="tb-stat__value">{{ ledger.charged | money: ledger.currency }}</span>
          </div>
        </p-card>
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">Оплачено за всё время</span>
            <span class="tb-stat__value">{{ ledger.paid | money: ledger.currency }}</span>
          </div>
        </p-card>
        <p-card>
          <div class="tb-stat">
            <label class="tb-muted" for="lesson-price-input">Цена занятия</label>
            <div class="tb-copy-row">
              <p-inputnumber
                inputId="lesson-price-input"
                [formControl]="price"
                mode="currency"
                [currency]="ledger.currency"
                locale="ru-RU"
                [min]="0"
                styleClass="tb-grow"
              />
              <p-button icon="pi pi-check" ariaLabel="Сохранить цену" [disabled]="price.invalid || !priceChanged()" (onClick)="savePrice()" />
            </div>
          </div>
        </p-card>
      </div>

      <p-card header="История">
        <tb-ledger-table
          [ledger]="ledger"
          [editable]="true"
          (cancelLesson)="confirmCancel($event)"
          (voidPayment)="confirmVoid($event)"
        />
      </p-card>

      <tb-lesson-dialog [(visible)]="lessonVisible" [students]="student()" [studentId]="ledger.studentId" [currency]="ledger.currency" (saved)="reload()" />
      <tb-payment-dialog [(visible)]="paymentVisible" [students]="student()" [studentId]="ledger.studentId" [currency]="ledger.currency" (saved)="reload()" />
    }
    <p-confirmdialog />
  `,
})
export class StudentLedgerPage implements OnInit {
  private readonly api = inject(BillingApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  /** Route parameter. */
  readonly studentId = input.required<string>();

  protected readonly ledger = signal<StudentLedger | null>(null);
  protected readonly student = computed<BillingStudent[]>(() => {
    const ledger = this.ledger();
    return ledger === null ? [] : [ledger];
  });
  protected readonly lessonVisible = signal(false);
  protected readonly paymentVisible = signal(false);
  readonly price = new FormControl<number | null>(null, [Validators.required, Validators.min(0)]);
  private readonly priceValue = toSignal(this.price.valueChanges, { initialValue: null });
  protected readonly priceChanged = computed(() => {
    const ledger = this.ledger();
    const value = this.priceValue();
    return ledger !== null && value !== null && toMinorUnits(value, ledger.currency) !== ledger.lessonPrice;
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.api.ledger(this.studentId()).subscribe((ledger) => {
      this.ledger.set(ledger);
      this.price.setValue(toMajorUnits(ledger.lessonPrice, ledger.currency));
    });
  }

  protected savePrice(): void {
    const ledger = this.ledger();
    const value = this.price.value;
    if (ledger === null || value === null) {
      return;
    }
    this.api.changeLessonPrice(ledger.studentId, toMinorUnits(value, ledger.currency)).subscribe((saved) => {
      this.ledger.set({ ...ledger, lessonPrice: saved });
      this.messages.add({ severity: 'success', summary: 'Сохранено', detail: 'Цена занятия изменена' });
    });
  }

  protected confirmCancel(lesson: Lesson): void {
    const ledger = this.ledger();
    this.confirmation.confirm({
      header: 'Отменить занятие?',
      message: `Начисление ${ledger === null ? '' : formatMoney(lesson.price, ledger.currency)} будет снято. Запись останется в истории.`,
      acceptLabel: 'Отменить занятие',
      rejectLabel: 'Назад',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        this.api.cancelLesson(lesson.id, null).subscribe(() => {
          this.reload();
        });
      },
    });
  }

  protected confirmVoid(payment: Payment): void {
    const ledger = this.ledger();
    this.confirmation.confirm({
      header: 'Аннулировать оплату?',
      message: `Оплата ${ledger === null ? '' : formatMoney(payment.amount, ledger.currency)} перестанет учитываться. Запись останется в истории.`,
      acceptLabel: 'Аннулировать',
      rejectLabel: 'Назад',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        this.api.voidPayment(payment.id, null).subscribe(() => {
          this.reload();
        });
      },
    });
  }
}
