import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { locale } from '@core/i18n/language';
import { PriceField } from '@features/billing/parts';
import { CurrencyField } from '@features/settings/fields/currency-field';
import { DurationField } from '@features/settings/fields/lesson-rule-fields';
import { TimeZoneField } from '@features/settings/fields/time-zone-field';
import { T } from '@features/settings/i18n/texts';
import { zoneLabel } from '@features/settings/lesson-options';
import { formatMoney, toMinorUnits } from '@shared/money/money';
import { Saved } from './setup-state';

/** The fields of «Время и оплата»; the price in major units. */
export type TimeForm = FormGroup<{
  zone: FormControl<string>;
  duration: FormControl<number | null>;
  currency: FormControl<string>;
  price: FormControl<number | null>;
}>;

const t = T.setup;

/** A sample lesson at 18:00 next Thursday on this device (sketch OnbTime). */
function sampleLesson(now = new Date()): Date {
  const lesson = new Date(now);
  lesson.setDate(now.getDate() + ((4 - now.getDay() + 7) % 7 || 7));
  lesson.setHours(18, 0, 0, 0);
  return lesson;
}

/** «Время и оплата»: the time zone, the lesson length, the currency and the price of a lesson. */
@Component({
  selector: 'tb-setup-time-step',
  imports: [ReactiveFormsModule, Card, CurrencyField, DurationField, PriceField, TimeZoneField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <form id="setup-time" class="tb-stack" [formGroup]="form()" (ngSubmit)="submitted.emit()">
      <button type="submit" class="tb-sr-only" tabindex="-1" aria-hidden="true"></button>
      <p-card [header]="t.timeCard" styleClass="tb-section-card tb-section-card--flow">
        <tb-time-zone-field inputId="setup-zone" [control]="form().controls.zone" />
        <tb-duration-field
          inputId="setup-duration"
          [hint]="true"
          [control]="form().controls.duration"
        />
      </p-card>
      <p-card [header]="t.paymentCard" styleClass="tb-section-card tb-section-card--flow">
        <div class="tb-setup__two">
          <tb-currency-field
            inputId="setup-currency"
            [short]="true"
            [locked]="locked()"
            [control]="form().controls.currency"
          />
          <tb-price-field
            inputId="setup-price"
            [short]="true"
            [currency]="currency() ?? 'RUB'"
            [control]="form().controls.price"
          />
        </div>
        <small class="tb-hint tb-setup__shared-hint"
          ><i class="tb-i tb-i-info" aria-hidden="true"></i>{{ t.paymentHint }}</small
        >
      </p-card>
    </form>
  `,
  styles: `
    .tb-setup__two {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
      gap: var(--tb-space-3);
      align-items: start;
    }

    .tb-setup__shared-hint {
      display: flex;
      gap: var(--tb-space-1);

      .tb-i {
        font-size: 1rem;
      }
    }
  `,
})
export class SetupTimeStep {
  protected readonly t = t;
  readonly form = input.required<TimeForm>();
  /** Payments exist: the currency is kept. */
  readonly locked = input.required<boolean>();
  /** The currency as the price shows it: the chosen one, or the locked one. */
  readonly currency = input.required<string | null>();
  /** «Далее» by Enter in a field. */
  readonly submitted = output();
}

/** A lesson and a monthly report as the schedule will show them (sketch OnbTime). */
@Component({
  selector: 'tb-setup-time-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <div class="tb-setup__preview">
      <div class="tb-setup__lesson">
        <span class="tb-setup__time">
          <small>{{ lessonDay }}</small>
          <b>{{ lessonStart }}</b>
        </span>
        <span class="tb-setup__lesson-text">
          <b>{{ t.sampleStudent }}</b>
          <span class="tb-muted">{{ lessonLine() }}</span>
        </span>
      </div>
      <div class="tb-setup__lesson">
        <span class="tb-setup__time tb-setup__time--tonal">
          <small>{{ t.month }}</small>
          <b>{{ currencySign() }}</b>
        </span>
        <span class="tb-setup__lesson-text">
          <b>{{ t.report(monthName) }}</b>
          <span class="tb-muted">{{ reportLine() }}</span>
        </span>
      </div>
    </div>
    <p class="tb-setup__note">
      <i class="tb-i tb-i-schedule" aria-hidden="true"></i>{{ t.zoneLater }}
    </p>
  `,
  styles: `
    .tb-setup__preview {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      padding: var(--tb-space-5);
      border-radius: var(--tb-shape-lg-increased, 1.25rem);
      background: var(--p-md-surface-container);
    }

    .tb-setup__lesson {
      display: flex;
      align-items: center;
      gap: var(--tb-space-4);
      padding: var(--tb-space-3) var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-lowest);
    }

    .tb-setup__time {
      display: flex;
      flex: 0 0 4.5rem;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 4.5rem;
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-primary);
      color: var(--p-md-on-primary);

      small {
        font: var(--tb-type-label-m);
      }

      b {
        font: var(--tb-type-title-l-emphasized);
      }
    }

    .tb-setup__time--tonal {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    .tb-setup__lesson-text {
      display: flex;
      flex-direction: column;
      min-width: 0;

      b {
        font: var(--tb-type-title-m);
      }
    }

    .tb-setup__note {
      display: flex;
      gap: var(--tb-space-3);
      align-items: flex-start;
      margin: 0;
      padding: var(--tb-space-3) var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      font: var(--tb-type-body-m);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }
  `,
})
export class SetupTimePreview {
  protected readonly t = t;
  /** The fields of «Время и оплата» as they are typed. */
  readonly values =
    input.required<Partial<{ zone: string; duration: number | null; price: number | null }>>();
  /** The currency as the price shows it: the chosen one, or the locked one. */
  readonly currency = input.required<string | null>();
  readonly saved = input.required<Saved | null>();

  protected readonly currencySign = computed(() => {
    const code = this.currency() ?? 'RUB';
    return (
      new Intl.NumberFormat(locale(), {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? code
    );
  });

  private readonly lesson = sampleLesson();
  private readonly timeFormat = new Intl.DateTimeFormat(locale(), {
    hour: '2-digit',
    minute: '2-digit',
  });
  protected readonly lessonDay = new Intl.DateTimeFormat(locale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  }).format(this.lesson);
  protected readonly lessonStart = this.timeFormat.format(this.lesson);
  protected readonly monthName = new Intl.DateTimeFormat(locale(), { month: 'long' }).format(
    new Date(),
  );
  protected readonly lessonLine = computed(() => {
    const values = this.values();
    const minutes = values.duration ?? this.saved()?.rules.defaultDurationMinutes ?? 60;
    const end = new Date(this.lesson.getTime() + minutes * 60_000);
    const span = `${this.lessonStart}–${this.timeFormat.format(end)}`;
    const price = values.price ?? 0;
    const currency = this.currency();
    return price > 0 && currency !== null
      ? `${span} · ${formatMoney(toMinorUnits(price, currency), currency)}`
      : span;
  });
  protected readonly reportLine = computed(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const day = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long' }).format(last);
    return t.reportSpan(day, zoneLabel(this.values().zone ?? ''));
  });
}
