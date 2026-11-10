import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Card } from 'primeng/card';
import { Snackbar } from '@core/snackbar/snackbar';
import { BillingApi, DefaultPriceCard } from '@features/billing/parts';
import { HomeworkApi } from '@features/homework/parts';
import { LessonRules, ScheduleApi } from '@features/schedule/parts';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { SettingsApi } from './data-access/settings-api';
import { CurrencyField } from './fields/currency-field';
import {
  DueSoonField,
  DurationField,
  HorizonField,
  LateCancellationField,
} from './fields/lesson-rule-fields';
import { RemindersField } from './fields/reminders-field';
import { TimeZoneField } from './fields/time-zone-field';
import { HOUR, sameRules } from './lesson-rules';
import { T } from './i18n/texts';

/**
 * The first column of the settings category «Занятия» (sketch Lessons): «Время и цена» — the time zone, the
 * currency (locked once a lesson or payment is recorded), the default lesson length and price — and «Правила»
 * — late cancellation, the lesson reminders as input chips, the homework deadline reminder and how far ahead
 * series are booked. Every field saves on change: a select at once, a number on leaving it or Enter. The
 * fields are the ones the first setup asks (one component per setting).
 */
@Component({
  selector: 'tb-lesson-settings',
  imports: [
    Card,
    ReactiveFormsModule,
    LoadStateView,
    DefaultPriceCard,
    CurrencyField,
    DueSoonField,
    DurationField,
    HorizonField,
    LateCancellationField,
    RemindersField,
    TimeZoneField,
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
        <tb-time-zone-field
          id="time-zone"
          [control]="form.controls.zone"
          (committed)="changeZone($event)"
        />
        <tb-currency-field
          id="currency"
          [control]="form.controls.currency"
          [locked]="locked()"
          (committed)="changeCurrency($event)"
        />
        <div class="tb-lesson-settings__two">
          <tb-duration-field [control]="form.controls.duration" (committed)="saveRules()" />
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
        <div id="lesson-rules" class="tb-form">
          <tb-late-cancellation-field [control]="form.controls.late" (committed)="saveRules()" />
          <tb-reminders-field [(reminders)]="chosen" (committed)="saveRules()" />
          <tb-due-soon-field [control]="form.controls.dueSoon" (committed)="saveDueSoon()" />
          <tb-horizon-field [control]="form.controls.horizon" (committed)="saveRules()" />
        </div>
      </tb-load-state>
    </p-card>
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
  `,
})
export class LessonSettings implements OnInit {
  protected readonly t = T.page;
  private readonly settingsApi = inject(SettingsApi);
  private readonly scheduleApi = inject(ScheduleApi);
  private readonly billingApi = inject(BillingApi);
  private readonly homeworkApi = inject(HomeworkApi);
  private readonly snackbar = inject(Snackbar);
  private readonly price = viewChild(DefaultPriceCard);

  protected readonly state = new LoadState();
  protected readonly locked = signal(false);
  /** The values as last saved; a field that fails to save goes back to them. */
  private zone = '';
  private currency = '';
  private readonly rules = signal<LessonRules | null>(null);
  private dueSoon = 0;
  /** The reminders as chosen (saved or on their way). */
  protected readonly chosen = signal<readonly number[]>([]);

  readonly form = new FormGroup({
    zone: new FormControl('', { nonNullable: true }),
    currency: new FormControl('', { nonNullable: true }),
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
        this.showZone(schedule.timeZone);
        this.showCurrency(currency.currency, currency.locked);
        this.showRules(rules);
        this.showDueSoon(homework.dueSoonMinutes);
      });
  }

  protected changeZone(zone: string): void {
    if (zone === this.zone) {
      return;
    }
    this.settingsApi.changeTimeZone(zone).subscribe({
      next: (saved) => {
        this.showZone(saved.timeZone);
        this.snackbar.success(this.t.timeZoneSaved);
      },
      error: () => {
        this.showZone(this.zone);
      },
    });
  }

  protected changeCurrency(code: string): void {
    if (code === this.currency) {
      return;
    }
    this.billingApi.changeCurrency(code).subscribe({
      next: (saved) => {
        this.showCurrency(saved.currency, saved.locked);
        this.price()?.load();
        this.snackbar.success(this.t.currencySaved);
      },
      error: () => {
        // a refused change (locked meanwhile) reads the setting again
        this.billingApi.currency().subscribe((current) => {
          this.showCurrency(current.currency, current.locked);
        });
      },
    });
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

  protected saveDueSoon(): void {
    const value = this.form.controls.dueSoon.value;
    if (value === null) {
      this.showDueSoon(this.dueSoon);
      return;
    }
    const minutes = Math.round(value * HOUR);
    if (minutes === this.dueSoon) {
      return;
    }
    this.homeworkApi.changeSettings({ dueSoonMinutes: minutes }).subscribe({
      next: (saved) => {
        this.showDueSoon(saved.dueSoonMinutes);
        this.snackbar.success(this.t.dueSoonSaved);
      },
      error: () => {
        this.showDueSoon(this.dueSoon);
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

  private showZone(zone: string): void {
    this.zone = zone;
    this.form.controls.zone.setValue(zone);
  }

  private showCurrency(code: string, locked: boolean): void {
    this.currency = code;
    this.locked.set(locked);
    const control = this.form.controls.currency;
    control.setValue(code);
    if (locked) {
      control.disable();
    } else {
      control.enable();
    }
  }

  private showRules(rules: LessonRules): void {
    this.rules.set(rules);
    // a new array: the chips may show a change refused before they were drawn again
    this.chosen.set([...rules.reminderMinutes]);
    this.form.patchValue({
      duration: rules.defaultDurationMinutes,
      late: rules.lateCancellationMinutes / HOUR,
      horizon: rules.horizonWeeks,
    });
  }

  private showDueSoon(minutes: number): void {
    this.dueSoon = minutes;
    this.form.patchValue({ dueSoon: minutes / HOUR });
  }
}
