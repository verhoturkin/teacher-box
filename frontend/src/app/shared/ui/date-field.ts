import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors } from '@angular/forms';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import { locale } from '@core/i18n/language';
import { toIsoDate } from '@shared/dates/iso-date';
import { formatDate, formatMonth, fullDate, parseDate, parseMonth } from '@shared/dates/typed-date';
import { SHARED_T } from '@shared/i18n/texts';
import { DialogFooter, TbDialog } from './dialog/dialog';
import { TypedField } from './typed-field';

/** A day of PrimeNG's grid (`#date` template): the month counts from 0. */
interface GridDay {
  day: number;
  month: number;
  year: number;
}

type View = 'days' | 'months' | 'years';

let nextId = 0;

/**
 * The M3 date field (ADR-0067, design-system §9 «Date»): a filled field that takes a typed date
 * (`shared/dates/typed-date`, parsed on Enter or leaving the field) and a trailing «Выбрать дату»
 * icon button that opens the M3 modal date picker — a dialog over the scrim on every window size,
 * like the time picker (430.1): «Выберите дату», the chosen date, the picker, «Отмена» / «ОК». The
 * day grid is PrimeNG's inline `p-datepicker` with its header hidden; the M3 header, the month and
 * year lists and the year keys are ours. `month` — a month field (the first day of
 * the month): no grid, the year header and the month list. Value — a `Date` at midnight or `null`.
 *
 * ```html
 * <div class="tb-field">
 *   <label for="payment-date">{{ t.date }}</label>
 *   <tb-date-field inputId="payment-date" [label]="t.date" formControlName="paidOn" />
 * </div>
 * ```
 */
