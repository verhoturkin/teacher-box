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
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { HelpButton } from '@features/help/parts';
import { MoneyPipe } from '@shared/money/money.pipe';
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
import { Avatar } from '@shared/ui/avatar';
import { Snackbar } from '@core/snackbar/snackbar';
import { countOf } from '@shared/text/plural';
import { formatMoney } from '@shared/money/money';

/** Teacher: balances of all students and quick recording of payments. */
@Component({
  selector: 'tb-billing-overview-page',
  imports: [
    Avatar,
    EmptyState,
    HelpButton,
    ReactiveFormsModule,
    RouterLink,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Card,
    ToggleSwitch,
    Tooltip,
    MoneyPipe,
    BalanceAmount,
    DefaultPriceCard,
    PaymentDialog,
    LoadStateView,
    PageHeader,
  ],
  providers: [DatePipe],
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
          <h2 class="tb-sr-only">Балансы учеников</h2>
          <div class="tb-toolbar">
            <label class="tb-switch" for="only-debtors">
              <p-toggleswitch inputId="only-debtors" [formControl]="onlyDebtors" />
              Только должники
            </label>
          </div>
          @if (rows().length > 0) {
            <ul class="tb-list" aria-label="Балансы учеников">
              @for (row of rows(); track row.studentId) {
                <li>
                  <tb-avatar [name]="row.displayName" [photo]="row.avatar" />
                  <div class="tb-list__text">
                    <a [routerLink]="['students', row.studentId]" class="tb-list__title tb-link">{{
                      row.displayName
                    }}</a>
                    <span class="tb-list__supporting">{{ details(row, overview.currency) }}</span>
                  </div>
                  <div class="tb-list__trail tb-list__trail--icons tb-list__trail--amount">
                    <tb-balance-amount
                      class="tb-list__amount"
                      [balance]="row.balance"
                      [currency]="overview.currency"
                    />
                    <p-button
                      icon="pi pi-wallet"
                      [text]="true"
                      [rounded]="true"
                      severity="secondary"
                      [pTooltip]="'Записать оплату: ' + row.displayName"
                      [ariaLabel]="'Записать оплату: ' + row.displayName"
                      (onClick)="openPayment(row.studentId)"
                    />
                  </div>
                </li>
              }
            </ul>
          } @else if (overview.students.length === 0) {
            <tb-empty-state
              icon="pi-users"
              title="Учеников пока нет"
              hint="Добавьте учеников в разделе «Ученики»"
            />
          } @else {
            <tb-empty-state icon="pi-check-circle" title="Должников нет" />
          }
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
  private readonly date = inject(DatePipe);

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

  /** «1 500 ₽ за занятие · 3 занятия · последнее 01.09.2026», «отключён» first for a deactivated one. */
  protected details(row: StudentBalance, currency: string): string {
    return [
      row.status === 'DEACTIVATED' ? 'отключён' : null,
      `${formatMoney(row.lessonPrice, currency)} за занятие`,
      countOf(row.chargedLessons, 'занятие', 'занятия', 'занятий'),
      row.lastLessonDate === null
        ? null
        : `последнее ${this.date.transform(row.lastLessonDate, 'dd.MM.yyyy') ?? ''}`,
    ]
      .filter((part) => part !== null)
      .join(' · ');
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
