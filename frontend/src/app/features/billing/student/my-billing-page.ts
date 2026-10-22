import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HelpButton } from '@features/help/parts';
import { MoneyPipe } from '@shared/money/money.pipe';
import { BillingApi } from '../data-access/billing-api';
import { StudentLedger } from '../data-access/billing.models';
import { BalanceAmount } from '../ledger/balance-amount';
import { LedgerList } from '../ledger/ledger-list';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes } from '@shared/ui/panes';
import { FilterChip, FilterChips } from '@shared/ui/filter-chips';
import { T } from '../i18n/texts';

/** Student: own balance and history of lessons and payments. */
@Component({
  selector: 'tb-my-billing-page',
  imports: [
    HelpButton,
    MoneyPipe,
    BalanceAmount,
    LedgerList,
    LoadStateView,
    PageHeader,
    Pane,
    Panes,
    FilterChips,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      <tb-pane [label]="t.title">
        <tb-page-header [title]="t.title">
          <tb-help-button help topic="cabinet/billing" />
        </tb-page-header>
        <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
          @if (ledger(); as ledger) {
            <dl class="tb-my-billing-figures">
              <div class="tb-my-billing-figure">
                <dt class="tb-figure__label">{{ t.balance }}</dt>
                <dd class="tb-figure__value">
                  <tb-balance-amount [balance]="ledger.balance" [currency]="ledger.currency" />
                </dd>
                <dd class="tb-my-billing-figure__note">
                  @if (ledger.balance < 0) {
                    {{ t.toPay }}
                  } @else if (ledger.balance > 0) {
                    {{ t.prepaid }}
                  } @else {
                    {{ t.settled }}
                  }
                </dd>
              </div>
              <div class="tb-my-billing-figure">
                <dt class="tb-figure__label">{{ totals.charged }}</dt>
                <dd class="tb-figure__value">{{ ledger.charged | money: ledger.currency }}</dd>
              </div>
              <div class="tb-my-billing-figure">
                <dt class="tb-figure__label">{{ totals.paid }}</dt>
                <dd class="tb-figure__value">{{ ledger.paid | money: ledger.currency }}</dd>
              </div>
              <div class="tb-my-billing-figure">
                <dt class="tb-figure__label">{{ t.lessonPrice }}</dt>
                <dd class="tb-figure__value">{{ ledger.lessonPrice | money: ledger.currency }}</dd>
              </div>
            </dl>
            <section class="tb-my-billing-history" [attr.aria-label]="t.history">
              <div class="tb-my-billing-history__bar">
                <h2>{{ t.history }}</h2>
                <tb-filter-chips
                  [label]="operations.filters"
                  [chips]="chips()"
                  [(value)]="filter"
                />
              </div>
              @if (filteredLedger(); as history) {
                <tb-ledger-list [ledger]="history" />
              }
            </section>
          }
        </tb-load-state>
      </tb-pane>
    </tb-panes>
  `,
  styles: `
    .tb-my-billing-figures {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--tb-space-3);
      margin: 0 0 var(--tb-space-6);
    }

    .tb-my-billing-figure {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
      min-inline-size: 0;
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--tb-list-item);

      dd {
        margin: 0;
      }
    }

    .tb-my-billing-figure__note {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }

    .tb-my-billing-history__bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--tb-space-3);
      margin-block-end: var(--tb-space-3);

      h2 {
        margin: 0;
        font: var(--tb-type-title-m-emphasized);
      }
    }

    @media (width < 75em) {
      .tb-my-billing-figures {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    /* Our decision: use the teacher's horizontally scrolling figures on compact. */
    @media (width < 37.5em) {
      .tb-my-billing-figures {
        display: flex;
        margin-inline: calc(-1 * var(--tb-space-4));
        padding-inline: var(--tb-space-4);
        overflow-x: auto;
        scroll-snap-type: x proximity;
      }

      .tb-my-billing-figure {
        flex: 0 0 12rem;
        scroll-snap-align: start;
      }

      .tb-my-billing-history__bar tb-filter-chips {
        flex-wrap: nowrap;
        max-inline-size: 100%;
        overflow-x: auto;
      }
    }
  `,
})
export class MyBillingPage implements OnInit {
  protected readonly t = T.myBilling;
  protected readonly totals = T.studentLedger;
  protected readonly operations = T.overview;
  private readonly api = inject(BillingApi);

  protected readonly ledger = signal<StudentLedger | null>(null);
  protected readonly state = new LoadState();
  protected readonly filter = signal('all');
  protected readonly chips = computed<readonly FilterChip<string>[]>(() =>
    Object.entries(T.overview.chips).map(([value, label]) => ({ value, label })),
  );
  protected readonly filteredLedger = computed(() => {
    const ledger = this.ledger();
    if (ledger === null) return null;
    const filter = this.filter();
    return {
      ...ledger,
      lessons: ledger.lessons.filter((lesson) =>
        filter === 'payments'
          ? false
          : filter === 'absences'
            ? lesson.status === 'MISSED'
            : filter === 'lessons'
              ? lesson.status !== 'MISSED'
              : true,
      ),
      payments: filter === 'all' || filter === 'payments' ? ledger.payments : [],
    };
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .myLedger()
      .pipe(this.state.track())
      .subscribe((ledger) => {
        this.ledger.set(ledger);
      });
  }
}
