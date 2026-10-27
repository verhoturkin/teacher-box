import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, forkJoin, switchMap } from 'rxjs';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import { quietContext } from '@core/http/api-error.interceptor';
import { locale } from '@core/i18n/language';
import { injectMobile } from '@core/layout/mobile';
import { openOnCreate } from '@core/routing/create-param';
import { writeQuery } from '@core/routing/query-state';
import { Snackbar } from '@core/snackbar/snackbar';
import { HelpButton } from '@features/help/parts';
import { TeacherColors } from '@features/identity/parts';
import { BroadcastDialog } from '@features/notifications/parts';
import { monthLabel, toIsoDate, toIsoMonth } from '@shared/dates/iso-date';
import { formatMoney, toMajorUnits } from '@shared/money/money';
import { MoneyPipe } from '@shared/money/money.pipe';
import { Avatar } from '@shared/ui/avatar';
import { EmptyState } from '@shared/ui/empty-state';
import { FilterChip, FilterChips } from '@shared/ui/filter-chips';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes } from '@shared/ui/panes';
import { PAYMENTS_TAB } from '../card-link';
import { BillingApi } from '../data-access/billing-api';
import {
  BillingOverview,
  BillingSummary,
  Operation,
  OperationKind,
  Operations,
  StudentBalance,
  WeekTotal,
} from '../data-access/billing.models';
import { T } from '../i18n/texts';
import { PaymentDialog } from './payment-dialog';

/** The filter of the journal: all operations or one kind of them. */
export type OperationsFilter = 'all' | 'payments' | 'lessons' | 'absences';

const KINDS: Readonly<Record<Exclude<OperationsFilter, 'all'>, OperationKind>> = {
  payments: 'PAYMENT',
  lessons: 'LESSON',
  absences: 'ABSENCE',
};

/** A prepayment that covers this many lessons or fewer is «running out» (ours: M3 publishes no such rule). */
const RUNNING_OUT_LESSONS = 2;
/** Rows of «Авансы заканчиваются». */
const RUNNING_OUT_ROWS = 5;

const FILTERS: readonly OperationsFilter[] = ['all', 'payments', 'lessons', 'absences'];

function filterFrom(kind: string | null): OperationsFilter {
  return FILTERS.find((filter) => filter === kind) ?? 'all';
}

/** The month of the address; the current one when it is missing or not `YYYY-MM`. */
function monthFrom(month: string | null): string {
  return month !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : toIsoMonth(new Date());
}

/** A student whose prepayment is running out, with the lessons it still covers. */
interface RunningOut {
  readonly student: StudentBalance;
  readonly lessons: number;
}

/** A bar of «По неделям». */
interface WeekBar {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly amount: string;
  /** Height in percent of the tallest bar. */
  readonly height: number;
  /** The week of today (not over yet). */
  readonly current: boolean;
}

const NUMBER = new Intl.NumberFormat(locale());

/**
 * Teacher's «Оплаты» (spec §10.2): the month with ‹ ›, «Отчёт за месяц», four figures and the journal of the
 * month with chips in the flexible pane; the supporting pane «По ученикам» holds debtors, prepayments running out
 * and the weekly income. The balances list lives in Students (chip «Должники»).
 */