@Component({
  selector: 'tb-date-field',
  imports: [
    FormsModule,
    NgTemplateOutlet,
    Button,
    DatePicker,
    InputText,
    Tooltip,
    TbDialog,
    DialogFooter,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateField), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DateField), multi: true },
  ],
  template: `
    <input
      #field
      pInputText
      [id]="inputId()"
      [value]="text()"
      [placeholder]="month() ? t.monthFormat : t.format"
      [disabled]="disabled()"
      [class.p-filled]="text() !== ''"
      autocomplete="off"
      (input)="text.set(field.value)"
      (keydown.enter)="readText()"
      (blur)="readText(); onTouched()"
    />
    <button
      #opener
      type="button"
      class="tb-typed-field__open"
      aria-haspopup="dialog"
      [attr.aria-label]="month() ? t.openMonth : t.open"
      [attr.aria-expanded]="dialogOpen()"
      [disabled]="disabled()"
      (click)="toggle()"
    >
      <i class="tb-i tb-i-calendar_month" aria-hidden="true"></i>
    </button>

    <ng-template #picker>
      <div class="tb-date-picker" role="group" [id]="pickerId" [attr.aria-label]="label()">
        <div class="tb-date-picker__head" [class.tb-date-picker__head--open]="view() !== 'days'">
          @if (!month()) {
            <p-button
              icon="tb-i tb-i-chevron_left"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [ariaLabel]="t.previousMonth"
              [pTooltip]="t.previousMonth"
              (onClick)="go(-1)"
            />
            <button
              type="button"
              class="tb-date-picker__menu"
              [class.tb-date-picker__menu--open]="view() === 'months'"
              [attr.aria-label]="t.month(monthName(shown().getMonth()))"
              [attr.aria-expanded]="view() === 'months'"
              (click)="toggleView('months')"
            >
              {{ shortMonth() }}
              <i class="tb-i tb-i-arrow_drop_down" aria-hidden="true"></i>
            </button>
            <p-button
              icon="tb-i tb-i-chevron_right"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [ariaLabel]="t.nextMonth"
              [pTooltip]="t.nextMonth"
              (onClick)="go(1)"
            />
          }
          <p-button
            icon="tb-i tb-i-chevron_left"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [ariaLabel]="t.previousYear"
            [pTooltip]="t.previousYear"
            (onClick)="go(-12)"
          />
          <button
            type="button"
            class="tb-date-picker__menu"
            [class.tb-date-picker__menu--open]="view() === 'years'"
            [attr.aria-label]="t.year(shown().getFullYear())"
            [attr.aria-expanded]="view() === 'years'"
            (click)="toggleView('years')"
          >
            {{ shown().getFullYear() }}
            <i class="tb-i tb-i-arrow_drop_down" aria-hidden="true"></i>
          </button>
          <p-button
            icon="tb-i tb-i-chevron_right"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [ariaLabel]="t.nextYear"
            [pTooltip]="t.nextYear"
            (onClick)="go(12)"
          />
        </div>
        @switch (view()) {
          @case ('months') {
            <div class="tb-date-picker__list">
              @for (name of monthNames; track $index) {
                <button
                  type="button"
                  class="tb-date-picker__item"
                  [attr.aria-current]="$index === listedMonth() ? 'true' : null"
                  (click)="pickMonth($index)"
                >
                  {{ name }}
                </button>
              }
            </div>
          }
          @case ('years') {
            <div class="tb-date-picker__list">
              @for (year of years(); track year) {
                <button
                  type="button"
                  class="tb-date-picker__item"
                  [attr.aria-current]="year === shown().getFullYear() ? 'true' : null"
                  (click)="pickYear(year)"
                >
                  {{ year }}
                </button>
              }
            </div>
          }
          @default {
            <p-datepicker
              [inline]="true"
              [ngModel]="draft()"
              [defaultDate]="target()"
              [minDate]="minDate() ?? undefined"
              [maxDate]="maxDate() ?? undefined"
              (onSelect)="pickDay($event)"
              (onMonthChange)="paged($event)"
              (onYearChange)="paged($event)"
            >
              <ng-template #date let-day>
                <span class="tb-sr-only">{{ dayName(day) }}</span>
                <span aria-hidden="true">{{ day.day }}</span>
              </ng-template>
            </p-datepicker>
          }
        }
      </div>
    </ng-template>

    <tb-dialog
      kind="alert"
      [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)"
      [headline]="month() ? t.pickMonth : t.pick"
      (shown)="focusChoice()"
      (closed)="closed()"
      (gone)="mounted.set(false)"
    >
      @if (mounted()) {
        <p class="tb-date-field__chosen">{{ chosen() }}</p>
        <ng-container *ngTemplateOutlet="picker" />
      }
      <ng-template tbDialogFooter>
        <p-button [label]="c.cancel" [text]="true" (onClick)="dialogOpen.set(false)" />
        <p-button [label]="ok" [text]="true" (onClick)="save()" />
      </ng-template>
    </tb-dialog>
  `,
  styles: `
    /* M3 modal date picker: the chosen date (the headline of M3) over a divider; type ours */
    .tb-date-field__chosen {
      min-height: 2.5rem;
      margin: 0 0 var(--tb-space-3);
      padding: 0 var(--tb-space-3) var(--tb-space-3);
      border-bottom: 1px solid var(--p-md-outline-variant);
      color: var(--p-md-on-surface);
      font: var(--tb-type-headline-l);
      letter-spacing: var(--tb-tracking-headline-l);
    }

    /* the body: 7 days of 48 dp (M3: not scaled with the window); the dialog gives the container */
    .tb-date-picker {
      box-sizing: border-box;
      width: 21rem;
      max-width: 100%;
      margin-inline: auto;
      color: var(--p-md-on-surface);
    }

    /* the header ‹ month ▾ › ‹ year ▾ ›, 48 dp: icon buttons 40 dp, the menu buttons share the rest */
    .tb-date-picker__head {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
      min-height: 3rem;
    }

    .tb-date-picker__head--open {
      padding-bottom: var(--tb-space-1);
      border-bottom: 1px solid var(--p-md-outline-variant);
    }

    .tb-date-picker__menu {
      display: inline-flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      min-width: 0;
      height: 2.5rem;
      padding: 0 var(--tb-space-1) 0 var(--tb-space-2);
      border: 0;
      border-radius: var(--tb-shape-full);
      background: none;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);
      letter-spacing: var(--tb-tracking-label-l);
      cursor: pointer;
      transition:
        background-color var(--tb-spring-fast-effects),
        color var(--tb-spring-fast-effects);

      &:hover {
        background: color-mix(in srgb, var(--p-md-on-surface) var(--tb-state-hover), transparent);
      }

      &:focus-visible {
        outline: 3px solid var(--p-md-secondary);
        outline-offset: 2px;
      }

      i {
        transition: transform var(--tb-spring-standard-fast-spatial);
      }
    }

    /* the open menu: primary (user choice, 424.2), the arrow turns without a bounce */
    .tb-date-picker__menu--open {
      &,
      &:hover {
        background: var(--p-md-primary);
        color: var(--p-md-on-primary);
      }

      i {
        transform: rotate(180deg);
      }
    }

    /* the month and year lists replace the grid: 48 dp items, the selected one primary */
    .tb-date-picker__list {
      display: flex;
      flex-direction: column;
      height: 18rem;
      padding-top: var(--tb-space-1);
      overflow-y: auto;
      animation: tb-motion-fade-in var(--tb-spring-fast-effects);
    }

    .tb-date-picker__item {
      flex: none;
      height: 3rem;
      padding: 0 var(--tb-space-4);
      border: 0;
      border-radius: var(--tb-shape-full);
      background: none;
      color: var(--p-md-on-surface);
      font: var(--tb-type-label-l);
      letter-spacing: var(--tb-tracking-label-l);
      text-align: start;
      cursor: pointer;

      &:hover {
        background: color-mix(in srgb, var(--p-md-on-surface) var(--tb-state-hover), transparent);
      }

      &:focus-visible {
        outline: 3px solid var(--p-md-secondary);
        outline-offset: -3px;
      }

      &[aria-current='true'] {
        background: var(--p-md-primary);
        color: var(--p-md-on-primary);
      }
    }

    /* PrimeNG's grid: no header of its own, no panel of its own, 48 dp cells, Body Large */
    .tb-date-picker ::ng-deep {
      .p-datepicker-panel {
        padding: 0;
        border: 0;
        background: none;
        animation: tb-motion-fade-in var(--tb-spring-fast-effects);
      }

      .p-datepicker-header {
        display: none;
      }

      .p-datepicker-day-view {
        width: 100%;
        margin: 0;
        /* equal columns: 48 dp, a little less when a phone is narrower than the 360 dp picker */
        table-layout: fixed;
        font: var(--tb-type-body-l);
        letter-spacing: var(--tb-tracking-body-l);
      }

      :is(.p-datepicker-weekday-cell, .p-datepicker-day-cell) {
        height: 3rem;
        padding: 0;
      }
    }
  `,
})
export class DateField extends TypedField<Date> {
  protected readonly t = SHARED_T.date;
  protected readonly c = SHARED_T.common;
  protected readonly ok = SHARED_T.time.ok;
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly opener = viewChild.required<ElementRef<HTMLButtonElement>>('opener');
  protected readonly pickerId = `tb-date-picker-${String(nextId++)}`;

