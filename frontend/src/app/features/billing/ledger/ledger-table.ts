import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { MoneyPipe } from '@shared/money/money.pipe';
import { RowType } from '@shared/ui/row-type.directive';
import { LESSON_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../billing-labels';
import { Lesson, Payment, StudentLedger } from '../data-access/billing.models';
import { ledgerEntries } from './ledger-entries';

/** History of lessons and payments of one student. */
@Component({
  selector: 'tb-ledger-table',
  imports: [DatePipe, Button, TableModule, Tag, Tooltip, MoneyPipe, RowType],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-table [value]="entries()" dataKey="id" [rowHover]="true" [paginator]="entries().length > 20" [rows]="20">
      <ng-template #header>
        <tr>
          <th>Дата</th>
          <th>Операция</th>
          <th>Подробности</th>
          <th class="tb-amount">Сумма</th>
          @if (editable()) {
            <th class="tb-actions-column"><span class="tb-sr-only">Действия</span></th>
          }
        </tr>
      </ng-template>
      <ng-template #body let-entry [tbRowType]="entries()">
        <tr [class.tb-inactive]="entry.inactive">
          <td>{{ entry.date | date: 'dd.MM.yyyy' }}</td>
          @switch (entry.kind) {
            @case ('lesson') {
              <td>
                Занятие, {{ entry.lesson.durationMinutes }} мин
                @if (entry.lesson.status !== 'CONDUCTED') {
                  <p-tag
                    [value]="lessonStatusLabels[entry.lesson.status]"
                    [severity]="entry.lesson.status === 'MISSED' ? 'warn' : 'secondary'"
                  />
                }
              </td>
              <td>
                {{ entry.lesson.topic ?? '' }}
                @if (entry.lesson.cancelReason) {
                  <small class="tb-muted">({{ entry.lesson.cancelReason }})</small>
                }
              </td>
              <td class="tb-amount tb-negative">−{{ entry.lesson.price | money: ledger().currency }}</td>
              @if (editable()) {
                <td class="tb-actions-column">
                  @if (entry.lesson.status !== 'CANCELLED') {
                    <p-button icon="pi pi-times" [text]="true" [rounded]="true" severity="danger" pTooltip="Отменить занятие"
                      ariaLabel="Отменить занятие" (onClick)="cancelLesson.emit(entry.lesson)" />
                  }
                </td>
              }
            }
            @case ('payment') {
              <td>
                Оплата: {{ paymentMethodLabels[entry.payment.method] }}
                @if (entry.payment.voidedAt) {
                  <p-tag value="Аннулирована" severity="secondary" />
                }
              </td>
              <td>
                {{ entry.payment.comment ?? '' }}
                @if (entry.payment.voidReason) {
                  <small class="tb-muted">({{ entry.payment.voidReason }})</small>
                }
              </td>
              <td class="tb-amount tb-positive">+{{ entry.payment.amount | money: ledger().currency }}</td>
              @if (editable()) {
                <td class="tb-actions-column">
                  @if (!entry.payment.voidedAt) {
                    <p-button icon="pi pi-times" [text]="true" [rounded]="true" severity="danger" pTooltip="Аннулировать оплату"
                      ariaLabel="Аннулировать оплату" (onClick)="voidPayment.emit(entry.payment)" />
                  }
                </td>
              }
            }
          }
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td [attr.colspan]="editable() ? 5 : 4" class="tb-empty">Пока нет ни занятий, ни оплат</td>
        </tr>
      </ng-template>
    </p-table>
  `,
})
export class LedgerTable {
  readonly ledger = input.required<StudentLedger>();
  /** Teacher mode: lessons can be cancelled and payments voided. */
  readonly editable = input(false);
  readonly cancelLesson = output<Lesson>();
  readonly voidPayment = output<Payment>();

  protected readonly lessonStatusLabels = LESSON_STATUS_LABELS;
  protected readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  protected readonly entries = computed(() => ledgerEntries(this.ledger()));
}
