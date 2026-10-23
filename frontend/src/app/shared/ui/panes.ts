import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  DestroyRef,
  TemplateRef,
  ViewContainerRef,
  Signal,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { WindowSize, injectWindowSize } from '@core/layout/mobile';

/**
 * The kind of a pane (M3 panes, redesign spec §3.3): `fixed` keeps the M3 default width of its
 * breakpoint (360 dp on expanded, 412 dp from large), `flexible` takes the rest of the width, `sheet` is
 * the standard side sheet of the third pane (at most 400 dp, `surface container low`).
 */
export type PaneKind = 'fixed' | 'flexible' | 'sheet';

/**
 * The panes of medium: `one` — one at a time (M3 default), `two` — two panes of 50 % each (redesign spec §3.1:
 * Settings only).
 */
export type MediumPanes = 'one' | 'two';

/**
 * Whether a breakpoint shows one pane at a time (M3: compact and medium); the panes follow one another
 * there.
 */
function isSingle(size: WindowSize, medium: MediumPanes): boolean {
  return size === 'compact' || (size === 'medium' && medium === 'one');
}

/** M3 default width of a fixed pane: 360 dp on expanded, 412 dp on large and extra-large. */
const FIXED_WIDTH: Partial<Record<WindowSize, string>> = {
  expanded: '22.5rem',
  large: '25.75rem',
  'extra-large': '25.75rem',
};

/** M3 default maximum width of a side sheet: 400 dp. */
const SHEET_WIDTH = '25rem';

/**
 * Panes of a page (M3 canonical layouts, ADR-0048): sheets with 28 dp corners on the `surface container`
 * of the window, 24 dp margins at the trailing edge and the bottom (16 dp at the sides on compact) and the
 * 24 dp spacer between them. From expanded they stand side by side and each scrolls on its own; on
 * compact and medium they follow one another and the window scrolls (`medium="two"`: two panes of 50 % on
 * medium as from expanded). The order of the panes in the
 * template is their visual order and the focus order: nothing reorders them.
 *
 * ```html
 * <tb-panes>
 *   <tb-pane kind="fixed" label="Ученики">…</tb-pane>
 *   <tb-pane>…</tb-pane>
 * </tb-panes>
 * ```
 */
@Component({
  selector: 'tb-panes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tb-panes',
    '[class.tb-panes--single]': 'single()',
  },
  template: `<ng-content />`,
  styles: `
    :host {
      --tb-panes-margin: var(--tb-space-6);
      --tb-panes-spacer: var(--tb-space-6);

      display: flex;
      gap: var(--tb-panes-spacer);
      box-sizing: border-box;
      /* the margins at the trailing edge and the bottom (M3); the rail and the top bar take the others */
      padding: 0 var(--tb-panes-margin) var(--tb-panes-margin) 0;
      block-size: calc(100dvh - var(--tb-header-height));
      /* a pane that slides in (24 dp) never widens the window */
      overflow-x: clip;
    }

    :host(.tb-panes--single) {
      flex-direction: column;
      block-size: auto;
      padding-inline-start: var(--tb-panes-margin);
    }

    /* a phone: the page lies on the window and the pane's own 16 px are the only room at the sides (the margin
       of the panes would double it to 32 px) */
    @media (width < 37.5em) {
      :host,
      :host(.tb-panes--single) {
        --tb-panes-margin: var(--tb-space-4);
        padding: 0;
      }
    }
  `,
})
export class Panes {
  /** The breakpoint of the window. */
  readonly size = injectWindowSize();
  /** The panes of medium: one at a time or two of 50 %. */
  readonly medium = input<MediumPanes>('one');
  /** One pane at a time (compact, medium with `one`): the panes follow one another. */
  readonly single = computed(() => isSingle(this.size(), this.medium()));
  /** After the first render panes that appear enter with motion; the panes of a new page don't. */
  readonly settled = signal(false);

  constructor() {
    afterNextRender(() => {
      this.settled.set(true);
    });
  }
}

/**
 * One pane of {@link Panes}: a `surface` sheet (a side sheet — `surface container low`) that scrolls on
 * its own from expanded. With `label` it is a landmark region of that name. A pane that appears later
 * enters on `--tb-spring-default-spatial` and leaves on it beside other panes (no stagger).
 */
