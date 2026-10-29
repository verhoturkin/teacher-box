import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  model,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { FilterChip, FilterChips } from '@shared/ui/filter-chips';
import { T } from '../i18n/texts';

export type Due = 'lesson' | 'week' | 'none' | 'date';

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** «К следующему занятию» stays only while the chosen students have a lesson ahead. */
export function effectiveDue(choice: Due, lesson: Date | null): Due {
  return choice === 'lesson' && lesson === null ? 'none' : choice;
}

/** The due date a choice stands for. */
export function dueAtOf(choice: Due, lesson: Date | null, picked: Date | null): Date | null {
  switch (effectiveDue(choice, lesson)) {
    case 'lesson':
      return lesson;
    case 'week':
      return new Date(Date.now() + WEEK);
    case 'date':
      return picked;
    case 'none':
      return null;
  }
}

/** «Срок»: the next lesson, in a week, none, or a date — chips and, for a date, the picker. */
@Component({
  selector: 'tb-due-chips',
  imports: [FormsModule, DatePicker, FilterChips],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-filter-chips
      [label]="t.due"
      [chips]="chips()"
      [value]="shown()"
      (valueChange)="choice.set($event)"
    />
    @if (shown() === 'date') {
      <p-datepicker
        [ngModel]="date()"
        (ngModelChange)="pick($event)"
        [ariaLabel]="t.dueAt"
        [showTime]="true"
        hourFormat="24"
        dateFormat="dd.mm.yy"
        [showIcon]="true"
        appendTo="body"
        [fluid]="true"
      />
    }
  `,
})
export class DueChips {
  protected readonly t = T.create;
  private readonly dates = new DatePipe(inject(LOCALE_ID));

  /** The next lesson of the chosen students; none — the chip is hidden. */
  readonly lesson = input<Date | null>(null);
  readonly choice = model<Due>('lesson');
  readonly date = model<Date | null>(null);

  protected readonly shown = computed(() => effectiveDue(this.choice(), this.lesson()));
  protected readonly chips = computed<FilterChip<Due>[]>(() => {
    const lesson = this.lesson();
    return [
      ...(lesson === null
        ? []
        : [
            {
              value: 'lesson' as const,
              label: T.create.nextLesson(this.dates.transform(lesson, 'EEE dd.MM, HH:mm') ?? ''),
            },
          ]),
      { value: 'week', label: T.create.inWeek },
      { value: 'none', label: T.create.noDue },
      { value: 'date', label: T.create.pickDate },
    ];
  });

  protected pick(value: unknown): void {
    this.date.set(value instanceof Date ? value : null);
  }
}
