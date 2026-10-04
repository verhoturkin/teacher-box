import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { DatePicker } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { toIsoMonth } from '@shared/dates/iso-date';
import { MoneyPipe } from '@shared/money/money.pipe';
import { RowType } from '@shared/ui/row-type.directive';
import { LESSON_STATUS_LABELS } from '../billing-labels';
import { BillingApi } from '../data-access/billing-api';
import { MonthlyReport } from '../data-access/billing.models';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { InitialsPipe } from '@shared/ui/initials';

/** Teacher: income and lessons of a month. */
@Component({
  selector: 'tb-monthly-report-page',
  imports: [
    InitialsPipe,
    EmptyState,
    LoadStateView,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    Card,
    DatePicker,
    TableModule,
    Tag,
    MoneyPipe,
    RowType,
    PageHeader,
    HelpButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Отчёт за месяц" back="/teacher/billing" backLabel="Оплаты">
      <tb-help-button help topic="teacher/billing" />
    </tb-page-header>
    <div class="tb-toolbar">
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

    <tb-load-state [state]="state" what="отчёт" (retry)="load(month.value)">
      @if (report(); as report) {
        <div class="tb-stats">
          <p-card>
            <div class="tb-stat">
              <span class="tb-muted">Поступления</span>
              <span class="tb-stat__value tb-positive">{{
                report.income | money: report.currency
              }}</span>
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
              <small class="tb-muted"
                >пропусков: {{ report.missedLessons }}, отменено:
                {{ report.cancelledLessons }}</small
              >
            </div>
          </p-card>
        </div>

        <div class="tb-stack">
          <p-card header="По ученикам">
            <p-table [value]="report.students" dataKey="studentId" styleClass="tb-cards">
              <ng-template #header>
                <tr>
                  <th class="tb-col-main">Ученик</th>
                  <th>Занятий</th>
                  <th class="tb-amount">Начислено</th>
                  <th class="tb-amount">Оплачено</th>
                </tr>
              </ng-template>
              <ng-template #body let-row [tbRowType]="report.students">
                <tr>
                  <td data-label="Ученик">
                    <a
                      [routerLink]="['/teacher/billing/students', row.studentId]"
                      class="tb-link"
                      >{{ row.displayName }}</a
                    >
                  </td>
                  <td data-label="Занятий">{{ row.chargedLessons }}</td>
                  <td data-label="Начислено" class="tb-amount">
                    {{ row.charged | money: report.currency }}
                  </td>
                  <td data-label="Оплачено" class="tb-amount">
                    {{ row.paid | money: report.currency }}
                  </td>
                </tr>
              </ng-template>
              <ng-template #emptymessage>
                <tr>
                  <td colspan="4">
                    <tb-empty-state
                      icon="pi-calendar"
                      title="В этом месяце не было ни занятий, ни оплат"
                    />
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </p-card>

          <p-card header="Журнал занятий">
            <p-table
              [value]="report.lessons"
              [paginator]="report.lessons.length > 20"
              [rows]="20"
              styleClass="tb-cards"
            >
              <ng-template #header>
                <tr>
                  <th>Дата</th>
                  <th class="tb-col-main">Ученик</th>
                  <th>Тема</th>
                  <th>Итог</th>
                  <th class="tb-amount">Стоимость</th>
                </tr>
              </ng-template>
              <ng-template #body let-entry [tbRowType]="report.lessons">
                <tr [class.tb-inactive]="entry.lesson.status === 'CANCELLED'">
                  <td data-label="Дата">{{ entry.lesson.date | date: 'dd.MM.yyyy' }}</td>
                  <td data-label="Ученик">
                    <div class="tb-person">
                      <span class="tb-avatar" aria-hidden="true">{{
                        entry.studentName | initials
                      }}</span>
                      <div class="tb-list__text">
                        <span class="tb-list__title">{{ entry.studentName }}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Тема">{{ entry.lesson.topic ?? '' }}</td>
                  <td data-label="Итог">
                    <p-tag
                      [value]="lessonStatusLabels[entry.lesson.status]"
                      [severity]="
                        entry.lesson.status === 'CONDUCTED'
                          ? 'success'
                          : entry.lesson.status === 'MISSED'
                            ? 'warn'
                            : 'secondary'
                      "
                    />
                  </td>
                  <td data-label="Стоимость" class="tb-amount">
                    {{ entry.lesson.price | money: report.currency }}
                  </td>
                </tr>
              </ng-template>
              <ng-template #emptymessage>
                <tr>
                  <td colspan="5"><tb-empty-state icon="pi-calendar" title="Занятий нет" /></td>
                </tr>
              </ng-template>
            </p-table>
          </p-card>

          <p-card header="Оплаты">
            <p-table [value]="report.payments" styleClass="tb-cards">
              <ng-template #header>
                <tr>
                  <th>Дата</th>
                  <th class="tb-col-main">Ученик</th>
                  <th>Комментарий</th>
                  <th class="tb-amount">Сумма</th>
                </tr>
              </ng-template>
              <ng-template #body let-entry [tbRowType]="report.payments">
                <tr [class.tb-inactive]="entry.payment.voidedAt !== null">
                  <td data-label="Дата">{{ entry.payment.paidOn | date: 'dd.MM.yyyy' }}</td>
                  <td data-label="Ученик">
                    <div class="tb-person">
                      <span class="tb-avatar" aria-hidden="true">{{
                        entry.studentName | initials
                      }}</span>
                      <div class="tb-list__text">
                        <span class="tb-list__title">{{ entry.studentName }}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Комментарий">{{ entry.payment.comment ?? '' }}</td>
                  <td data-label="Сумма" class="tb-amount">
                    {{ entry.payment.amount | money: report.currency }}
                  </td>
                </tr>
              </ng-template>
              <ng-template #emptymessage>
                <tr>
                  <td colspan="4"><tb-empty-state icon="pi-wallet" title="Оплат нет" /></td>
                </tr>
              </ng-template>
            </p-table>
          </p-card>
        </div>
      }
    </tb-load-state>
  `,
})
export class MonthlyReportPage implements OnInit {
  private readonly api = inject(BillingApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly lessonStatusLabels = LESSON_STATUS_LABELS;
  readonly month = new FormControl<Date>(new Date(), { nonNullable: true });
  protected readonly report = signal<MonthlyReport | null>(null);
  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load(this.month.value);
    this.month.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((month) => {
      this.load(month);
    });
  }

  protected load(month: Date): void {
    this.api
      .monthlyReport(toIsoMonth(month))
      .pipe(this.state.track())
      .subscribe((report) => {
        this.report.set(report);
      });
  }
}
