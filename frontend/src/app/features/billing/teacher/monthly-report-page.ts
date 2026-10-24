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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { Pane, Panes } from '@shared/ui/panes';
import { DatePicker } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { fromIsoMonth, toIsoMonth } from '@shared/dates/iso-date';
import { MoneyPipe } from '@shared/money/money.pipe';
import { RowType } from '@shared/ui/row-type.directive';
import { LESSON_STATUS_HINTS, LESSON_STATUS_LABELS } from '../billing-labels';
import { BillingApi } from '../data-access/billing-api';
import { MonthlyReport } from '../data-access/billing.models';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { Avatar } from '@shared/ui/avatar';
import { TeacherColors } from '@features/identity/parts';
import { T } from '../i18n/texts';
import { PAYMENTS_TAB } from '../card-link';

/** Teacher: income and lessons of a month. */
@Component({
  selector: 'tb-monthly-report-page',
  imports: [
    Pane,
    Panes,
    Avatar,
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
    <tb-panes
      ><tb-pane>
        <div tbPaneHeader>
          <tb-page-header [title]="t.title" back="/teacher/billing" [backLabel]="t.back">
            <tb-help-button help topic="teacher/billing" />
          </tb-page-header>
          <div class="tb-toolbar">
            <p-datepicker
              [formControl]="month"
              [fluid]="true"
              appendTo="body"
              view="month"
              dateFormat="mm.yy"
              [showIcon]="true"
              [readonlyInput]="true"
              inputId="report-month"
              [ariaLabel]="t.month"
            />
          </div>
        </div>
        <tb-load-state [state]="state" [what]="t.what" (retry)="load(month.value)">
          @if (report(); as report) {
            <dl class="tb-figures">
              <div class="tb-figure">
                <dt class="tb-figure__label">{{ t.income }}</dt>
                <dd class="tb-figure__value tb-positive">
                  {{ report.income | money: report.currency }}
                </dd>
              </div>
              <div class="tb-figure">
                <dt class="tb-figure__label">{{ t.charged }}</dt>
                <dd class="tb-figure__value">{{ report.charged | money: report.currency }}</dd>
              </div>
              <div class="tb-figure">
                <dt class="tb-figure__label">{{ t.lessons }}</dt>
                <dd class="tb-figure__value">{{ report.conductedLessons }}</dd>
                <small class="tb-muted">{{
                  t.missedAndCancelled(report.missedLessons, report.cancelledLessons)
                }}</small>
              </div>
            </dl>

            <div class="tb-stack tb-report-sections">
              <p-card [header]="t.byStudent">
                <p-table [value]="report.students" dataKey="studentId" styleClass="tb-cards">
                  <ng-template #header>
                    <tr>
                      <th class="tb-col-main">{{ t.student }}</th>
                      <th>{{ t.lessonsCount }}</th>
                      <th class="tb-amount">{{ t.chargedColumn }}</th>
                      <th class="tb-amount">{{ t.paid }}</th>
                    </tr>
                  </ng-template>
                  <ng-template #body let-row [tbRowType]="report.students">
                    <tr>
                      <td [attr.data-label]="t.student">
                        <a
                          [routerLink]="['/teacher/students', row.studentId]"
                          [queryParams]="paymentsTab"
                          class="tb-link"
                          >{{ row.displayName }}</a
                        >
                      </td>
                      <td [attr.data-label]="t.lessonsCount">{{ row.chargedLessons }}</td>
                      <td [attr.data-label]="t.chargedColumn" class="tb-amount">
                        {{ row.charged | money: report.currency }}
                      </td>
                      <td [attr.data-label]="t.paid" class="tb-amount">
                        {{ row.paid | money: report.currency }}
                      </td>
                    </tr>
                  </ng-template>
                  <ng-template #emptymessage>
                    <tr>
                      <td colspan="4">
                        <tb-empty-state icon="tb-i-calendar_month" [title]="t.emptyMonth" />
                      </td>
                    </tr>
                  </ng-template>
                </p-table>
              </p-card>

              <p-card [header]="t.journal">
                <p-table
                  [value]="report.lessons"
                  [paginator]="report.lessons.length > 20"
                  [rows]="20"
                  styleClass="tb-cards"
                >
                  <ng-template #header>
                    <tr>
                      <th>{{ t.date }}</th>
                      <th class="tb-col-main">{{ t.student }}</th>
                      <th>{{ t.topic }}</th>
                      <th>{{ t.outcome }}</th>
                      <th class="tb-amount">{{ t.price }}</th>
                    </tr>
                  </ng-template>
                  <ng-template #body let-entry [tbRowType]="report.lessons">
                    <tr [class.tb-inactive]="entry.lesson.status === 'CANCELLED'">
                      <td [attr.data-label]="t.date">
                        {{ entry.lesson.date | date: 'dd.MM.yyyy' }}
                      </td>
                      <td [attr.data-label]="t.student">
                        <div class="tb-person">
                          <tb-avatar
                            [attr.data-tb-label]="colors.studentLabel(entry.lesson.studentId)"
                            [name]="entry.studentName"
                            [photo]="entry.studentAvatar"
                          />
                          <div class="tb-list__text">
                            <span class="tb-list__title">{{ entry.studentName }}</span>
                          </div>
                        </div>
                      </td>
                      <td [attr.data-label]="t.topic">{{ entry.lesson.topic ?? '' }}</td>
                      <td [attr.data-label]="t.outcome">
                        <p-tag
                          [value]="lessonStatusLabels[entry.lesson.status]"
                          [attr.title]="lessonStatusHints[entry.lesson.status] ?? null"
                          [severity]="
                            entry.lesson.status === 'CONDUCTED'
                              ? 'success'
                              : entry.lesson.status === 'MISSED'
                                ? 'warn'
                                : 'secondary'
                          "
                        />
                      </td>
                      <td [attr.data-label]="t.price" class="tb-amount">
                        {{ entry.lesson.price | money: report.currency }}
                      </td>
                    </tr>
                  </ng-template>
                  <ng-template #emptymessage>
                    <tr>
                      <td colspan="5">
                        <tb-empty-state icon="tb-i-calendar_month" [title]="t.noLessons" />
                      </td>
                    </tr>
                  </ng-template>
                </p-table>
              </p-card>

              <p-card [header]="t.payments">
                <p-table [value]="report.payments" styleClass="tb-cards">
                  <ng-template #header>
                    <tr>
                      <th>{{ t.date }}</th>
                      <th class="tb-col-main">{{ t.student }}</th>
                      <th>{{ t.comment }}</th>
                      <th class="tb-amount">{{ t.amount }}</th>
                    </tr>
                  </ng-template>
                  <ng-template #body let-entry [tbRowType]="report.payments">
                    <tr [class.tb-inactive]="entry.payment.voidedAt !== null">
                      <td [attr.data-label]="t.date">
                        {{ entry.payment.paidOn | date: 'dd.MM.yyyy' }}
                      </td>
                      <td [attr.data-label]="t.student">
                        <div class="tb-person">
                          <tb-avatar
                            [attr.data-tb-label]="colors.studentLabel(entry.payment.studentId)"
                            [name]="entry.studentName"
                            [photo]="entry.studentAvatar"
                          />
                          <div class="tb-list__text">
                            <span class="tb-list__title">{{ entry.studentName }}</span>
                          </div>
                        </div>
                      </td>
                      <td [attr.data-label]="t.comment">{{ entry.payment.comment ?? '' }}</td>
                      <td [attr.data-label]="t.amount" class="tb-amount">
                        {{ entry.payment.amount | money: report.currency }}
                      </td>
                    </tr>
                  </ng-template>
                  <ng-template #emptymessage>
                    <tr>
                      <td colspan="4">
                        <tb-empty-state icon="tb-i-account_balance_wallet" [title]="t.noPayments" />
                      </td>
                    </tr>
                  </ng-template>
                </p-table>
              </p-card>
            </div>
          }
        </tb-load-state> </tb-pane
    ></tb-panes>
  `,
  styles: `
    .tb-report-sections {
      margin-block-start: var(--tb-space-6);
    }

    @media (width < 37.5em) {
      .tb-figure__value {
        overflow-wrap: anywhere;
      }
    }
  `,
})
export class MonthlyReportPage implements OnInit {
  protected readonly paymentsTab = PAYMENTS_TAB;
  protected readonly t = T.report;
  protected readonly colors = inject(TeacherColors);
  private readonly api = inject(BillingApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly lessonStatusLabels = LESSON_STATUS_LABELS;
  protected readonly lessonStatusHints = LESSON_STATUS_HINTS;
  private readonly requested = inject(ActivatedRoute).snapshot.queryParamMap.get('month');
  /** The month of the report: the one «Отчёт за месяц» was opened from (`?month=yyyy-MM`), else this one. */
  readonly month = new FormControl<Date>(
    this.requested !== null && /^\d{4}-\d{2}$/.test(this.requested)
      ? fromIsoMonth(this.requested)
      : new Date(),
    { nonNullable: true },
  );
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
