import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { MoneyPipe } from '@shared/money/money.pipe';
import { FileOpener } from '@shared/files/file-opener';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { BillingApi } from '../data-access/billing-api';
import { RECEIPT_ACCEPT, showableReceipt } from '../receipts';
import { LESSON_STATUS_HINTS, LESSON_STATUS_LABELS } from '../billing-labels';
import { Lesson, Payment, StudentLedger } from '../data-access/billing.models';
import { ledgerEntries } from './ledger-entries';
import { EmptyState } from '@shared/ui/empty-state';
import { T } from '../i18n/texts';

/** Rows shown at first and added by «Показать ещё». */
export const LEDGER_PAGE = 20;

/**
 * History of lessons and payments of one student: a list like «Ученики», one line per operation —
 * the operation with its status, «date · details» under it, the amount (and «×» for the teacher) on
 * the right, also on the phone. A payment's receipt opens from its row; the teacher attaches, replaces and
 * removes it from the «📎» menu.
 */
@Component({
  selector: 'tb-ledger-list',
  imports: [EmptyState, DatePipe, Button, Menu, Tag, Tooltip, MoneyPipe, ButtonAttributes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entries().length === 0) {
      <tb-empty-state icon="tb-i-account_balance_wallet" [title]="t.empty" />
    } @else {
      <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="t.history">
        @for (entry of visible(); track entry.id) {
          <li [class.tb-inactive]="entry.inactive">
            <span class="tb-list__lead" aria-hidden="true"
              ><i
                [class]="
                  entry.kind === 'lesson'
                    ? 'tb-i tb-i-calendar_month'
                    : 'tb-i tb-i-account_balance_wallet'
                "
              ></i
            ></span>
            @switch (entry.kind) {
              @case ('lesson') {
                <div class="tb-list__text">
                  <span class="tb-list__title"
                    ><span class="tb-ledger__operation">{{
                      t.lesson(entry.lesson.durationMinutes)
                    }}</span>
                    @if (entry.lesson.status !== 'CONDUCTED') {
                      <p-tag
                        [value]="lessonStatusLabels[entry.lesson.status]"
                        [attr.title]="lessonStatusHints[entry.lesson.status] ?? null"
                        [severity]="entry.lesson.status === 'MISSED' ? 'warn' : 'secondary'"
                      />
                    }
                  </span>
                  <span class="tb-list__supporting">
                    {{ entry.date | date: 'dd.MM.yyyy' }}
                    @if (entry.lesson.topic) {
                      · {{ entry.lesson.topic }}
                    }
                    @if (entry.lesson.cancelReason) {
                      ({{ entry.lesson.cancelReason }})
                    }
                  </span>
                </div>
                <div class="tb-list__trail tb-list__trail--icons tb-list__trail--amount">
                  <span class="tb-ledger__amount tb-list__amount tb-negative"
                    >−{{ entry.lesson.price | money: ledger().currency }}</span
                  >
                  @if (editable() && entry.lesson.status !== 'CANCELLED') {
                    <p-button
                      icon="tb-i tb-i-close"
                      [text]="true"
                      [rounded]="true"
                      severity="danger"
                      [pTooltip]="t.cancelCharge((entry.date | date: 'dd.MM.yyyy') ?? '')"
                      [ariaLabel]="t.cancelCharge((entry.date | date: 'dd.MM.yyyy') ?? '')"
                      (onClick)="cancelLesson.emit(entry.lesson)"
                    />
                  }
                </div>
              }
              @case ('payment') {
                <div class="tb-list__text">
                  <span class="tb-list__title"
                    ><span class="tb-ledger__operation">{{ t.payment }}</span>
                    @if (entry.payment.voidedAt) {
                      <p-tag [value]="t.voided" severity="secondary" />
                    }
                  </span>
                  <span class="tb-list__supporting">
                    {{ entry.date | date: 'dd.MM.yyyy' }}
                    @if (entry.payment.comment) {
                      · {{ entry.payment.comment }}
                    }
                    @if (entry.payment.voidReason) {
                      ({{ entry.payment.voidReason }})
                    }
                  </span>
                </div>
                <div class="tb-list__trail tb-list__trail--icons tb-list__trail--amount">
                  <span class="tb-ledger__amount tb-list__amount tb-positive"
                    >+{{ entry.payment.amount | money: ledger().currency }}</span
                  >
                  <span class="tb-ledger__actions">
                    @if (entry.payment.receipt) {
                      <p-button
                        icon="tb-i tb-i-receipt_long"
                        [text]="true"
                        [rounded]="true"
                        severity="secondary"
                        [pTooltip]="t.openReceipt((entry.date | date: 'dd.MM.yyyy') ?? '')"
                        [ariaLabel]="t.openReceipt((entry.date | date: 'dd.MM.yyyy') ?? '')"
                        (onClick)="openReceipt(entry.payment)"
                      />
                    }
                    @if (editable()) {
                      <p-button
                        icon="tb-i tb-i-attach_file"
                        [text]="true"
                        [rounded]="true"
                        severity="secondary"
                        [pTooltip]="t.receiptActions((entry.date | date: 'dd.MM.yyyy') ?? '')"
                        [ariaLabel]="t.receiptActions((entry.date | date: 'dd.MM.yyyy') ?? '')"
                        [tbAttributes]="{
                          'aria-haspopup': 'menu',
                          'aria-expanded': menuFor()?.id === entry.payment.id ? 'true' : 'false',
                        }"
                        [loading]="receiptBusy() === entry.payment.id"
                        (onClick)="openMenu(entry.payment, $event)"
                      />
                    }
                    @if (editable() && !entry.payment.voidedAt) {
                      <p-button
                        icon="tb-i tb-i-close"
                        [text]="true"
                        [rounded]="true"
                        severity="danger"
                        [pTooltip]="t.voidPayment((entry.date | date: 'dd.MM.yyyy') ?? '')"
                        [ariaLabel]="t.voidPayment((entry.date | date: 'dd.MM.yyyy') ?? '')"
                        (onClick)="voidPayment.emit(entry.payment)"
                      />
                    }
                  </span>
                </div>
              }
            }
          </li>
        }
      </ul>
      @if (visible().length < entries().length) {
        <p-button [label]="t.showMore" [text]="true" (onClick)="showMore()" />
      }
    }
    @if (editable()) {
      <input
        #receiptPicker
        type="file"
        class="tb-sr-only"
        tabindex="-1"
        aria-hidden="true"
        [accept]="receiptAccept"
        (change)="onReceiptPicked(receiptPicker)"
      />
      <p-menu
        #menu
        [model]="menuItems()"
        [popup]="true"
        appendTo="body"
        (onHide)="menuFor.set(null)"
      />
    }
  `,
  styles: `
    /* the buttons of a payment are one item of the row: on a phone they stay side by side on the right */
    .tb-ledger__actions {
      display: flex;
      align-items: center;
    }
  `,
})
export class LedgerList {
  protected readonly t = T.ledger;
  readonly ledger = input.required<StudentLedger>();
  /** Teacher mode: lessons can be cancelled and payments voided. */
  readonly editable = input(false);
  readonly cancelLesson = output<Lesson>();
  readonly voidPayment = output<Payment>();
  /** The id of the payment whose receipt is being saved. */
  readonly receiptBusy = input<string | null>(null);
  readonly attachReceipt = output<{ payment: Payment; file: File }>();
  readonly removeReceipt = output<Payment>();

  private readonly api = inject(BillingApi);
  private readonly fileOpener = inject(FileOpener);
  protected readonly receiptAccept = RECEIPT_ACCEPT;
  private readonly menu = viewChild<Menu>('menu');
  private readonly receiptPicker = viewChild<ElementRef<HTMLInputElement>>('receiptPicker');
  private receiptTarget: Payment | null = null;
  /** The payment whose «📎» menu is open: one popup menu serves every row. */
  protected readonly menuFor = signal<Payment | null>(null);
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const payment = this.menuFor();
    if (payment === null) {
      return [];
    }
    const attach: MenuItem = {
      label: payment.receipt === null ? T.ledger.attachReceipt : T.ledger.replaceReceipt,
      icon: 'tb-i tb-i-attach_file',
      command: () => {
        this.pickReceipt(payment);
      },
    };
    return payment.receipt === null
      ? [attach]
      : [
          attach,
          {
            label: T.ledger.removeReceipt,
            icon: 'tb-i tb-i-delete',
            command: () => {
              this.removeReceipt.emit(payment);
            },
          },
        ];
  });

  protected readonly lessonStatusLabels = LESSON_STATUS_LABELS;
  protected readonly lessonStatusHints = LESSON_STATUS_HINTS;
  protected readonly entries = computed(() => ledgerEntries(this.ledger()));
  private readonly shown = signal(LEDGER_PAGE);
  protected readonly visible = computed(() => this.entries().slice(0, this.shown()));

  /** A PDF or a picture opens in a new tab; a HEIC photo is saved. */
  protected openReceipt(payment: Payment): void {
    const receipt = payment.receipt;
    if (receipt === null) {
      return;
    }
    this.fileOpener.open(
      this.api.receipt(payment.id, !this.editable()),
      showableReceipt(receipt.contentType),
      () => receipt.filename,
    );
  }

  protected openMenu(payment: Payment, event: Event): void {
    this.menuFor.set(payment);
    this.menu()?.toggle(event);
  }

  /** Still within the menu click: the browser opens the file chooser only then. */
  private pickReceipt(payment: Payment): void {
    this.receiptTarget = payment;
    this.receiptPicker()?.nativeElement.click();
  }

  protected onReceiptPicked(element: HTMLInputElement): void {
    const file = element.files?.[0] ?? null;
    const payment = this.receiptTarget;
    element.value = '';
    this.receiptTarget = null;
    if (file !== null && payment !== null) {
      this.attachReceipt.emit({ payment, file });
    }
  }

  protected showMore(): void {
    this.shown.update((shown) => shown + LEDGER_PAGE);
  }
}
