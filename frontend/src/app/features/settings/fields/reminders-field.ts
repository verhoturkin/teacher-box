import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { AssistChip } from '@shared/ui/assist-chip';
import { InputChip } from '@shared/ui/input-chip';
import { T } from '../i18n/texts';
import { REMINDER_CHOICES, spanLabel } from '../lesson-options';

/** At most this many lesson reminders (the server takes three). */
export const MAX_REMINDERS = 3;

/** «За 24 ч»: a reminder as a chip shows it. */
export function reminderLabel(minutes: number): string {
  return T.page.before(spanLabel(minutes));
}

/**
 * The lesson reminders as input chips with «+ Добавить» (sketch Lessons, OnbRules): minutes before the
 * lesson, longest first. `reminders` changes on every add and remove, then `committed` tells the host.
 */
@Component({
  selector: 'tb-reminders-field',
  imports: [Menu, AssistChip, InputChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-reminders" role="group" [attr.aria-labelledby]="labelId()">
      <span [id]="labelId()" class="tb-reminders__label">{{ t.remindersLabel }}</span>
      <div class="tb-reminders__chips">
        @for (minutes of sorted(); track minutes) {
          <tb-input-chip
            [label]="label(minutes)"
            [removeLabel]="t.removeReminder(label(minutes))"
            (removed)="remove(minutes)"
          />
        }
        @if (sorted().length < max) {
          <tb-assist-chip
            icon="add"
            [dashed]="true"
            aria-haspopup="menu"
            (click)="addMenu.toggle($event)"
            >{{ t.addReminder }}</tb-assist-chip
          >
        }
      </div>
      <small class="tb-hint">{{ sorted().length === 0 ? t.noReminders : t.remindersHint }}</small>
    </div>
    <p-menu
      #addMenu
      [model]="choices()"
      [popup]="true"
      appendTo="body"
      [ariaLabel]="t.addReminderMenu"
    />
  `,
  styles: `
    .tb-reminders {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
    }

    .tb-reminders__label {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }

    .tb-reminders__chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }
  `,
})
export class RemindersField {
  /** Minutes before the lesson, in any order. */
  readonly reminders = model.required<readonly number[]>();
  readonly labelId = input('reminders-label');
  readonly committed = output();

  protected readonly t = T.page;
  protected readonly max = MAX_REMINDERS;
  protected readonly label = reminderLabel;
  /** Longest first, as the sketch lists them: «За 24 ч», «За 1 ч». */
  protected readonly sorted = computed(() => [...this.reminders()].sort((a, b) => b - a));
  protected readonly choices = computed<MenuItem[]>(() =>
    REMINDER_CHOICES.filter((minutes) => !this.reminders().includes(minutes)).map((minutes) => ({
      label: reminderLabel(minutes),
      command: () => {
        this.add(minutes);
      },
    })),
  );

  add(minutes: number): void {
    if (this.reminders().length < MAX_REMINDERS && !this.reminders().includes(minutes)) {
      this.reminders.update((chosen) => [...chosen, minutes]);
      this.committed.emit();
    }
  }

  remove(minutes: number): void {
    this.reminders.update((chosen) => chosen.filter((reminder) => reminder !== minutes));
    this.committed.emit();
  }
}
