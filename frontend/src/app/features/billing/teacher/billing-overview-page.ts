import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { HelpButton } from '@features/help/parts';
import { MoneyPipe } from '@shared/money/money.pipe';
import { RowType } from '@shared/ui/row-type.directive';
import { BillingApi } from '../data-access/billing-api';
import { BillingOverview, StudentBalance } from '../data-access/billing.models';
import { BalanceAmount } from '../ledger/balance-amount';
import { DefaultPriceCard } from './default-price-card';
import { PaymentDialog } from './payment-dialog';
import { quietContext } from '@core/http/api-error.interceptor';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { InitialsPipe } from '@shared/ui/initials';
import { Snackbar } from '@core/snackbar/snackbar';

/** Teacher: balances of all students and quick recording of payments. */
@Component({
  selector: 'tb-billing-overview-page',
  imports: [
    InitialsPipe,
    EmptyState,
    HelpButton,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Card,
    TableModule,
    ToggleSwitch,
    Tooltip,
    MoneyPipe,
    RowType,
    BalanceAmount,
    DefaultPriceCard,
    PaymentDialog,
    LoadStateView,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Оплаты">
      <tb-help-button help topic="teacher/billing" />
      <a pButton routerLink="report" severity="secondary">
        <i pButtonIcon aria-hidden="true" class="pi pi-chart-bar"></i>
        <span pButtonLabel>Отчёт за месяц</span>
      </a>
      <p-button
        class="tb-page-fab"
        label="Оплата"
        icon="pi pi-wallet"
        (onClick)="openPayment(null)"
        [disabled]="!overview()"
      />
    </tb-page-header>

    <tb-load-state [state]="state" what="оплаты" (retry)="load()">
      @if (overview(); as overview) {
        <div class="tb-stats">
          <p-card>
            <div class="tb-stat">
              <span class="tb-muted">Долг учеников</span>
              <span class="tb-stat__value" [class.tb-negative]="overview.totalDebt > 0">{{
                overview.totalDebt | money: overview.currency
              }}</span>
            </div>
          </p-card>
          <p-card>
            <div class="tb-stat">
              <span class="tb-muted">Авансы</span>
              <span class="tb-stat__value" [class.tb-positive]="overview.totalPrepaid > 0">{{
                overview.totalPrepaid | money: overview.currency
              }}</span>
            </div>
          </p-card>
          <p-card>
            <div class="tb-stat">
              <span class="tb-muted">Должников</span>
              <span class="tb-stat__value">{{ debtorsCount() }}</span>
            </div>
          </p-card>
          <tb-default-price-card
            [price]="overview.defaultLessonPrice"
            [currency]="overview.currency"
            (changed)="defaultPriceChanged($event)"
          />
        </div>

        <p-card>
          <div class="tb-toolbar">
            <label class="tb-switch" for="only-debtors">
              <p-toggleswitch inputId="only-debtors" [formControl]="onlyDebtors" />
              Только должники
            </label>
          </div>
          <p-table [value]="rows()" dataKey="studentId" [rowHover]="true" styleClass="tb-cards">
            <ng-template #header>
              <tr>
                <th class="tb-col-main">Ученик</th>
                <th class="tb-amount">Цена занятия</th>
                <th>Занятий</th>
                <th>Последнее</th>
                <th class="tb-amount">Баланс</th>
                <th class="tb-actions-column"><span class="tb-sr-only">Действия</span></th>
              </tr>
            </ng-template>
            <ng-template #body let-row [tbRowType]="rows()">
              <tr>
                <td data-label="Ученик">
                  <div class="tb-person">
                    <span class="tb-avatar" aria-hidden="true">{{
                      row.displayName | initials
                    }}</span>
                    <div class="tb-list__text">
                      <a
                        [routerLink]="['students', row.studentId]"
                        class="tb-list__title tb-link"
                        >{{ row.displayName }}</a
                      >
                      @if (row.status === 'DEACTIVATED') {
                        <span class="tb-list__supporting">отключён</span>
                      }
                    </div>
                  </div>
                </td>
                <td data-label="Цена занятия" class="tb-amount">
                  {{ row.lessonPrice | money: overview.currency }}
                </td>
                <td data-label="Занятий">{{ row.chargedLessons }}</td>
                <td data-label="Последнее">
                  {{ row.lastLessonDate ? (row.lastLessonDate | date: 'dd.MM.yyyy') : '—' }}
                </td>
                <td data-label="Баланс" class="tb-amount">
                  <tb-balance-amount [balance]="row.balance" [currency]="overview.currency" />
                </td>
                <td class="tb-actions-column">
                  <p-button
                    icon="pi pi-wallet"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    pTooltip="Принять оплату"
                    [ariaLabel]="'Оплата: ' + row.displayName"
                    (onClick)="openPayment(row.studentId)"
                  />
                </td>
              </tr>
            </ng-template>
            <ng-template #emptymessage>
              <tr>
                <td colspan="6">
                  @if (overview.students.length === 0) {
                    <tb-empty-state
                      icon="pi-users"
                      title="Учеников пока нет"
                      hint="Добавьте учеников в разделе «Ученики»"
                    />
                  } @else {
                    <tb-empty-state icon="pi-check-circle" title="Должников нет" />
                  }
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>

        <tb-payment-dialog
          [(visible)]="paymentVisible"
          [students]="overview.students"
          [studentId]="selectedStudent()"
          [currency]="overview.currency"
          (saved)="onSaved('Оплата сохранена')"
        />
      }
    </tb-load-state>
  `,
})
export class BillingOverviewPage implements OnInit {
  private readonly api = inject(BillingApi);
  private readonly snackbar = inject(Snackbar);

  protected readonly overview = signal<BillingOverview | null>(null);
  protected readonly state = new LoadState();
  protected readonly onlyDebtors = new FormControl(false, { nonNullable: true });
  private readonly debtorsFilter = toSignal(this.onlyDebtors.valueChanges, { initialValue: false });

  protected readonly rows = computed<StudentBalance[]>(() => {
    const students = this.overview()?.students ?? [];
    return this.debtorsFilter() ? students.filter((student) => student.balance < 0) : students;
  });
  protected readonly debtorsCount = computed(
    () => (this.overview()?.students ?? []).filter((student) => student.balance < 0).length,
  );

  protected readonly selectedStudent = signal<string | null>(null);
  protected readonly paymentVisible = signal(false);
  /** `?create=...` from the quick actions of the home page: opens the form at once. */
  readonly create = input<string>();

  ngOnInit(): void {
    this.load();
    if (this.create() === 'payment') {
      this.openPayment(null);
    }
  }

  protected openPayment(studentId: string | null): void {
    this.selectedStudent.set(studentId);
    this.paymentVisible.set(true);
  }

  protected onSaved(message: string): void {
    this.snackbar.success(message);
    this.load();
  }

  protected defaultPriceChanged(price: number): void {
    const overview = this.overview();
    if (overview !== null) {
      this.overview.set({ ...overview, defaultLessonPrice: price });
    }
  }

  protected load(): void {
    this.api
      .overview(quietContext())
      .pipe(this.state.track())
      .subscribe((overview) => {
        this.overview.set(overview);
      });
  }
}
