import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { MoneyPipe } from '@shared/money/money.pipe';
import { RowType } from '@shared/ui/row-type.directive';
import { BillingApi } from '../data-access/billing-api';
import { BillingOverview, StudentBalance } from '../data-access/billing.models';
import { BalanceAmount } from '../ledger/balance-amount';
import { LessonDialog } from './lesson-dialog';
import { PaymentDialog } from './payment-dialog';

/** Teacher: balances of all students and quick recording of lessons and payments. */
@Component({
  selector: 'tb-billing-overview-page',
  imports: [
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
    LessonDialog,
    PaymentDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-page-header">
      <h1 class="tb-page-title">Оплаты</h1>
      <div class="tb-actions">
        <p-button label="Занятие" icon="pi pi-plus" (onClick)="openLesson(null)" [disabled]="!overview()" />
        <p-button label="Оплата" icon="pi pi-wallet" severity="success" (onClick)="openPayment(null)" [disabled]="!overview()" />
        <a pButton routerLink="report" [outlined]="true">
          <i pButtonIcon class="pi pi-chart-bar"></i>
          <span pButtonLabel>Отчёт за месяц</span>
        </a>
      </div>
    </div>

    @if (overview(); as overview) {
      <div class="tb-stats">
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">Долг учеников</span>
            <span class="tb-stat__value" [class.tb-negative]="overview.totalDebt > 0">{{ overview.totalDebt | money: overview.currency }}</span>
          </div>
        </p-card>
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">Авансы</span>
            <span class="tb-stat__value" [class.tb-positive]="overview.totalPrepaid > 0">{{ overview.totalPrepaid | money: overview.currency }}</span>
          </div>
        </p-card>
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">Должников</span>
            <span class="tb-stat__value">{{ debtorsCount() }}</span>
          </div>
        </p-card>
      </div>

      <p-card>
        <div class="tb-toolbar">
          <label class="tb-switch" for="only-debtors">
            <p-toggleswitch inputId="only-debtors" [formControl]="onlyDebtors" />
            Только должники
          </label>
        </div>
        <p-table [value]="rows()" dataKey="studentId" [rowHover]="true">
          <ng-template #header>
            <tr>
              <th>Ученик</th>
              <th>Цена занятия</th>
              <th>Занятий</th>
              <th>Последнее</th>
              <th>Баланс</th>
              <th class="tb-actions-column"><span class="tb-sr-only">Действия</span></th>
            </tr>
          </ng-template>
          <ng-template #body let-row [tbRowType]="rows()">
            <tr>
              <td>
                <a [routerLink]="['students', row.studentId]" class="tb-link">{{ row.displayName }}</a>
                @if (row.status === 'DEACTIVATED') {
                  <small class="tb-muted"> (отключён)</small>
                }
              </td>
              <td>{{ row.lessonPrice | money: overview.currency }}</td>
              <td>{{ row.chargedLessons }}</td>
              <td>{{ row.lastLessonDate ? (row.lastLessonDate | date: 'dd.MM.yyyy') : '—' }}</td>
              <td><tb-balance-amount [balance]="row.balance" [currency]="overview.currency" /></td>
              <td class="tb-actions-column">
                <p-button icon="pi pi-plus" [text]="true" [rounded]="true" pTooltip="Записать занятие"
                  [ariaLabel]="'Занятие: ' + row.displayName" (onClick)="openLesson(row.studentId)" />
                <p-button icon="pi pi-wallet" [text]="true" [rounded]="true" severity="success" pTooltip="Принять оплату"
                  [ariaLabel]="'Оплата: ' + row.displayName" (onClick)="openPayment(row.studentId)" />
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="6" class="tb-empty">
                {{ overview.students.length === 0 ? 'Добавьте учеников в разделе «Ученики»' : 'Должников нет' }}
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>

      <tb-lesson-dialog
        [(visible)]="lessonVisible"
        [students]="activeStudents()"
        [studentId]="selectedStudent()"
        [currency]="overview.currency"
        [defaultDuration]="overview.defaultLessonDuration"
        (saved)="onSaved('Занятие записано')"
      />
      <tb-payment-dialog
        [(visible)]="paymentVisible"
        [students]="overview.students"
        [studentId]="selectedStudent()"
        [currency]="overview.currency"
        (saved)="onSaved('Оплата сохранена')"
      />
    }
  `,
})
export class BillingOverviewPage implements OnInit {
  private readonly api = inject(BillingApi);
  private readonly messages = inject(MessageService);

  protected readonly overview = signal<BillingOverview | null>(null);
  protected readonly onlyDebtors = new FormControl(false, { nonNullable: true });
  private readonly debtorsFilter = toSignal(this.onlyDebtors.valueChanges, { initialValue: false });

  protected readonly rows = computed<StudentBalance[]>(() => {
    const students = this.overview()?.students ?? [];
    return this.debtorsFilter() ? students.filter((student) => student.balance < 0) : students;
  });
  protected readonly activeStudents = computed(() =>
    (this.overview()?.students ?? []).filter((student) => student.status !== 'DEACTIVATED'),
  );
  protected readonly debtorsCount = computed(
    () => (this.overview()?.students ?? []).filter((student) => student.balance < 0).length,
  );

  protected readonly selectedStudent = signal<string | null>(null);
  protected readonly lessonVisible = signal(false);
  protected readonly paymentVisible = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected openLesson(studentId: string | null): void {
    this.selectedStudent.set(studentId);
    this.lessonVisible.set(true);
  }

  protected openPayment(studentId: string | null): void {
    this.selectedStudent.set(studentId);
    this.paymentVisible.set(true);
  }

  protected onSaved(message: string): void {
    this.messages.add({ severity: 'success', summary: 'Готово', detail: message });
    this.load();
  }

  private load(): void {
    this.api.overview().subscribe((overview) => {
      this.overview.set(overview);
    });
  }
}
