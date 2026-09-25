import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { DatePicker } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { toIsoMonth } from '@shared/dates/iso-date';
import { MoneyPipe } from '@shared/money/money.pipe';
import { RowType } from '@shared/ui/row-type.directive';
import { LESSON_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../billing-labels';
import { BillingApi } from '../data-access/billing-api';
import { MonthlyReport } from '../data-access/billing.models';

/** Teacher: income and lessons of a month. */
@Component({
  selector: 'tb-monthly-report-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Card,
    DatePicker,
    TableModule,
    Tag,
    MoneyPipe,
    RowType,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a pButton routerLink="/teacher/billing" [text]="true" class="tb-back">
      <i pButtonIcon class="pi pi-arrow-left"></i>
      <span pButtonLabel>Оплаты</span>
    </a>
    <div class="tb-page-header">
      <h1 class="tb-page-title">Отчёт за месяц</h1>
      <p-datepicker
        [formControl]="month"
        view="month"
        dateFormat="mm.yy"
        [showIcon]="true"
        [readonlyInput]="true"
        inputId="report-month"
        ariaLabel="Месяц отчёта"
      />
    </div>

    @if (report(); as report) {
      <div class="tb-stats">
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">Поступления</span>
            <span class="tb-stat__value tb-positive">{{ report.income | money: report.currency }}</span>
          </div>
        </p-card>
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">Начислено за занятия</span>
            <span class="tb-stat__value">{{ report.charged | money: report.currency }}</span>
          </div>
        </p-card>
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">Занятия</span>
            <span class="tb-stat__value">{{ report.conductedLessons }}</span>
            <small class="tb-muted">пропусков: {{ report.missedLessons }}, отменено: {{ report.cancelledLessons }}</small>
          </div>
        </p-card>
      </div>

      <div class="tb-stack">
        <p-card header="По ученикам">
          <p-table [value]="report.students" dataKey="studentId">
            <ng-template #header>
              <tr>
                <th>Ученик</th>
                <th>Занятий</th>
                <th class="tb-amount">Начислено</th>
                <th class="tb-amount">Оплачено</th>
              </tr>
            </ng-template>
            <ng-template #body let-row [tbRowType]="report.students">
              <tr>
                <td>
                  <a [routerLink]="['/teacher/billing/students', row.studentId]" class="tb-link">{{ row.displayName }}</a>
                </td>
                <td>{{ row.chargedLessons }}</td>
                <td class="tb-amount">{{ row.charged | money: report.currency }}</td>
                <td class="tb-amount">{{ row.paid | money: report.currency }}</td>
              </tr>
            </ng-template>
            <ng-template #emptymessage>
              <tr><td colspan="4" class="tb-empty">В этом месяце не было ни занятий, ни оплат</td></tr>
            </ng-template>
          </p-table>
        </p-card>

        <p-card header="Журнал занятий">
          <p-table [value]="report.lessons" [paginator]="report.lessons.length > 20" [rows]="20">
            <ng-template #header>
              <tr>
                <th>Дата</th>
                <th>Ученик</th>
                <th>Тема</th>
                <th>Итог</th>
                <th class="tb-amount">Стоимость</th>
              </tr>
            </ng-template>
            <ng-template #body let-entry [tbRowType]="report.lessons">
              <tr [class.tb-inactive]="entry.lesson.status === 'CANCELLED'">
                <td>{{ entry.lesson.date | date: 'dd.MM.yyyy' }}</td>
                <td>{{ entry.studentName }}</td>
                <td>{{ entry.lesson.topic ?? '' }}</td>
                <td>
                  <p-tag
                    [value]="lessonStatusLabels[entry.lesson.status]"
                    [severity]="entry.lesson.status === 'CONDUCTED' ? 'success' : entry.lesson.status === 'MISSED' ? 'warn' : 'secondary'"
                  />
                </td>
                <td class="tb-amount">{{ entry.lesson.price | money: report.currency }}</td>
              </tr>
            </ng-template>
            <ng-template #emptymessage>
              <tr><td colspan="5" class="tb-empty">Занятий нет</td></tr>
            </ng-template>
          </p-table>
        </p-card>

        <p-card header="Оплаты">
          <p-table [value]="report.payments">
            <ng-template #header>
              <tr>
                <th>Дата</th>
                <th>Ученик</th>
                <th>Способ</th>
                <th>Комментарий</th>
                <th class="tb-amount">Сумма</th>
              </tr>
            </ng-template>
            <ng-template #body let-entry [tbRowType]="report.payments">
              <tr [class.tb-inactive]="entry.payment.voidedAt !== null">
                <td>{{ entry.payment.paidOn | date: 'dd.MM.yyyy' }}</td>
                <td>{{ entry.studentName }}</td>
                <td>{{ paymentMethodLabels[entry.payment.method] }}</td>
                <td>{{ entry.payment.comment ?? '' }}</td>
                <td class="tb-amount">{{ entry.payment.amount | money: report.currency }}</td>
              </tr>
            </ng-template>
            <ng-template #emptymessage>
              <tr><td colspan="5" class="tb-empty">Оплат нет</td></tr>
            </ng-template>
          </p-table>
        </p-card>
      </div>
    }
  `,
})
export class MonthlyReportPage implements OnInit {
  private readonly api = inject(BillingApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly lessonStatusLabels = LESSON_STATUS_LABELS;
  protected readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  readonly month = new FormControl<Date>(new Date(), { nonNullable: true });
  protected readonly report = signal<MonthlyReport | null>(null);

  ngOnInit(): void {
    this.load(this.month.value);
    this.month.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((month) => {
      this.load(month);
    });
  }

  private load(month: Date): void {
    this.api.monthlyReport(toIsoMonth(month)).subscribe((report) => {
      this.report.set(report);
    });
  }
}
