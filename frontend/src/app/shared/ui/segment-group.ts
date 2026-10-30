import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** One button of {@link SegmentGroup}: its value, its label and the number it stands for. */
export interface Segment<T extends string> {
  readonly value: T;
  readonly label: string;
  /** How many items the segment holds («На проверку 3»); none — no number. */
  readonly count?: number;
  /** A `tb-i tb-i-…` icon before the label. */
  readonly icon?: string;
}

/**
 * A single-select M3 Expressive connected button group (ADR-0022) over a list: the buttons 2 px apart,
 * the inner corners 8 px and the outer ones round, the chosen button `primary` and fully round, the others
 * tonal (`secondary container`); pressed, a button squares to 8 px and its inner corners narrow to 4 px.
 * *Our decision:* every button carries its count after the label and the group takes the whole width, the
 * buttons share it by their content.
 *
 * ```html
 * <tb-segment-group [label]="t.filters" [segments]="segments()" [(value)]="filter" />
 * ```
 */
@Component({
  selector: 'tb-segment-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tb-segment-group',
    '[class.tb-segment-group--outlined]': 'outlined()',
    role: 'group',
    '[attr.aria-label]': 'label()',
  },
  template: `
    @for (segment of segments(); track segment.value) {
      <button
        type="button"
        class="tb-segment"
        [attr.aria-pressed]="segment.value === value()"
        (click)="value.set(segment.value)"
      >
        @if (outlined() && checkmark() && segment.value === value()) {
          <i class="tb-i tb-i-check" aria-hidden="true"></i>
        } @else if (segment.icon) {
          <i [class]="segment.icon" aria-hidden="true"></i>
        }
        <span class="tb-segment__label">{{ segment.label }}</span>
        @if (segment.count !== undefined) {
          <span class="tb-segment__count">{{ segment.count }}</span>
        }
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      gap: 2px;
    }

    .tb-segment {
      display: inline-flex;
      flex: 1 1 auto;
      align-items: center;
      justify-content: center;
      gap: var(--tb-space-2);
      min-width: 0;
      block-size: 2.5rem;
      box-sizing: border-box;
      padding: 0 var(--tb-space-2);
      border: 0;
      border-radius: var(--tb-shape-sm);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
      font: var(--tb-type-label-l);
      white-space: nowrap;
      cursor: pointer;
      transition:
        background var(--tb-spring-fast-effects),
        color var(--tb-spring-fast-effects),
        border-radius var(--tb-spring-fast-spatial);

      &:first-child {
        border-start-start-radius: var(--tb-shape-button);
        border-end-start-radius: var(--tb-shape-button);
      }

      &:last-child {
        border-start-end-radius: var(--tb-shape-button);
        border-end-end-radius: var(--tb-shape-button);
      }

      &:hover {
        background: color-mix(
          in srgb,
          var(--p-md-on-secondary-container) var(--tb-state-hover),
          var(--p-md-secondary-container)
        );
      }

      &:focus-visible {
        outline: 3px solid var(--p-md-secondary);
        outline-offset: 2px;
      }

      /* pressed, the outer corners square to 8 px as any button, the inner ones narrow to 4 px (M3E) */
      &:active {
        border-radius: var(--tb-shape-sm);
      }

      &:not(:last-child):active {
        border-start-end-radius: var(--tb-shape-xs);
        border-end-end-radius: var(--tb-shape-xs);
      }

      &:not(:first-child):active {
        border-start-start-radius: var(--tb-shape-xs);
        border-end-start-radius: var(--tb-shape-xs);
      }

      &[aria-pressed='true'] {
        border-radius: var(--tb-shape-button);
        background: var(--p-md-primary);
        color: var(--p-md-on-primary);

        &:hover {
          background: color-mix(
            in srgb,
            var(--p-md-on-primary) var(--tb-state-hover),
            var(--p-md-primary)
          );
        }
      }
    }

    /*
     * outlined variant (M3 segmented buttons): one 1 dp outline around the group and between the buttons,
     * a full pill, the chosen button secondary container with a leading check, the others transparent
     */
    :host(.tb-segment-group--outlined) {
      gap: 0;
      box-sizing: border-box;
      block-size: 2.5rem;
      overflow: hidden;
      border: 1px solid var(--p-md-outline);
      border-radius: var(--tb-shape-full);

      .tb-segment {
        block-size: auto;
        border-radius: 0;
        background: transparent;
        color: var(--p-md-on-surface);

        &:hover {
          background: color-mix(in srgb, var(--p-md-on-surface) var(--tb-state-hover), transparent);
        }

        &:focus-visible {
          outline-offset: -3px;
        }

        & + .tb-segment {
          border-inline-start: 1px solid var(--p-md-outline);
        }

        &[aria-pressed='true'] {
          background: var(--p-md-secondary-container);
          color: var(--p-md-on-secondary-container);

          &:hover {
            background: color-mix(
              in srgb,
              var(--p-md-on-secondary-container) var(--tb-state-hover),
              var(--p-md-secondary-container)
            );
          }
        }

        > .tb-i {
          font-size: 1.125rem;
        }
      }
    }

    .tb-segment__label {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tb-segment__count {
      font: var(--tb-type-label-l-emphasized);
    }
  `,
})
export class SegmentGroup<T extends string> {
  /** The name of the group for assistive technology («Что показать»). */
  readonly label = input.required<string>();
  readonly segments = input.required<readonly Segment<T>[]>();
  /** The chosen segment. */
  readonly value = model.required<T>();
  /** The outlined variant (M3 segmented buttons): one outline round the group and between the buttons. */
  readonly outlined = input(false);
  /** The outlined variant marks the chosen button with a check; `false` — the colour alone says it. */
  readonly checkmark = input(true);
}
