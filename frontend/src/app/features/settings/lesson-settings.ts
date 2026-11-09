import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MenuItem } from 'primeng/api';
import { Card } from 'primeng/card';
import { InputNumber } from 'primeng/inputnumber';
import { Menu } from 'primeng/menu';
import { Select } from 'primeng/select';
import { Snackbar } from '@core/snackbar/snackbar';
import { BillingApi, CurrencySetting, DefaultPriceCard } from '@features/billing/parts';
import { HomeworkApi } from '@features/homework/parts';
import { LessonRules, ScheduleApi } from '@features/schedule/parts';
import { AssistChip } from '@shared/ui/assist-chip';
import { InputChip } from '@shared/ui/input-chip';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { SettingsApi } from './data-access/settings-api';
import { T } from './i18n/texts';
import {
  Option,
  REMINDER_CHOICES,
  currencyOptions,
  spanLabel,
  zoneOptions,
} from './lesson-options';

const HOUR = 60;
const MAX_REMINDERS = 3;

/**
 * The first column of the settings category «Занятия» (sketch Lessons): «Время и цена» — the time zone, the
 * currency (locked once a lesson or payment is recorded), the default lesson length and price — and «Правила»
 * — late cancellation, the lesson reminders as input chips, the homework deadline reminder and how far ahead
 * series are booked. Every field saves on change: a select at once, a number on leaving it or Enter.
 */
