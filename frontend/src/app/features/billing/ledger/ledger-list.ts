import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { MoneyPipe } from '@shared/money/money.pipe';
import { LESSON_STATUS_HINTS, LESSON_STATUS_LABELS } from '../billing-labels';
import { Lesson, Payment, StudentLedger } from '../data-access/billing.models';
import { ledgerEntries } from './ledger-entries';
import { EmptyState } from '@shared/ui/empty-state';

/** Rows shown at first and added by «Показать ещё». */
export const LEDGER_PAGE = 20;

/**
 * History of lessons and payments of one student: a list like «Ученики», one line per operation —
 * the operation with its status, «date · details» under it, the amount (and «×» for the teacher) on
 * the right, also on the phone.
 */
@Component({
  selector: 'tb-ledger-list',
  imports: [EmptyState, DatePipe, Button, Tag, Tooltip, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entries().length === 0) {
      <tb-empty-state icon="pi-wallet" title="Пока нет ни занятий, ни оплат" />
    } @else {
      <ul class="tb-list" aria-label="История">
        @for (entry of visible(); track entry.id) {
          <li [class.tb-inactive]="entry.inactive">
            <span class="tb-list__lead" aria-hidden="true"
              ><i [class]="entry.kind === 'lesson' ? 'pi pi-calendar' : 'pi pi-wallet'"></i
            ></span>
            @switch (entry.kind) {
              @case ('lesson') {
                <div class="tb-list__text">
                  <span class="tb-list__title"
                    ><span class="tb-ledger__operation"
                      >Занятие, {{ entry.lesson.durationMinutes }} мин</span
                    >
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
                <div class="tb-list__trail tb-list__trail--icons">
                  <span class="tb-ledger__amount tb-negative"
                    >−{{ entry.lesson.price | money: ledger().currency }}</span
                  >
                  @if (editable() && entry.lesson.status !== 'CANCELLED') {
                    <p-button
                      icon="pi pi-times"
                      [text]="true"
                      [rounded]="true"
                      severity="danger"
                      [pTooltip]="'Снять начисление за ' + (entry.date | date: 'dd.MM.yyyy')"
                      [ariaLabel]="'Снять начисление за ' + (entry.date | date: 'dd.MM.yyyy')"
                      (onClick)="cancelLesson.emit(entry.lesson)"
                    />
                  }
                </div>
              }
              @case ('payment') {
                <div class="tb-list__text">
                  <span class="tb-list__title"
                    ><span class="tb-ledger__operation">Оплата</span>
                    @if (entry.payment.voidedAt) {
                      <p-tag value="Аннулирована" severity="secondary" />
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
                <div class="tb-list__trail tb-list__trail--icons">
                  <span class="tb-ledger__amount tb-positive"
                    >+{{ entry.payment.amount | money: ledger().currency }}</span
                  >
                  @if (editable() && !entry.payment.voidedAt) {
                    <p-button
                      icon="pi pi-times"
                      [text]="true"
                      [rounded]="true"
                      severity="danger"
                      [pTooltip]="'Аннулировать оплату от ' + (entry.date | date: 'dd.MM.yyyy')"
                      [ariaLabel]="'Аннулировать оплату от ' + (entry.date | date: 'dd.MM.yyyy')"
                      (onClick)="voidPayment.emit(entry.payment)"
                    />
                  }
                </div>
              }
            }
          </li>
        }
      </ul>
      @if (visible().length < entries().length) {
        <p-button label="Показать ещё" [text]="true" (onClick)="showMore()" />
      }
    }
  `,
})
export class LedgerList {
  readonly ledger = input.required<StudentLedger>();
  /** Teacher mode: lessons can be cancelled and payments voided. */
  readonly editable = input(false);
  readonly cancelLesson = output<Lesson>();
  readonly voidPayment = output<Payment>();

  protected readonly lessonStatusLabels = LESSON_STATUS_LABELS;
  protected readonly lessonStatusHints = LESSON_STATUS_HINTS;
  protected readonly entries = computed(() => ledgerEntries(this.ledger()));
  private readonly shown = signal(LEDGER_PAGE);
  protected readonly visible = computed(() => this.entries().slice(0, this.shown()));

  protected showMore(): void {
    this.shown.update((shown) => shown + LEDGER_PAGE);
  }
}
