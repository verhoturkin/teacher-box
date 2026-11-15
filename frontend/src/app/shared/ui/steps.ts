import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChild,
  input,
  output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

/** A step of {@link Steps}: its id, its name and, for selectable steps, whether it can be opened yet. */
export interface Step<T extends string | number = string> {
  readonly id: T;
  readonly title: string;
  readonly disabled?: boolean;
}

/**
 * The step indicator of a wizard (ours: M3 publishes no stepper) — rows as the items of a navigation
 * rail: a number in a circle, a check once the step is behind, the current row in secondary container
 * (`aria-current="step"`). `selectable` turns the rows into buttons that emit `selected`; an
 * `ng-template` inside is the body of the current step, under its row.
 *
 * ```html
 * <tb-steps [steps]="steps" [current]="step()" [label]="t.steps" [selectable]="true" (selected)="go($event)">
 *   <ng-template>…</ng-template>
 * </tb-steps>
 * ```
 */
@Component({
  selector: 'tb-steps',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="tb-steps" [attr.aria-label]="label()">
      @for (step of steps(); track step.id; let index = $index) {
        <li
          class="tb-steps__step"
          [class.tb-steps__step--current]="index === currentIndex()"
          [class.tb-steps__step--done]="index < currentIndex()"
          [attr.aria-current]="index === currentIndex() ? 'step' : null"
        >
          <ng-template #row>
            <span class="tb-steps__number" aria-hidden="true">
              @if (index < currentIndex()) {
                <i class="tb-i tb-i-check"></i>
              } @else {
                {{ index + 1 }}
              }
            </span>
            {{ step.title }}
          </ng-template>
          @if (selectable()) {
            <button
              type="button"
              class="tb-steps__row"
              [disabled]="step.disabled ?? false"
              (click)="selected.emit(step.id)"
            >
              <ng-container [ngTemplateOutlet]="row" />
            </button>
          } @else {
            <span class="tb-steps__row"><ng-container [ngTemplateOutlet]="row" /></span>
          }
          @if (index === currentIndex() && body(); as body) {
            <div class="tb-steps__body">
              <ng-container [ngTemplateOutlet]="body" />
            </div>
          }
        </li>
      }
    </ol>
  `,
  styles: `
    .tb-steps {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-steps__row {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      box-sizing: border-box;
      inline-size: 100%;
      min-block-size: 3.5rem;
      padding: 0 var(--tb-space-4);
      border: 0;
      border-radius: var(--tb-shape-full);
      background: transparent;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);
      text-align: start;
    }

    button.tb-steps__row {
      cursor: pointer;

      &:hover {
        background: color-mix(in srgb, var(--p-md-on-surface) var(--tb-state-hover), transparent);
      }

      &:focus-visible {
        outline: 2px solid var(--p-md-secondary);
        outline-offset: 2px;
      }

      &:disabled {
        cursor: default;
        background: transparent;
        color: color-mix(
          in srgb,
          var(--p-md-on-surface) var(--tb-state-disabled-content),
          transparent
        );
      }
    }

    .tb-steps__step--current .tb-steps__row,
    .tb-steps__step--current .tb-steps__row:hover {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    .tb-steps__number {
      display: inline-flex;
      flex: 0 0 1.75rem;
      align-items: center;
      justify-content: center;
      block-size: 1.75rem;
      border: 1px solid currentColor;
      border-radius: var(--tb-shape-full);
      font: var(--tb-type-label-m);

      .tb-i {
        font-size: 1.125rem;
      }
    }

    .tb-steps__step--current .tb-steps__number {
      border-color: var(--p-md-on-secondary-container);
      background: var(--p-md-on-secondary-container);
      color: var(--p-md-secondary-container);
    }

    .tb-steps__step--done .tb-steps__number {
      border-color: var(--p-md-primary);
      background: var(--p-md-primary);
      color: var(--p-md-on-primary);
    }

    /* the body of the current step: under its row, behind a rule from the number (our decision) */
    .tb-steps__body {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      margin: var(--tb-space-2) 0 var(--tb-space-3) calc(var(--tb-space-4) + 0.875rem);
      padding-inline-start: var(--tb-space-6);
      border-inline-start: 1px solid var(--p-md-outline-variant);
    }
  `,
})
export class Steps<T extends string | number = string> {
  readonly steps = input.required<readonly Step<T>[]>();
  /** The id of the current step: the steps before it are done. */
  readonly current = input.required<T>();
  readonly label = input.required<string>();
  /** Rows are buttons that emit {@link selected}. */
  readonly selectable = input(false);
  readonly selected = output<T>();
  protected readonly body = contentChild(TemplateRef);
  protected readonly currentIndex = computed(() =>
    this.steps().findIndex((step) => step.id === this.current()),
  );
}