@Component({
  selector: 'tb-lesson-settings',
  imports: [
    Card,
    FormsModule,
    ReactiveFormsModule,
    InputNumber,
    Menu,
    Select,
    AssistChip,
    InputChip,
    LoadStateView,
    DefaultPriceCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-stack' },
  template: `
    <p-card [header]="t.timeAndPrice" styleClass="tb-section-card tb-section-card--flow">
      <tb-load-state
        [state]="state"
        [what]="t.lessonSettingsWhat"
        [compact]="true"
        (retry)="load()"
      >
        <div class="tb-field" id="time-zone">
          <label for="time-zone-input">{{ t.timeZoneLabel }}</label>
          <p-select
            inputId="time-zone-input"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
            [filter]="true"
            filterBy="label"
            [options]="zones()"
            [ngModel]="zone()"
            (onChange)="changeZone($event.value)"
          />
          <small class="tb-hint">{{ t.timeZoneHint }}</small>
        </div>
        <div class="tb-field" id="currency">
          <label for="currency-input">{{ t.currencyLabel }}</label>
          <p-select
            inputId="currency-input"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
            [filter]="true"
            filterBy="label"
            [options]="currencies()"
            [ngModel]="currency()?.currency"
            [disabled]="currency()?.locked ?? false"
            (onChange)="changeCurrency($event.value)"
          />
          @if (currency()?.locked) {
            <small class="tb-hint tb-lesson-settings__locked"
              ><i class="tb-i tb-i-lock" aria-hidden="true"></i>{{ t.currencyLocked }}</small
            >
          } @else {
            <small class="tb-hint">{{ t.currencyHint }}</small>
          }
        </div>
        <div class="tb-lesson-settings__two">
          <form class="tb-form" [formGroup]="form" (ngSubmit)="saveRules()">
            <div class="tb-field">
              <label for="duration-input">{{ t.durationLabel }}</label>
              <p-inputnumber
                inputId="duration-input"
                formControlName="duration"
                [suffix]="t.durationSuffix"
                [min]="15"
                [max]="480"
                [fluid]="true"
                (onBlur)="saveRules()"
              />
            </div>
          </form>
          <tb-default-price-card [short]="true" />
        </div>
        <small class="tb-hint tb-lesson-settings__shared-hint">{{ t.newLessonsHint }}</small>
      </tb-load-state>
    </p-card>

    <p-card [header]="t.rules" styleClass="tb-section-card tb-section-card--flow">
      <tb-load-state
        [state]="state"
        [what]="t.lessonSettingsWhat"
        [compact]="true"
        (retry)="load()"
      >
        <form id="lesson-rules" class="tb-form" [formGroup]="form" (keydown.enter)="saveAll()">
          <div class="tb-field">
            <label for="late-input">{{ t.lateLabel }}</label>
            <p-inputnumber
              inputId="late-input"
              formControlName="late"
              [suffix]="t.hoursSuffix"
              [min]="0"
              [max]="168"
              [maxFractionDigits]="2"
              [fluid]="true"
              (onBlur)="saveRules()"
            />
            <small class="tb-hint">{{ t.lateHint }}</small>
          </div>
          <div class="tb-lesson-settings__reminders" role="group" aria-labelledby="reminders-label">
            <span id="reminders-label" class="tb-lesson-settings__label">{{
              t.remindersLabel
            }}</span>
            <div class="tb-lesson-settings__chips">
              @for (minutes of reminders(); track minutes) {
                <tb-input-chip
                  [label]="reminderLabel(minutes)"
                  [removeLabel]="t.removeReminder(reminderLabel(minutes))"
                  (removed)="removeReminder(minutes)"
                />
              }
              @if (reminders().length < maxReminders) {
                <tb-assist-chip
                  icon="add"
                  [dashed]="true"
                  aria-haspopup="menu"
                  (click)="addMenu.toggle($event)"
                  >{{ t.addReminder }}</tb-assist-chip
                >
              }
            </div>
            <small class="tb-hint">{{
              reminders().length === 0 ? t.noReminders : t.remindersHint
            }}</small>
          </div>
          <div class="tb-field">
            <label for="due-soon-input">{{ t.dueSoonLabel }}</label>
            <p-inputnumber
              inputId="due-soon-input"
              formControlName="dueSoon"
              [suffix]="t.hoursSuffix"
              [min]="1"
              [max]="72"
              [maxFractionDigits]="2"
              [fluid]="true"
              (onBlur)="saveDueSoon()"
            />
          </div>
          <div class="tb-field">
            <label for="horizon-input">{{ t.horizonLabel }}</label>
            <p-inputnumber
              inputId="horizon-input"
              formControlName="horizon"
              [suffix]="t.weeksSuffix"
              [min]="4"
              [max]="26"
              [fluid]="true"
              (onBlur)="saveRules()"
            />
            <small class="tb-hint">{{ t.horizonHint }}</small>
          </div>
        </form>
      </tb-load-state>
    </p-card>
    <p-menu
      #addMenu
      [model]="reminderChoices()"
      [popup]="true"
      appendTo="body"
      [ariaLabel]="t.addReminderMenu"
    />
  `,
  styles: `
    /* length and price side by side (sketch Lessons), stacked below 20 rem */
    .tb-lesson-settings__two {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
      gap: var(--tb-space-4);
      align-items: start;
    }

    .tb-lesson-settings__shared-hint {
      margin-block-start: calc(-1 * var(--tb-space-2));
    }

    .tb-lesson-settings__locked {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);

      .tb-i {
        font-size: 1rem;
      }
    }

    .tb-lesson-settings__reminders {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
    }

    .tb-lesson-settings__label {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }

    .tb-lesson-settings__chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }
  `,
})
export class LessonSettings implements OnInit {
  protected readonly t = T.page;
  protected readonly maxReminders = MAX_REMINDERS;
  private readonly device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  private readonly settingsApi = inject(SettingsApi);
  private readonly scheduleApi = inject(ScheduleApi);
  private readonly billingApi = inject(BillingApi);
  private readonly homeworkApi = inject(HomeworkApi);
  private readonly snackbar = inject(Snackbar);
  private readonly price = viewChild(DefaultPriceCard);

  protected readonly state = new LoadState();
  protected readonly zone = signal('');
  protected readonly currency = signal<CurrencySetting | null>(null);
  /** The rules as last saved; a field that fails to save goes back to them. */
  private readonly rules = signal<LessonRules | null>(null);
  private readonly dueSoon = signal(0);
  protected readonly zones = computed<Option[]>(() =>
    this.zone() === '' ? [] : zoneOptions(this.zone(), this.device),
  );
  protected readonly currencies = computed<Option[]>(() => {
    const current = this.currency();
    return current === null ? [] : currencyOptions(current.currency);
  });
  /** The reminders as chosen (saved or on their way). */
  private readonly chosen = signal<readonly number[]>([]);
  /** Longest first, as the sketch lists them: «За 24 ч», «За 1 ч». */
  protected readonly reminders = computed(() => [...this.chosen()].sort((a, b) => b - a));
  protected readonly reminderChoices = computed<MenuItem[]>(() =>
    REMINDER_CHOICES.filter((minutes) => !this.reminders().includes(minutes)).map((minutes) => ({
      label: this.reminderLabel(minutes),
      command: () => {
        this.addReminder(minutes);
      },
    })),
  );

  readonly form = new FormGroup({
    duration: new FormControl<number | null>(null),
    late: new FormControl<number | null>(null),
    dueSoon: new FormControl<number | null>(null),
    horizon: new FormControl<number | null>(null),
  });

  private pending = false;
  /** A change came while the rules were being saved: save once more after. */
  private again = false;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    forkJoin({
      schedule: this.scheduleApi.settings(),
      rules: this.scheduleApi.lessonRules(),
      currency: this.billingApi.currency(),
      homework: this.homeworkApi.settings(),
    })
      .pipe(this.state.track())
      .subscribe(({ schedule, rules, currency, homework }) => {
        this.zone.set(schedule.timeZone);
        this.currency.set(currency);
        this.showRules(rules);
        this.showDueSoon(homework.dueSoonMinutes);
      });
  }

  protected reminderLabel(minutes: number): string {
    return this.t.before(spanLabel(minutes));
  }

  protected changeZone(zone: string): void {
    const previous = this.zone();
    this.zone.set(zone);
    this.settingsApi.changeTimeZone(zone).subscribe({
      next: (saved) => {
        this.zone.set(saved.timeZone);
        this.snackbar.success(this.t.timeZoneSaved);
      },
      error: () => {
        this.zone.set(previous);
      },
    });
  }

  protected changeCurrency(code: string): void {
    const previous = this.currency();
    if (previous === null || previous.currency === code) {
      return;
    }
    this.currency.set({ ...previous, currency: code });
    this.billingApi.changeCurrency(code).subscribe({
      next: (saved) => {
        this.currency.set(saved);
        this.price()?.load();
        this.snackbar.success(this.t.currencySaved);
      },
      error: () => {
        // a refused change (locked meanwhile) reads the setting again
        this.billingApi.currency().subscribe((current) => {
          this.currency.set(current);
        });
      },
    });
  }

  /** Enter in «Правила» saves the field it was pressed in, as leaving it does. */
  protected saveAll(): void {
    this.saveRules();
    this.saveDueSoon();
  }

  /**
   * Saves the rules as the fields and chips show them, if they differ from the saved ones; a change made
   * while one is on its way follows it. An emptied field gets its saved value back.
   */
  protected saveRules(): void {
    const saved = this.rules();
    if (saved === null) {
      return;
    }
    if (this.pending) {
      this.again = true;
      return;
    }
    const wanted = this.wantedRules(saved);
    if (sameRules(wanted, saved)) {
      return;
    }
    this.pending = true;
    this.scheduleApi.changeLessonRules(wanted).subscribe({
      next: (changed) => {
        this.pending = false;
        this.rules.set(changed);
        if (this.again) {
          this.again = false;
          this.saveRules();
        } else {
          this.chosen.set(changed.reminderMinutes);
        }
        this.snackbar.success(this.t.rulesSaved);
      },
      error: () => {
        this.pending = false;
        this.again = false;
        this.showRules(this.rules() ?? saved);
      },
    });
  }

  protected addReminder(minutes: number): void {
    if (this.chosen().length < MAX_REMINDERS && !this.chosen().includes(minutes)) {
      this.chosen.update((chosen) => [...chosen, minutes]);
      this.saveRules();
    }
  }

  protected removeReminder(minutes: number): void {
    this.chosen.update((chosen) => chosen.filter((reminder) => reminder !== minutes));
    this.saveRules();
  }

  protected saveDueSoon(): void {
    const value = this.form.controls.dueSoon.value;
    if (value === null) {
      this.showDueSoon(this.dueSoon());
      return;
    }
    const minutes = Math.round(value * HOUR);
    if (minutes === this.dueSoon()) {
      return;
    }
    this.homeworkApi.changeSettings({ dueSoonMinutes: minutes }).subscribe({
      next: (saved) => {
        this.dueSoon.set(saved.dueSoonMinutes);
        this.snackbar.success(this.t.dueSoonSaved);
      },
      error: () => {
        this.showDueSoon(this.dueSoon());
      },
    });
  }

  /** The rules the fields and chips show; an emptied field shows its saved value again. */
  private wantedRules(saved: LessonRules): LessonRules {
    const { duration, late, horizon } = this.form.controls;
    if (duration.value === null) {
      duration.setValue(saved.defaultDurationMinutes);
    }
    if (late.value === null) {
      late.setValue(saved.lateCancellationMinutes / HOUR);
    }
    if (horizon.value === null) {
      horizon.setValue(saved.horizonWeeks);
    }
    return {
      defaultDurationMinutes: duration.value ?? saved.defaultDurationMinutes,
      lateCancellationMinutes: Math.round((late.value ?? 0) * HOUR),
      reminderMinutes: this.chosen(),
      horizonWeeks: horizon.value ?? saved.horizonWeeks,
    };
  }

  private showRules(rules: LessonRules): void {
    this.rules.set(rules);
    this.chosen.set(rules.reminderMinutes);
    this.form.patchValue({
      duration: rules.defaultDurationMinutes,
      late: rules.lateCancellationMinutes / HOUR,
      horizon: rules.horizonWeeks,
    });
  }

  private showDueSoon(minutes: number): void {
    this.dueSoon.set(minutes);
    this.form.patchValue({ dueSoon: minutes / HOUR });
  }
}

function sameRules(a: LessonRules, b: LessonRules): boolean {
  return (
    a.defaultDurationMinutes === b.defaultDurationMinutes &&
    a.lateCancellationMinutes === b.lateCancellationMinutes &&
    a.horizonWeeks === b.horizonWeeks &&
    a.reminderMinutes.length === b.reminderMinutes.length &&
    a.reminderMinutes.every((minutes) => b.reminderMinutes.includes(minutes))
  );
}