@Component({
  selector: 'tb-billing-overview-page',
  imports: [
    Avatar,
    BroadcastDialog,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Button,
    EmptyState,
    FilterChips,
    HelpButton,
    LoadStateView,
    MoneyPipe,
    PageHeader,
    Pane,
    Panes,
    PaymentDialog,
    ReactiveFormsModule,
    RouterLink,
    Select,
    Tooltip,
  ],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      <tb-pane [label]="t.title">
        <div tbPaneHeader>
          <tb-page-header class="tb-billing-header" [title]="monthTitle()">
            <tb-help-button help topic="teacher/billing" />
            <div class="tb-ops-month-actions">
              @if (mobile()) {
                <span>{{ monthTitle() }}</span>
              }
              <p-button
                icon="tb-i tb-i-chevron_left"
                [text]="true"
                [rounded]="true"
                severity="secondary"
                [pTooltip]="t.previousMonth"
                [ariaLabel]="t.previousMonth"
                (onClick)="shift(-1)"
              />
              <p-button
                icon="tb-i tb-i-chevron_right"
                [text]="true"
                [rounded]="true"
                severity="secondary"
                [pTooltip]="t.nextMonth"
                [ariaLabel]="t.nextMonth"
                [disabled]="isCurrentMonth()"
                (onClick)="shift(1)"
              />
              <a
                pButton
                routerLink="/teacher/billing/report"
                [queryParams]="{ month: month() }"
                severity="secondary"
              >
                <i pButtonIcon aria-hidden="true" class="tb-i tb-i-download"></i>
                <span pButtonLabel>{{ t.report }}</span>
              </a>
            </div>
            <!-- wider, the rail's «Создать» is the page's FAB (spec §1 principle 5) -->
            @if (mobile()) {
              <p-button
                class="tb-page-fab"
                [label]="t.payment"
                icon="tb-i tb-i-account_balance_wallet"
                (onClick)="openPayment()"
                [disabled]="!overview()"
              />
            }
          </tb-page-header>
          @if (summary(); as summary) {
            <dl class="tb-ops-figures">
              <div class="tb-ops-figure">
                <dt class="tb-figure__label">{{ t.income }}</dt>
                <dd class="tb-figure__value">{{ summary.income | money: summary.currency }}</dd>
                <dd class="tb-ops-figure__note">{{ t.payments(paymentsCount()) }}</dd>
              </div>
              <div class="tb-ops-figure">
                <dt class="tb-figure__label">{{ t.charged }}</dt>
                <dd class="tb-figure__value">{{ charged() | money: summary.currency }}</dd>
                <dd class="tb-ops-figure__note">{{ t.chargedLessons(chargedLessons()) }}</dd>
              </div>
              <div
                class="tb-ops-figure tb-ops-figure--debt"
                [class.tb-ops-figure--debt-none]="summary.totalDebt === 0"
              >
                <dt class="tb-figure__label">{{ t.debt }}</dt>
                <dd class="tb-figure__value">{{ summary.totalDebt | money: summary.currency }}</dd>
                <dd class="tb-ops-figure__note">{{ t.students(summary.debtors) }}</dd>
              </div>
              <div class="tb-ops-figure">
                <dt class="tb-figure__label">{{ t.prepaid }}</dt>
                <dd class="tb-figure__value">
                  {{ overview()?.totalPrepaid ?? 0 | money: summary.currency }}
                </dd>
                <dd class="tb-ops-figure__note">{{ t.students(prepaidStudents()) }}</dd>
              </div>
            </dl>

            <div class="tb-ops__bar">
              <h2 class="tb-ops__title">{{ t.operations }}</h2>
              <div class="tb-ops__filters">
                <tb-filter-chips
                  [label]="t.filters"
                  [chips]="chips()"
                  [value]="filter()"
                  (valueChange)="setFilter($event)"
                />
                <p-select
                  [formControl]="studentControl"
                  [options]="students()"
                  optionLabel="displayName"
                  optionValue="studentId"
                  [placeholder]="t.student"
                  [showClear]="true"
                  [ariaLabel]="t.studentFilter"
                  styleClass="tb-ops__student"
                  appendTo="body"
                />
              </div>
            </div>
          }
        </div>
        <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
          @if (summary(); as summary) {
            @if (list().length > 0) {
              <ul class="tb-list tb-ops__list" [attr.aria-label]="t.operations">
                @for (operation of list(); track operation.id) {
                  <li>
                    <span class="tb-ops__lead">
                      <span
                        class="tb-list__lead"
                        [class.tb-ops__lead--payment]="operation.kind === 'PAYMENT'"
                        aria-hidden="true"
                        ><i [class]="icon(operation)"></i
                      ></span>
                      <tb-avatar
                        [attr.data-tb-label]="colors.studentLabel(operation.studentId)"
                        [name]="operation.studentName"
                        [photo]="operation.studentAvatar"
                        size="2rem"
                      />
                    </span>
                    <div class="tb-list__text">
                      <a
                        [routerLink]="['/teacher/students', operation.studentId]"
                        [queryParams]="paymentsTab"
                        class="tb-list__title tb-list__link"
                        >{{ title(operation)
                        }}<span class="tb-ops__who"> · {{ operation.studentName }}</span></a
                      >
                      <span class="tb-list__supporting"
                        ><span class="tb-ops__who-compact">{{ operation.studentName }} · </span
                        >{{ details(operation) }}</span
                      >
                    </div>
                    <div class="tb-list__trail">
                      <span
                        class="tb-ops__amount"
                        [class.tb-positive]="operation.amount > 0"
                        [class.tb-muted]="operation.amount === 0"
                        >{{ amountText(operation, summary.currency) }}</span
                      >
                    </div>
                  </li>
                }
              </ul>
            } @else {
              <tb-empty-state icon="tb-i-account_balance_wallet" [title]="t.emptyMonth" />
            }
          }
        </tb-load-state>
      </tb-pane>

      @if (!mobile()) {
        <tb-pane kind="fixed" [label]="t.byStudents">
          <div tbPaneHeader class="tb-ops__bar tb-ops__bar--pane">
            <h2 class="tb-ops__pane-title">{{ t.byStudents }}</h2>
            <a class="tb-link tb-ops__all" routerLink="/teacher/students">{{ t.allInStudents }}</a>
          </div>
          @if (overview(); as overview) {
            <section class="tb-ops">
              <h3 class="tb-ops__overline">{{ t.debtors }}</h3>
              @if (debtors().length > 0) {
                <ul class="tb-list tb-ops__people">
                  @for (row of debtors(); track row.studentId) {
                    <li>
                      <tb-avatar
                        [attr.data-tb-label]="colors.studentLabel(row.studentId)"
                        [name]="row.displayName"
                        [photo]="row.avatar"
                      />
                      <div class="tb-list__text">
                        <a
                          [routerLink]="['/teacher/students', row.studentId]"
                          [queryParams]="paymentsTab"
                          class="tb-list__title tb-list__link"
                          >{{ row.displayName }}</a
                        >
                        <span class="tb-list__supporting">{{ owedText(row) }}</span>
                      </div>
                      <div class="tb-list__trail">
                        <span class="tb-negative tb-ops__amount">{{
                          row.balance | money: overview.currency
                        }}</span>
                      </div>
                    </li>
                  }
                </ul>
                <p-button
                  class="tb-ops__remind"
                  icon="tb-i tb-i-send"
                  [label]="t.remind"
                  severity="secondary"
                  (onClick)="remindVisible.set(true)"
                />
              } @else {
                <p class="tb-muted">{{ t.noDebtors }}</p>
              }
            </section>

            @if (runningOut().length > 0) {
              <section class="tb-ops">
                <h3 class="tb-ops__overline">{{ t.running }}</h3>
                <ul class="tb-list tb-ops__people">
                  @for (row of runningOut(); track row.student.studentId) {
                    <li>
                      <tb-avatar
                        [attr.data-tb-label]="colors.studentLabel(row.student.studentId)"
                        [name]="row.student.displayName"
                        [photo]="row.student.avatar"
                      />
                      <div class="tb-list__text">
                        <a
                          [routerLink]="['/teacher/students', row.student.studentId]"
                          [queryParams]="paymentsTab"
                          class="tb-list__title tb-list__link"
                          >{{ row.student.displayName }}</a
                        >
                        <span class="tb-list__supporting">{{ t.lastsFor(row.lessons) }}</span>
                      </div>
                      <div class="tb-list__trail">
                        <span class="tb-ops__amount">{{
                          row.student.balance | money: overview.currency
                        }}</span>
                      </div>
                    </li>
                  }
                </ul>
              </section>
            }
          }

          @if (bars().length > 0) {
            <section class="tb-ops">
              <h3 class="tb-ops__overline">{{ t.byWeeks }}</h3>
              <ol class="tb-ops__weeks">
                @for (bar of bars(); track bar.key) {
                  <li class="tb-ops__week" [class.tb-ops__week--current]="bar.current">
                    <span class="tb-ops__week-value">{{ bar.value }}</span>
                    <span class="tb-ops__week-bar" [style.height.%]="bar.height"></span>
                    <span class="tb-ops__week-label">{{ bar.label }}</span>
                    <span class="tb-sr-only">{{ bar.amount }}</span>
                  </li>
                }
              </ol>
            </section>
          }
        </tb-pane>
      }
    </tb-panes>

    @if (overview(); as overview) {
      <tb-payment-dialog
        [(visible)]="paymentVisible"
        [students]="overview.students"
        [studentId]="null"
        [currency]="overview.currency"
        (saved)="onSaved(t.paymentSaved)"
      />
      <tb-broadcast-dialog
        [(visible)]="remindVisible"
        [toGroup]="debtorsGroup()"
        (sent)="snackbar.success(t.reminderSent)"
      />
    }
  `,
  styles: `
    .tb-ops-month-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    /* the four figures of the month: tonal blocks of the list group's corner (ours); the debt is the error container */
    .tb-ops-figures {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--tb-space-3);
      margin: 0 0 var(--tb-space-6);
    }

    .tb-ops-figure {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
      min-width: 0;
      margin: 0;
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--tb-list-item);

      dd {
        margin: 0;
      }
    }

    .tb-ops-figure--debt:not(.tb-ops-figure--debt-none) {
      background: var(--p-md-error-container);
      color: var(--p-md-on-error-container);

      .tb-figure__label,
      .tb-ops-figure__note {
        color: inherit;
      }
    }

    .tb-ops-figure__note {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }

    .tb-ops {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      margin-block-end: var(--tb-space-6);
    }

    .tb-ops__bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-3);
    }

    .tb-ops__bar--pane {
      margin-block-end: var(--tb-space-4);
    }

    .tb-ops__filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-ops__title,
    .tb-ops__overline {
      margin: 0;
      font: var(--tb-type-title-m-emphasized);
    }

    .tb-ops__overline {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-s);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .tb-ops__pane-title {
      margin: 0;
      font: var(--tb-type-title-l-emphasized);
    }

    .tb-ops__all {
      font: var(--tb-type-label-l);
    }

    .tb-ops__list,
    .tb-ops__people {
      --tb-list-outer: var(--tb-shape-lg);
    }

    .tb-ops__lead {
      display: flex;
      grid-area: lead;
      align-items: center;
      gap: var(--tb-space-3);
    }

    .tb-ops__lead--payment {
      background: color-mix(in srgb, var(--p-md-success) 18%, var(--p-md-surface));
      color: var(--p-md-success);
    }

    .tb-ops__amount {
      font: var(--tb-type-title-s);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .tb-ops__remind {
      align-self: flex-start;
    }

    /* weekly income: bars of the primary container's strong tone, the running week lighter (ours) */
    .tb-ops__weeks {
      display: flex;
      align-items: flex-end;
      gap: var(--tb-space-2);
      block-size: 10rem;
      margin: 0;
      padding: 0 0 var(--tb-space-1);
      border-block-end: 1px solid var(--p-md-outline-variant);
      list-style: none;
    }

    .tb-ops__week {
      display: grid;
      flex: 1;
      grid-template-rows: auto 1fr auto;
      justify-items: center;
      align-items: end;
      block-size: 100%;
      min-width: 0;
      position: relative;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-s);
    }

    .tb-ops__week-bar {
      inline-size: 100%;
      border-start-start-radius: var(--tb-shape-xs);
      border-start-end-radius: var(--tb-shape-xs);
      background: var(--p-md-primary);
    }

    .tb-ops__week--current .tb-ops__week-bar {
      background: var(--p-md-primary-container);
    }

    .tb-ops__week-label {
      position: absolute;
      inset-block-start: calc(100% + var(--tb-space-1));
    }

    .tb-ops__weeks {
      margin-block-end: var(--tb-space-6);
    }

    .tb-ops__who-compact {
      display: none;
    }

    @media (width < 50em) {
      .tb-ops-figures {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    /* Compact keeps all figures and filters visible; journal supporting text wraps inside the tile. */
    @media (width < 37.5em) {
      .tb-ops-month-actions {
        inline-size: 100%;
        min-inline-size: 0;

        > span {
          flex: 1;
        }

        > a {
          flex: 1 1 100%;
        }
      }

      .tb-ops-figures {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        margin-block-end: var(--tb-space-4);
      }

      .tb-ops-figure {
        min-inline-size: 0;
      }

      .tb-ops-figure .tb-figure__value {
        font: var(--tb-type-headline-s);
        overflow-wrap: anywhere;
      }

      .tb-ops__title,
      .tb-ops__filters p-select {
        display: none;
      }

      .tb-ops__filters {
        inline-size: 100%;
      }

      .tb-ops__lead .tb-list__lead {
        display: none;
      }

      .tb-ops__who {
        display: none;
      }

      .tb-ops__list .tb-list__text {
        min-width: 0;
      }

      .tb-ops__list .tb-list__supporting {
        white-space: normal;
        overflow-wrap: anywhere;
      }

      .tb-ops__who-compact {
        display: inline;
      }
    }
  `,
})
export class BillingOverviewPage implements OnInit {
  protected readonly paymentsTab = PAYMENTS_TAB;
  protected readonly mobile = injectMobile();
  protected readonly t = T.overview;
  protected readonly colors = inject(TeacherColors);
  protected readonly snackbar = inject(Snackbar);
  private readonly api = inject(BillingApi);
  private readonly date = inject(DatePipe);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  /** The filters of the journal come from the address (`?month=&kind=&student=`) and go back to it. */
  private readonly fromUrl = this.route.snapshot.queryParamMap;

  protected readonly overview = signal<BillingOverview | null>(null);
  protected readonly summary = signal<BillingSummary | null>(null);
  /** The whole journal of the month: the figures count it, the list shows it when nothing is chosen. */
  private readonly all = signal<Operations | null>(null);
  /** The journal narrowed by the chip or the student. */
  private readonly narrowed = signal<Operations | null>(null);
  protected readonly state = new LoadState();

  protected readonly month = signal(monthFrom(this.fromUrl.get('month')));
  protected readonly filter = signal<OperationsFilter>(filterFrom(this.fromUrl.get('kind')));
  readonly studentControl = new FormControl<string | null>(this.fromUrl.get('student'));
  private readonly chosenStudent = signal<string | null>(this.fromUrl.get('student'));
  private readonly narrow = new Subject<void>();

  protected readonly paymentVisible = signal(false);
  protected readonly remindVisible = signal(false);

  protected readonly monthTitle = computed(() => {
    const label = monthLabel(this.month());
    return label.charAt(0).toUpperCase() + label.slice(1);
  });
  protected readonly isCurrentMonth = computed(() => this.month() >= toIsoMonth(new Date()));

  protected readonly chips = computed<FilterChip<OperationsFilter>[]>(() => [
    { value: 'all', label: this.t.chips.all },
    { value: 'payments', label: this.t.chips.payments },
    { value: 'lessons', label: this.t.chips.lessons },
    { value: 'absences', label: this.t.chips.absences },
  ]);
  protected readonly students = computed(() =>
    (this.overview()?.students ?? []).filter((student) => student.status === 'ACTIVE'),
  );

  private readonly narrowedBy = computed(
    () => this.filter() !== 'all' || this.chosenStudent() !== null,
  );
  protected readonly list = computed<Operation[]>(
    () => (this.narrowedBy() ? (this.narrowed() ?? this.all()) : this.all())?.operations ?? [],
  );

  protected readonly paymentsCount = computed(
    () =>
      (this.all()?.operations ?? []).filter(
        (operation) => operation.kind === 'PAYMENT' && !operation.voided,
      ).length,
  );
  protected readonly chargedLessons = computed(
    () =>
      (this.all()?.operations ?? []).filter(
        (operation) => operation.kind !== 'PAYMENT' && operation.amount < 0,
      ).length,
  );
  protected readonly charged = computed(() =>
    (this.summary()?.weeks ?? []).reduce((sum, week) => sum + week.charged, 0),
  );
  protected readonly prepaidStudents = computed(
    () => (this.overview()?.students ?? []).filter((student) => student.balance > 0).length,
  );

  protected readonly debtors = computed<StudentBalance[]>(() =>
    (this.overview()?.students ?? [])
      .filter((student) => student.balance < 0)
      .sort((a, b) => a.balance - b.balance),
  );
  protected readonly debtorsGroup = computed(() => ({
    name: this.t.debtors,
    members: this.debtors().map((student) => ({
      id: student.studentId,
      displayName: student.displayName,
    })),
  }));
  protected readonly runningOut = computed<RunningOut[]>(() =>
    (this.overview()?.students ?? [])
      .filter((student) => student.balance > 0 && student.lessonPrice > 0)
      .map((student) => ({
        student,
        lessons: Math.floor(student.balance / student.lessonPrice),
      }))
      .filter((row) => row.lessons <= RUNNING_OUT_LESSONS)
      .sort((a, b) => a.lessons - b.lessons || a.student.balance - b.student.balance)
      .slice(0, RUNNING_OUT_ROWS),
  );

  protected readonly bars = computed<WeekBar[]>(() => {
    const summary = this.summary();
    const weeks = summary?.weeks ?? [];
    const top = Math.max(0, ...weeks.map((week) => week.income));
    const today = toIsoDate(new Date());
    return weeks.map((week) => this.bar(week, top, today, summary?.currency ?? 'RUB'));
  });

  constructor() {
    openOnCreate('payment', () => {
      this.openPayment();
    });
    this.studentControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.chosenStudent.set(id);
      writeQuery(this.router, this.route, { student: id });
      this.narrow.next();
    });
    this.narrow
      .pipe(
        switchMap(() => {
          if (!this.narrowedBy()) {
            return EMPTY;
          }
          this.narrowed.set(null);
          const filter = this.filter();
          return this.api
            .operations(
              this.month(),
              filter === 'all' ? undefined : KINDS[filter],
              this.chosenStudent() ?? undefined,
            )
            .pipe(catchError(() => EMPTY));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((operations) => {
        this.narrowed.set(operations);
      });
  }

  ngOnInit(): void {
    this.load();
  }

  /** Chooses another kind of operations. */
  protected setFilter(filter: OperationsFilter): void {
    this.filter.set(filter);
    writeQuery(this.router, this.route, { kind: filter === 'all' ? null : filter });
    this.narrow.next();
  }

  protected shift(by: number): void {
    const [year, month] = this.month().split('-').map(Number);
    this.month.set(toIsoMonth(new Date(year ?? 0, (month ?? 1) - 1 + by, 1)));
    writeQuery(this.router, this.route, {
      month: this.isCurrentMonth() ? null : this.month(),
    });
    this.loadMonth();
  }

  protected openPayment(): void {
    this.paymentVisible.set(true);
  }

  protected onSaved(message: string): void {
    this.snackbar.success(message);
    this.load();
  }

  protected load(): void {
    const month = this.month();
    forkJoin({
      overview: this.api.overview(quietContext()),
      summary: this.api.summary(month),
      operations: this.api.operations(month),
    })
      .pipe(this.state.track(), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ overview, summary, operations }) => {
        this.overview.set(overview);
        this.showMonth(month, summary, operations);
      });
  }

  private loadMonth(): void {
    const month = this.month();
    forkJoin({ summary: this.api.summary(month), operations: this.api.operations(month) })
      .pipe(this.state.track(), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ summary, operations }) => {
        this.showMonth(month, summary, operations);
      });
  }

  /** Shows a month unless another one was chosen while it loaded. */
  private showMonth(month: string, summary: BillingSummary, operations: Operations): void {
    if (month !== this.month()) {
      return;
    }
    this.summary.set(summary);
    this.all.set(operations);
    this.narrow.next();
  }

  protected icon(operation: Operation): string {
    switch (operation.kind) {
      case 'PAYMENT':
        return 'tb-i tb-i-account_balance_wallet';
      case 'LESSON':
        return 'tb-i tb-i-event';
      case 'ABSENCE':
        return 'tb-i tb-i-event_busy';
    }
  }

  protected title(operation: Operation): string {
    switch (operation.kind) {
      case 'PAYMENT':
        return this.t.paymentOperation;
      case 'LESSON':
        return this.t.lesson;
      case 'ABSENCE':
        return operation.status === 'CANCELLED' ? this.t.cancelledLesson : this.t.absence;
    }
  }

  /** «19.10 · Неравенства»: the day, then the topic or the comment; what is not charged or voided says so. */
  protected details(operation: Operation): string {
    return [
      this.date.transform(operation.date, 'dd.MM'),
      operation.note,
      operation.voided && operation.kind === 'PAYMENT' ? this.t.voided : null,
      operation.kind === 'ABSENCE' && operation.amount === 0 ? this.t.free : null,
    ]
      .filter((part): part is string => part !== null && part !== '')
      .join(' · ');
  }

  /** «+6 000 ₽», «−1 500 ₽» (the minus sign), «0 ₽». */
  protected amountText(operation: Operation, currency: string): string {
    if (operation.amount > 0) {
      return `+${formatMoney(operation.amount, currency)}`;
    }
    return operation.amount < 0
      ? `−${formatMoney(-operation.amount, currency)}`
      : formatMoney(0, currency);
  }

  /** «2 занятия · последнее 12.10»: the lessons the debt covers. */
  protected owedText(row: StudentBalance): string {
    const lessons =
      row.lessonPrice > 0 ? Math.max(1, Math.ceil(-row.balance / row.lessonPrice)) : null;
    return [
      lessons === null ? null : this.t.owed(lessons),
      row.lastLessonDate === null
        ? null
        : this.t.lastLesson(this.date.transform(row.lastLessonDate, 'dd.MM') ?? ''),
    ]
      .filter((part): part is string => part !== null)
      .join(' · ');
  }

  private bar(week: WeekTotal, top: number, today: string, currency: string): WeekBar {
    const first = Number(week.from.slice(8));
    const last = Number(week.to.slice(8));
    const label = first === last ? String(first) : `${String(first)}–${String(last)}`;
    return {
      key: week.from,
      label,
      value: NUMBER.format(toMajorUnits(week.income, currency)),
      amount: this.t.weekIncome(label, formatMoney(week.income, currency)),
      height: top === 0 ? 0 : week.income === 0 ? 0 : Math.max(2, (week.income / top) * 100),
      current: week.from <= today && today <= week.to,
    };
  }
}