  /** The `id` of the input, for the `<label for>` of the field. */
  readonly inputId = input.required<string>();
  /** The name of the field: screen readers hear it on the picker's body. */
  readonly label = input.required<string>();
  readonly minDate = input<Date | null>(null);
  readonly maxDate = input<Date | null>(null);
  /** A month field: the value is the first day of the month. */
  readonly month = input(false);

  protected readonly dialogOpen = signal(false);
  /** The content stays until the leave animation ends: without it the dialog shrinks first. */
  protected readonly mounted = signal(false);
  protected readonly view = signal<View>('days');
  /** The month the header shows (its first day); the grid's paging comes back here. */
  protected readonly shown = signal(new Date());
  /** The month the grid is told to show: changed by the header only (`defaultDate`). */
  protected readonly target = signal(new Date());
  /** The date picked in the open picker, kept by «ОК». */
  protected readonly draft = signal<Date | null>(null);

  protected readonly monthNames = Array.from({ length: 12 }, (_, month) => {
    const name = this.monthName(month);
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
  protected readonly shortMonth = computed(() =>
    this.shown().toLocaleDateString(locale(), { month: 'short' }),
  );
  /** The month marked in the list: the picked one in a month field, else the shown one. */
  protected readonly listedMonth = computed(() => {
    const draft = this.draft();
    if (!this.month()) {
      return this.shown().getMonth();
    }
    return draft?.getFullYear() === this.shown().getFullYear() ? draft.getMonth() : -1;
  });
  protected readonly years = computed(() => {
    const now = new Date().getFullYear();
    const from = this.minDate()?.getFullYear() ?? now - 10;
    const to = this.maxDate()?.getFullYear() ?? now + 10;
    return Array.from({ length: to - from + 1 }, (_, index) => from + index);
  });
  protected readonly chosen = computed(() => {
    const draft = this.draft();
    if (draft === null) {
      return '';
    }
    return this.month()
      ? draft.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })
      : draft.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
  });