@Component({
  selector: 'tb-pane',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tb-pane',
    '[class.tb-pane--sheet]': "kind() === 'sheet'",
    '[style.flex-grow]': 'grow()',
    '[style.flex-basis]': 'basis()',
    '[style.max-width]': 'maxWidth()',
    '[attr.role]': 'label() ? "region" : null',
    '[attr.aria-label]': 'label() || null',
    '[animate.enter]': 'enter()',
    '[animate.leave]': 'leave()',
  },
  template: `
    <div class="tb-pane__header">
      <ng-content select="[tbPaneHeader]" />
      @for (heading of headings(); track heading) {
        <ng-container [ngTemplateOutlet]="heading" />
      }
    </div>
    <div class="tb-pane__scroll"><ng-content /></div>
  `,
  styles: `
    /*
     * The pane clips to its rounded corners and the scrolling area lies inside it, so the scrollbar never sticks
     * out past the corners: its track is inset by the corner radius (ours, \`tb-scrollbar\` in styles.scss)
     */
    :host {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      min-width: 0;
      box-sizing: border-box;
      overflow: clip;
      border-radius: var(--tb-shape-xl);
      background: var(--p-md-surface);
      --tb-field-surface: var(--p-md-surface);
      /* a list lies right on the pane's surface: its group keeps the M3 list container corner, large (16 px) —
         the first and the last rows round their outer corners by it, the rows between by 4 px */
      --tb-list-outer: var(--tb-shape-lg);
    }

    /* Optional persistent heading/actions; geometry is a portal decision using the pane padding. */
    .tb-pane__header:not(:empty) {
      flex: none;
      padding: var(--tb-space-6) var(--tb-space-6) var(--tb-space-4);
    }

    :host:has(.tb-pane__header:not(:empty)) .tb-pane__scroll {
      padding-top: 0;
    }

    .tb-pane__scroll {
      flex: 1;
      min-height: 0;
      box-sizing: border-box;
      padding: var(--tb-space-6);
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    :host(.tb-pane--sheet) {
      background: var(--p-md-surface-container-low);
      --tb-field-surface: var(--p-md-surface-container-low);
    }

    :host-context(.tb-panes--single) .tb-pane__scroll {
      overflow-y: visible;
    }

    @media (width < 37.5em) {
      .tb-pane__header:not(:empty) {
        padding: var(--tb-space-4);
      }

      .tb-pane__scroll {
        padding: var(--tb-space-4);
      }

      /* the sketches: on a phone the page lies right on the window (no big card on the background): the pane has
         neither its own surface nor corners; the window takes the surface tone (styles.scss) */
      :host,
      :host(.tb-pane--sheet) {
        border-radius: 0;
        background: transparent;
        --tb-field-surface: var(--p-md-surface);
      }
    }

    :host(.tb-pane--enter) {
      --tb-motion-x: var(--tb-space-6);
      animation:
        tb-motion-slide-in var(--tb-spring-default-spatial),
        tb-motion-fade-in var(--tb-spring-default-effects);
    }

    :host(.tb-pane--leave) {
      --tb-motion-x: var(--tb-space-6);
      animation:
        tb-motion-slide-out var(--tb-spring-default-spatial) forwards,
        tb-motion-fade-out var(--tb-spring-default-effects) forwards;
    }
  `,
})
export class Pane {
  readonly headings = signal<readonly TemplateRef<unknown>[]>([]);
  registerHeading(heading: TemplateRef<unknown>): () => void {
    this.headings.update((items) => [...items, heading]);
    return () => {
      this.headings.update((items) => items.filter((item) => item !== heading));
    };
  }

  private readonly panes = inject(Panes);

  readonly kind = input<PaneKind>('flexible');
  /** The name of the pane for assistive technology (a landmark region); none — a plain block. */
  readonly label = input<string>();

  /** The width of the pane on this breakpoint (`flex-basis`); `null` — the width of the column. */
  protected readonly basis = computed(() => {
    if (this.panes.single()) {
      return null;
    }
    if (this.panes.size() === 'medium') {
      return '0%';
    }
    switch (this.kind()) {
      case 'fixed':
        return FIXED_WIDTH[this.panes.size()] ?? null;
      case 'sheet':
        return SHEET_WIDTH;
      case 'flexible':
        return '0%';
    }
  });
  /** The flexible pane takes the rest; on medium with two panes each takes half. */
  protected readonly grow = computed(() =>
    !this.panes.single() && (this.kind() === 'flexible' || this.panes.size() === 'medium')
      ? '1'
      : null,
  );
  protected readonly maxWidth = computed(() =>
    !this.panes.single() && this.kind() === 'sheet' ? SHEET_WIDTH : null,
  );
  protected readonly enter = computed(() => (this.panes.settled() ? 'tb-pane--enter' : ''));
  /** Beside other panes only: one pane on compact gives its place at once (the route changes it). */
  protected readonly leave = computed(() => (this.panes.single() ? '' : 'tb-pane--leave'));
}

/** Which panes of a list-detail layout are shown (redesign spec §3.3). */
export interface ListDetail {
  /** One pane at a time (compact, medium with `one`). */
  readonly single: Signal<boolean>;
  /** The list is shown: always beside the detail, on one pane while no detail is open. */
  readonly list: Signal<boolean>;
  /** The detail is shown: always beside the list, on one pane when it is open. */
  readonly detail: Signal<boolean>;
}

/**
 * The list-detail layout (M3 canonical layout): from expanded the list and the detail side by side, on
 * compact and medium only one of them, chosen by the route — `open` says whether the route has a detail
 * (`/teacher/students/:id`). «Back» of the detail on one pane leads to the list's route. `medium` must be
 * the same as the `medium` of the page's `tb-panes`. Call in an injection context.
 */
export function injectListDetail(open: () => boolean, medium: MediumPanes = 'one'): ListDetail {
  const size = injectWindowSize();
  const single = computed(() => isSingle(size(), medium));
  return {
    single,
    list: computed(() => !single() || !open()),
    detail: computed(() => !single() || open()),
  };
}

/** A heading declared by an embedded detail component, rendered in its enclosing pane's header. */
@Directive({ selector: 'ng-template[tbPaneHeader]' })
export class PaneHeader {
  constructor() {
    const pane = inject(Pane, { optional: true });
    const template = inject<TemplateRef<unknown>>(TemplateRef);
    if (pane) {
      inject(DestroyRef).onDestroy(pane.registerHeading(template));
    } else {
      inject(ViewContainerRef).createEmbeddedView(template);
    }
  }
}
