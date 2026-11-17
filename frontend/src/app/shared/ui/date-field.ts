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
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Overlay } from 'primeng/overlay';
import { Tooltip } from 'primeng/tooltip';
import { locale } from '@core/i18n/language';
import { injectWindowSize } from '@core/layout/mobile';
import { toIsoDate } from '@shared/dates/iso-date';
import { formatDate, formatMonth, fullDate, parseDate, parseMonth } from '@shared/dates/typed-date';
import { SHARED_T } from '@shared/i18n/texts';
import { TbDialog } from './dialog/dialog';

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
 * icon button that opens the picker — docked under the field from medium, a full-screen dialog on
 * compact. The day grid is PrimeNG's inline `p-datepicker` with its header hidden; the M3 header,
 * the month and year lists and the year keys are ours. `month` — a month field (the first day of
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
    Overlay,
    Tooltip,
    TbDialog,
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
      class="tb-date-field__open"
      aria-haspopup="dialog"
      [attr.aria-label]="month() ? t.openMonth : t.open"
      [attr.aria-expanded]="docked() || dialogOpen()"
      [disabled]="disabled()"
      (click)="toggle()"
    >
      <i class="tb-i tb-i-calendar_month" aria-hidden="true"></i>
    </button>

    <ng-template #picker>
      <div class="tb-date-picker" [id]="pickerId">
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

    @if (compact()) {
      <tb-dialog
        kind="form"
        [visible]="dialogOpen()"
        (visibleChange)="dialogOpen.set($event)"
        [headline]="label()"
        [confirmLabel]="c.save"
        (confirm)="save()"
        (closed)="closed()"
      >
        @if (dialogOpen()) {
          <div class="tb-date-field__sheet">
            <p class="tb-date-field__support">{{ month() ? t.pickMonth : t.pick }}</p>
            <p class="tb-date-field__chosen">{{ chosen() }}</p>
          </div>
          <ng-container *ngTemplateOutlet="picker" />
        }
      </tb-dialog>
    } @else {
      <p-overlay
        [visible]="docked()"
        (visibleChange)="docked.set($event)"
        target="@prev"
        appendTo="body"
        (onEnter)="entered($event.element)"
      >
        @if (docked()) {
          <ng-container *ngTemplateOutlet="picker" />
        }
      </p-overlay>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      min-width: 0;
    }

    /* the text never runs under the icon button */
    input {
      width: 100%;
      padding-inline-end: 3.5rem;
    }

    /* M3 trailing icon: 24 dp in a 40 dp round button, like «Показать пароль» */
    .tb-date-field__open {
      position: absolute;
      top: 50%;
      inset-inline-end: var(--tb-space-2);
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      padding: 0;
      border: 0;
      border-radius: var(--tb-shape-full);
      background: none;
      color: var(--p-md-on-surface-variant);
      cursor: pointer;
      transform: translateY(-50%);

      &:hover:not(:disabled) {
        background: color-mix(in srgb, var(--p-md-on-surface) var(--tb-state-hover), transparent);
      }

      &:focus-visible {
        outline: 3px solid var(--p-md-secondary);
        outline-offset: 2px;
      }

      &:disabled {
        color: color-mix(in srgb, var(--p-md-on-surface) 38%, transparent);
        cursor: default;
      }
    }

    /* the modal picker on compact: «Выберите дату» and the chosen date above the picker */
    .tb-date-field__sheet {
      margin-bottom: var(--tb-space-3);
      border-bottom: 1px solid var(--p-md-outline-variant);
    }

    .tb-date-field__support {
      margin: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);
    }

    .tb-date-field__chosen {
      min-height: 2.5rem;
      margin: var(--tb-space-4) 0 var(--tb-space-3);
      color: var(--p-md-on-surface);
      font: var(--tb-type-headline-l);
    }

    /* M3 docked date picker; ours: 360 dp, 12 dp padding, the dropdown's corners and shadow */
    .tb-date-picker {
      box-sizing: border-box;
      width: 22.5rem;
      max-width: 100%;
      padding: var(--tb-space-3);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-high);
      box-shadow: var(--tb-elevation-2);
      color: var(--p-md-on-surface);
    }

    /* on compact the body of the full-screen dialog, centred and not scaled (M3) */
    .tb-date-field__sheet + .tb-date-picker {
      margin-inline: auto;
      padding: 0;
      background: none;
      box-shadow: none;
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
        font: var(--tb-type-body-l);
      }

      :is(.p-datepicker-weekday-cell, .p-datepicker-day-cell) {
        width: 3rem;
        height: 3rem;
        padding: 0;
      }
    }
  `,
})
export class DateField implements ControlValueAccessor, Validator {
  protected readonly t = SHARED_T.date;
  protected readonly c = SHARED_T.common;
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly opener = viewChild.required<ElementRef<HTMLButtonElement>>('opener');
  protected readonly compact = computed(() => this.windowSize() === 'compact');
  private readonly windowSize = injectWindowSize();
  protected readonly pickerId = `tb-date-picker-${String(nextId++)}`;

  /** The `id` of the input, for the `<label for>` of the field. */
  readonly inputId = input.required<string>();
  /** The name of the field: the headline of the picker on compact. */
  readonly label = input.required<string>();
  readonly minDate = input<Date | null>(null);
  readonly maxDate = input<Date | null>(null);
  /** A month field: the value is the first day of the month. */
  readonly month = input(false);

  protected readonly text = signal('');
  protected readonly disabled = signal(false);
  private readonly value = signal<Date | null>(null);
  /** The typed text is not a date. */
  private wrong = false;

  protected readonly docked = signal(false);
  protected readonly dialogOpen = signal(false);
  protected readonly view = signal<View>('days');
  /** The month the header shows (its first day); the grid's paging comes back here. */
  protected readonly shown = signal(new Date());
  /** The month the grid is told to show: changed by the header only (`defaultDate`). */
  protected readonly target = signal(new Date());
  /** The date picked in the open picker, saved on compact by «Сохранить». */
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

  private onChange: (value: Date | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  constructor() {
    // the picker's keys come first: Shift+Page Up/Down would page a month in PrimeNG's grid
    const keys = (event: KeyboardEvent): void => {
      this.onKey(event);
    };
    this.document.addEventListener('keydown', keys, true);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('keydown', keys, true);
    });
  }

  writeValue(value: unknown): void {
    const date = value instanceof Date ? value : null;
    this.value.set(date);
    this.text.set(date === null ? '' : this.format(date));
    this.wrong = false;
  }

  registerOnChange(fn: (value: Date | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  validate(): ValidationErrors | null {
    if (this.wrong) {
      return { date: this.t.wrong(this.month() ? this.t.monthFormat : this.t.format) };
    }
    const value = this.value();
    const min = this.minDate();
    const max = this.maxDate();
    if (value !== null && min !== null && toIsoDate(value) < toIsoDate(min)) {
      return { date: this.t.min(formatDate(min)) };
    }
    if (value !== null && max !== null && toIsoDate(value) > toIsoDate(max)) {
      return { date: this.t.max(formatDate(max)) };
    }
    return null;
  }

  /** Enter or leaving the field: the typed text becomes the value; text that is no date stays. */
  protected readText(): void {
    const text = this.text().trim();
    const date = this.month() ? parseMonth(text) : parseDate(text);
    const wrong = text !== '' && date === null;
    if (!wrong) {
      this.text.set(date === null ? '' : this.format(date));
    }
    if (wrong !== this.wrong) {
      this.wrong = wrong;
      this.onValidatorChange();
    }
    this.commit(date);
  }

  protected toggle(): void {
    if (this.docked()) {
      this.docked.set(false);
      return;
    }
    const value = this.value();
    const start = value ?? new Date();
    this.draft.set(value);
    this.show(firstOf(start.getFullYear(), start.getMonth()));
    this.view.set(this.month() ? 'months' : 'days');
    if (this.compact()) {
      this.dialogOpen.set(true);
    } else {
      this.docked.set(true);
    }
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

  /** «Сохранить» of the picker on compact. */
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

  /** The docked picker grows out of its icon button (and goes back into it), then takes the focus. */
  protected entered(surface: Element): void {
    const icon = this.opener().nativeElement.getBoundingClientRect();
    const box = surface.getBoundingClientRect();
    const inset = [
      icon.top - box.top,
      box.right - icon.right,
      box.bottom - icon.bottom,
      icon.left - box.left,
    ].map((side) => `${String(Math.round(side))}px`);
    if (surface instanceof HTMLElement) {
      surface.style.setProperty('--tb-motion-clip', `inset(${inset.join(' ')} round 50%)`);
    }
    this.focusChoice();
  }

  /** The docked picker opens on the chosen day (or today) or the chosen month. */
  private focusChoice(): void {
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
    if (!this.compact()) {
      this.choose(date);
      this.closeDocked();
    }
  }

  private closeDocked(): void {
    this.docked.set(false);
    this.closed();
  }

  private choose(date: Date): void {
    this.text.set(this.format(date));
    if (this.wrong) {
      this.wrong = false;
      this.onValidatorChange();
    }
    this.commit(date);
  }

  private commit(date: Date | null): void {
    if (date?.getTime() !== this.value()?.getTime()) {
      this.value.set(date);
      this.onChange(date);
    }
  }

  private show(month: Date): void {
    this.shown.set(month);
    this.target.set(month);
  }

  private format(date: Date): string {
    return this.month() ? formatMonth(date) : formatDate(date);
  }

  private panel(): HTMLElement | null {
    return this.document.getElementById(this.pickerId);
  }

  private afterRender(run: () => void): void {
    afterNextRender(run, { injector: this.injector });
  }

  /** Shift+Page Up/Down, Shift+M / Shift+Y in the picker; Esc closes the docked one. */
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
    } else if (event.key === 'Escape' && this.docked()) {
      this.stop(event);
      this.closeDocked();
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
