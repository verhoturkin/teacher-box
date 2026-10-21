import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MoneyPipe } from '@shared/money/money.pipe';
import { MyBillingSummary } from '../data-access/billing.models';
import { T } from '../i18n/texts';

/** Lessons at which the bar of «Оплачено» is full: about a month of weekly lessons (ours). */
const FULL_BAR = 8;

/**
 * Student's home (spec §10.4): «Оплачено N занятий» — the balance divided by the lesson price in Display Small,
 * the balance and a bar over a tonal block. A debt or no price: the balance alone.
 */
@Component({
  selector: 'tb-my-balance-widget',
  imports: [RouterLink, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let billing = summary();
    <section class="tb-paid" [attr.aria-label]="t.title">
      <p class="tb-paid__overline">{{ t.paid }}</p>
      @if (lessons() === null) {
        <p class="tb-paid__figure" [class.tb-negative]="billing.balance < 0">
          {{
            billing.balance < 0
              ? t.debt((-billing.balance | money: billing.currency) ?? '')
              : (billing.balance | money: billing.currency)
          }}
        </p>
      } @else {
        <p class="tb-paid__figure">
          <span class="tb-paid__number">{{ lessons() }}</span>
          {{ noun() }}
        </p>
        <p class="tb-paid__line">
          {{ t.onBalance((billing.balance | money: billing.currency) ?? '') }}
        </p>
        <div
          class="tb-paid__bar"
          role="progressbar"
          [attr.aria-label]="t.title"
          aria-valuemin="0"
          [attr.aria-valuemax]="full"
          [attr.aria-valuenow]="shown()"
        >
          <span [style.width.%]="(shown() / full) * 100"></span>
        </div>
      }
      <a class="tb-link" routerLink="/cabinet/billing">{{ t.history }}</a>
    </section>
  `,
  styles: `
    .tb-paid {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--tb-list-item);
    }

    p {
      margin: 0;
    }

    .tb-paid__overline {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .tb-paid__figure {
      font: var(--tb-type-title-m);
    }

    .tb-paid__number {
      font: var(--tb-type-display-s);
    }

    .tb-paid__line {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }

    .tb-paid__bar {
      overflow: hidden;
      height: 0.25rem;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-surface-container-highest);

      > span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: var(--p-md-primary);
      }
    }

    a {
      align-self: flex-start;
      font: var(--tb-type-label-l);
    }
  `,
})
export class MyBalanceWidget {
  protected readonly t = T.myBalance;
  protected readonly full = FULL_BAR;
  readonly summary = input.required<MyBillingSummary>();

  /** Whole lessons the balance pays for; `null` — a debt or no price to divide by. */
  protected readonly lessons = computed(() => {
    const { balance, lessonPrice } = this.summary();
    return balance < 0 || lessonPrice <= 0 ? null : Math.floor(balance / lessonPrice);
  });
  protected readonly shown = computed(() => Math.min(this.lessons() ?? 0, FULL_BAR));
  protected readonly noun = computed(() => this.t.lessons(this.lessons() ?? 0));
}
