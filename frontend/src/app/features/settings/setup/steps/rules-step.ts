import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import {
  DueSoonField,
  HorizonField,
  LateCancellationField,
} from '@features/settings/fields/lesson-rule-fields';
import { RemindersField } from '@features/settings/fields/reminders-field';
import { T } from '@features/settings/i18n/texts';
import { HOUR } from '@features/settings/lesson-rules';
import { dueSoonExample, horizonExample, lateExample, remindersExample } from '../setup-examples';
import { Saved } from './setup-state';

/** The fields of «Правила»: hours, hours and weeks. */
export type RulesForm = FormGroup<{
  late: FormControl<number | null>;
  dueSoon: FormControl<number | null>;
  horizon: FormControl<number | null>;
}>;

const t = T.setup;

/** «Правила»: late cancellations, reminders, the homework deadline and how far lessons repeat. */
@Component({
  selector: 'tb-setup-rules-step',
  imports: [
    ReactiveFormsModule,
    Card,
    DueSoonField,
    HorizonField,
    LateCancellationField,
    RemindersField,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <form id="setup-rules" class="tb-stack" [formGroup]="form()" (ngSubmit)="submitted.emit()">
      <button type="submit" class="tb-sr-only" tabindex="-1" aria-hidden="true"></button>
      <p-card [header]="t.cancelCard" styleClass="tb-section-card tb-section-card--flow">
        <tb-late-cancellation-field inputId="setup-late" [control]="form().controls.late" />
        <tb-reminders-field labelId="setup-reminders" [(reminders)]="reminders" />
      </p-card>
      <p-card [header]="t.homeworkCard" styleClass="tb-section-card tb-section-card--flow">
        <div class="tb-stack">
          <tb-due-soon-field inputId="setup-due-soon" [control]="form().controls.dueSoon" />
          <tb-horizon-field inputId="setup-horizon" [control]="form().controls.horizon" />
        </div>
      </p-card>
    </form>
  `,
})
export class SetupRulesStep {
  protected readonly t = t;
  readonly form = input.required<RulesForm>();
  /** Minutes before a lesson. */
  readonly reminders = model.required<readonly number[]>();
  /** «Далее» by Enter in a field. */
  readonly submitted = output();
}

/** How the rules work, each on an example with the values as they are typed. */
@Component({
  selector: 'tb-setup-rules-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @for (example of examples(); track example.icon) {
      <p class="tb-setup__example">
        <i class="tb-i" [class]="example.icon" aria-hidden="true"></i>
        <span
          ><b>{{ example.title }}</b
          >{{ example.text }}</span
        >
      </p>
    }
  `,
  styles: `
    .tb-setup__example {
      display: flex;
      gap: var(--tb-space-3);
      align-items: flex-start;
      margin: 0;
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg-increased, 1.25rem);
      font: var(--tb-type-body-m);
      background: var(--p-md-surface-container);

      .tb-i {
        color: var(--p-md-primary);
      }

      b {
        display: block;
        margin-block-end: var(--tb-space-1);
        font: var(--tb-type-title-s);
      }
    }
  `,
})
export class SetupRulesPreview {
  /** The fields of «Правила» as they are typed. */
  readonly values =
    input.required<
      Partial<{ late: number | null; dueSoon: number | null; horizon: number | null }>
    >();
  readonly reminders = input.required<readonly number[]>();
  readonly saved = input.required<Saved | null>();

  protected readonly examples = computed(() => {
    const values = this.values();
    const saved = this.saved();
    const late = values.late ?? (saved?.rules.lateCancellationMinutes ?? 0) / HOUR;
    const dueSoon = values.dueSoon ?? (saved?.dueSoon ?? 0) / HOUR;
    const horizon = values.horizon ?? saved?.rules.horizonWeeks ?? 0;
    return [
      { icon: 'tb-i-event_busy', title: t.lateTitle, text: lateExample(late * HOUR) },
      {
        icon: 'tb-i-notifications',
        title: t.remindersTitle,
        text: remindersExample(this.reminders()),
      },
      {
        icon: 'tb-i-assignment_late',
        title: t.dueSoonTitle,
        text: dueSoonExample(dueSoon * HOUR),
      },
      { icon: 'tb-i-event_repeat', title: t.horizonTitle, text: horizonExample(horizon) },
    ];
  });
}