  constructor() {
    super();
    // the picker's keys come first: Shift+Page Up/Down would page a month in PrimeNG's grid
    const keys = (event: KeyboardEvent): void => {
      this.onKey(event);
    };
    this.document.addEventListener('keydown', keys, true);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('keydown', keys, true);
    });
  }

  protected override read(value: unknown): Date | null {
    return value instanceof Date ? value : null;
  }

  protected override parse(text: string): Date | null {
    return this.month() ? parseMonth(text) : parseDate(text);
  }

  protected override format(date: Date): string {
    return this.month() ? formatMonth(date) : formatDate(date);
  }

  protected override wrongError(): ValidationErrors {
    return { date: this.t.wrong(this.month() ? this.t.monthFormat : this.t.format) };
  }

  protected override check(value: Date): ValidationErrors | null {
    const min = this.minDate();
    const max = this.maxDate();
    if (min !== null && toIsoDate(value) < toIsoDate(min)) {
      return { date: this.t.min(formatDate(min)) };
    }
    if (max !== null && toIsoDate(value) > toIsoDate(max)) {
      return { date: this.t.max(formatDate(max)) };
    }
    return null;
  }

  protected override same(a: Date | null, b: Date | null): boolean {
    return a?.getTime() === b?.getTime();
  }

  protected toggle(): void {
    const value = this.value();
    const start = value ?? new Date();
    this.draft.set(value);
    this.show(firstOf(start.getFullYear(), start.getMonth()));
    this.view.set(this.month() ? 'months' : 'days');
    this.mounted.set(true);
    this.dialogOpen.set(true);
  }

  /** Pages the header and the grid by months (12 — a year). */
  protected go(months: number): void {
    const shown = this.shown();
    this.show(firstOf(shown.getFullYear(), shown.getMonth() + months));
  }

  protected toggleView(view: View): void {
    this.view.set(this.view() === view ? (this.month() ? 'months' : 'days') : view);
    this.afterRender(() => {
      this.panel()?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({
        block: 'center',
      });
    });
  }

  protected pickMonth(month: number): void {
    const date = firstOf(this.shown().getFullYear(), month);
    if (this.month()) {
      this.pick(date);
      return;
    }
    this.show(date);
    this.view.set('days');
  }

  protected pickYear(year: number): void {
    this.show(firstOf(year, this.shown().getMonth()));
    this.view.set(this.month() ? 'months' : 'days');
  }

  protected pickDay(date: Date): void {
    this.pick(firstOf(date.getFullYear(), date.getMonth(), date.getDate()));
  }

  /** «ОК»: the picked date becomes the value. */
  protected save(): void {
    const draft = this.draft();
    if (draft !== null) {
      this.choose(draft);
    }
    this.dialogOpen.set(false);
  }

  /** The picker went away: the focus goes back to its button. */
  protected closed(): void {
    this.opener().nativeElement.focus();
  }

  /** The picker opens on the chosen day (or today) or the chosen month (M3). */
  protected focusChoice(): void {
    const panel = this.panel();
    const day =
      panel?.querySelector<HTMLElement>('.p-datepicker-day-selected') ??
      panel?.querySelector<HTMLElement>('.p-datepicker-today > .p-datepicker-day') ??
      panel?.querySelector<HTMLElement>('.p-datepicker-day:not(.p-disabled)') ??
      panel?.querySelector<HTMLElement>('.tb-date-picker__item[aria-current="true"]') ??
      panel?.querySelector<HTMLElement>('.tb-date-picker__item');
    if (day !== null && day !== undefined) {
      focusDay(day);
    }
  }

  protected monthName(month: number): string {
    return new Date(2000, month, 1).toLocaleDateString(locale(), { month: 'long' });
  }

  protected dayName(day: GridDay): string {
    return fullDate(new Date(day.year, day.month, day.day));
  }

  /** The grid paged by its keys: the header follows (PrimeNG counts these months from 1). */
  protected paged(event: { month?: number; year?: number }): void {
    if (event.month !== undefined && event.year !== undefined) {
      this.shown.set(firstOf(event.year, event.month - 1));
    }
  }

  private pick(date: Date): void {
    this.draft.set(date);
  }

  private show(month: Date): void {
    this.shown.set(month);
    this.target.set(month);
  }

  private panel(): HTMLElement | null {
    return this.document.getElementById(this.pickerId);
  }

  private afterRender(run: () => void): void {
    afterNextRender(run, { injector: this.injector });
  }

  /** Shift+Page Up/Down, Shift+M / Shift+Y in the picker (Esc is the dialog's). */
  private onKey(event: KeyboardEvent): void {
    const panel = this.panel();
    if (panel === null || !(event.target instanceof HTMLElement) || !panel.contains(event.target)) {
      return;
    }
    const year = event.key === 'PageUp' ? -1 : event.key === 'PageDown' ? 1 : 0;
    if (event.shiftKey && year !== 0 && this.view() === 'days') {
      this.stop(event);
      this.pageYear(event.target, year);
    } else if (event.shiftKey && event.code === 'KeyM' && !this.month()) {
      this.stop(event);
      this.toggleView('months');
    } else if (event.shiftKey && event.code === 'KeyY') {
      this.stop(event);
      this.toggleView('years');
    }
  }

  /** The same day a year before or after (the last day of a shorter February), focused. */
  private pageYear(cell: HTMLElement, years: number): void {
    const key = cell.dataset['date'];
    if (key === undefined) {
      this.go(12 * years);
      return;
    }
    const [year = 0, month = 0, day = 1] = key.split('-').map(Number);
    const next = firstOf(year + years, month, Math.min(day, daysIn(year + years, month)));
    this.show(firstOf(next.getFullYear(), month));
    this.afterRender(() => {
      const date = `${String(next.getFullYear())}-${String(month)}-${String(next.getDate())}`;
      const cell = this.panel()?.querySelector<HTMLElement>(`[data-date="${date}"]`);
      if (cell !== null && cell !== undefined) {
        focusDay(cell);
      }
    });
  }

  private stop(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }
}

function firstOf(year: number, month: number, day = 1): Date {
  return new Date(year, month, day);
}

/** Focuses a day (or a list item) as PrimeNG's grid does: the one tab stop of the grid moves to it. */
function focusDay(element: HTMLElement): void {
  if (element.classList.contains('p-datepicker-day')) {
    element
      .closest('table')
      ?.querySelectorAll<HTMLElement>('.p-datepicker-day[tabindex="0"]')
      .forEach((day) => {
        day.tabIndex = -1;
      });
    element.tabIndex = 0;
  }
  element.focus();
}

function daysIn(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
