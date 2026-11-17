import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewEncapsulation,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { SHARED_T } from '@shared/i18n/texts';

/** The narrowest fixed pane: one column (ADR-0021), the M3 fixed width of expanded. */
const MIN_WIDTH = 360;
/** M3 fixed width from large: a snap width. */
const LARGE_WIDTH = 412;
/** A drop this close to a snap width lands on it (ours). */
const SNAP_RANGE = 24;
/** One arrow key press (ours). */
const KEY_STEP = 16;

/** The room the handle may move in, measured once (drag start, a key, focus). */
interface Limits {
  readonly width: number;
  readonly min: number;
  readonly max: number;
  /** 1 — the handle is right of the pane (a wider pane moves it right), -1 — left of it (RTL, trailing pane). */
  readonly sign: number;
  /** M3 snap widths: 360 dp, 412 dp and the split with the spacer in the middle of the window. */
  readonly snaps: readonly number[];
}

/**
 * The M3 drag handle of a fixed pane (`tb-pane resizeKey`): it sits in the spacer on the flexible side and
 * resizes the pane. The width lives in the pane's `--tb-pane-width` (px) and on this device per user under
 * `tb.pane-width.<userId>.<resizeKey>`; a drag writes it once a frame, outside change detection.
 */
@Component({
  selector: 'tb-pane-handle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // the side of the handle depends on the panes around its pane (`:has`), out of reach of emulated styles
  encapsulation: ViewEncapsulation.None,
  host: { class: 'tb-pane-handle' },
  template: `
    <div
      #zone
      class="tb-pane-handle__zone"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      [attr.aria-label]="label"
      [attr.aria-controls]="controls()"
      [attr.aria-valuenow]="now()"
      [attr.aria-valuemin]="min()"
      [attr.aria-valuemax]="max()"
      (pointerdown)="start($event)"
      (dblclick)="toggle()"
      (keydown)="key($event)"
      (focus)="measure()"
    >
      <span class="tb-pane-handle__bar"></span>
    </div>
  `,
  styles: `
    /* the hit zone: the 24 dp spacer and 8 dp over each pane (M3: it slightly overlaps the panes; 8 dp ours) */
    .tb-pane-handle {
      position: absolute;
      z-index: 1;
      inset-block: 0;
      inset-inline-start: calc(-1 * (var(--tb-panes-spacer) + var(--tb-space-2)));
      inline-size: calc(var(--tb-panes-spacer) + 2 * var(--tb-space-2));
    }

    /* a leading pane: the flexible one follows it, the handle sits after it */
    .tb-pane:has(~ .tb-pane:not(.tb-pane--sheet)) > .tb-pane-handle {
      inset-inline: auto calc(-1 * (var(--tb-panes-spacer) + var(--tb-space-2)));
    }

    .tb-pane-handle__zone {
      display: flex;
      align-items: center;
      justify-content: center;
      block-size: 100%;
      cursor: col-resize;
      touch-action: none;
    }

    /* M3 DragHandle: 4×48 dp, full corners; pressed and dragged 12×52 dp, corner medium. Colours ours */
    .tb-pane-handle__bar {
      inline-size: 4px;
      block-size: 48px;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-outline-variant);
      /* no overshoot: the bar would bounce while the pane moves under the pointer (ours) */
      transition:
        inline-size var(--tb-spring-standard-fast-spatial),
        block-size var(--tb-spring-standard-fast-spatial),
        border-radius var(--tb-spring-standard-fast-spatial),
        background-color var(--tb-spring-fast-effects);
    }

    .tb-pane-handle__zone:hover .tb-pane-handle__bar {
      background: var(--p-md-outline);
    }

    .tb-pane-handle__zone:active .tb-pane-handle__bar,
    .tb-panes--resizing .tb-pane-handle__bar {
      inline-size: 12px;
      block-size: 52px;
      border-radius: var(--tb-shape-md);
      background: var(--p-md-primary);
    }
  `,
})
export class PaneHandle implements OnInit {
  /** The pane it resizes. */
  readonly pane = input.required<HTMLElement>();
  /** Where the width is remembered, unique per page. */
  readonly resizeKey = input.required<string>();
  /** The id of the pane (`aria-controls`). */
  readonly controls = input.required<string>();

  protected readonly label = SHARED_T.panes.resize;
  protected readonly now = signal(MIN_WIDTH);
  protected readonly min = signal(MIN_WIDTH);
  protected readonly max = signal(MIN_WIDTH);

  private readonly zone = viewChild.required<ElementRef<HTMLElement>>('zone');
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly user = inject(AuthService).user;
  /** The width set by the user (px); `null` — the M3 default of the breakpoint. */
  private width: number | null = null;
  /** The last width set by the user: a double click returns to it from the default. */
  private custom: number | null = null;
  private drag: (Limits & { readonly x: number }) | null = null;
  private x = 0;
  private frame = 0;

  constructor() {
    afterNextRender(() => {
      this.measure();
    });
    inject(DestroyRef).onDestroy(() => {
      this.stop();
    });
  }

  ngOnInit(): void {
    // before the first render: a remembered width never jumps
    this.width = this.stored();
    this.custom = this.width;
    this.apply(this.width);
  }

  /** The limits now, also for assistive technology. */
  measure(): Limits {
    const pane = this.pane();
    const box = pane.getBoundingClientRect();
    const panes = pane.parentElement;
    let max = Infinity;
    let spacer = 0;
    if (panes !== null) {
      const style = getComputedStyle(panes);
      spacer = px(style.columnGap);
      const inner = panes.clientWidth - px(style.paddingLeft) - px(style.paddingRight);
      const flexible = Array.from(panes.children).find(
        (el) => el !== pane && el.matches('.tb-pane:not(.tb-pane--sheet)'),
      );
      const room = flexible ? box.width + flexible.getBoundingClientRect().width - MIN_WIDTH : max;
      max = Math.min(inner / 2, room);
    }
    max = Math.max(MIN_WIDTH, Math.round(max));
    const handle = this.zone().nativeElement.getBoundingClientRect();
    const sign = handle.left + handle.width / 2 >= box.left + box.width / 2 ? 1 : -1;
    const middle = (this.window?.innerWidth ?? 0) / 2 - spacer / 2;
    const centred = sign > 0 ? middle - box.left : box.right - middle - spacer;
    const width = Math.round(box.width);
    this.now.set(width);
    this.min.set(MIN_WIDTH);
    this.max.set(max);
    return { width, min: MIN_WIDTH, max, sign, snaps: [MIN_WIDTH, LARGE_WIDTH, centred] };
  }

  protected start(event: PointerEvent): void {
    if (event.button !== 0 || this.drag !== null) {
      return;
    }
    event.preventDefault();
    const zone = this.zone().nativeElement;
    zone.setPointerCapture(event.pointerId);
    this.drag = { ...this.measure(), x: event.clientX };
    this.x = event.clientX;
    this.pane().parentElement?.classList.add('tb-panes--resizing');
    zone.addEventListener('pointermove', this.move);
    zone.addEventListener('pointerup', this.end);
    zone.addEventListener('pointercancel', this.end);
  }

  /** Each move only keeps the pointer; one frame writes the width. */
  private readonly move = (event: PointerEvent): void => {
    this.x = event.clientX;
    if (this.frame === 0 && this.window !== null) {
      this.frame = this.window.requestAnimationFrame(() => {
        this.frame = 0;
        if (this.drag !== null) {
          this.apply(this.dragged(this.drag));
        }
      });
    }
  };

  private readonly end = (): void => {
    const drag = this.drag;
    this.stop();
    if (drag !== null) {
      const dropped = this.dragged(drag);
      const snap = drag.snaps
        .map((width) => clamp(width, drag))
        .find((width) => Math.abs(width - dropped) <= SNAP_RANGE);
      this.set(Math.round(snap ?? dropped));
    }
  };

  /** M3 «toggle between layout sizes»: the default width ↔ the last one the user set. */
  protected toggle(): void {
    if (this.width !== null) {
      this.custom = this.width;
      this.set(null);
    } else if (this.custom !== null) {
      this.set(this.custom);
    }
  }

  protected key(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.toggle();
      event.preventDefault();
      return;
    }
    const steps: Partial<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 };
    const limits = this.measure();
    const step = steps[event.key];
    let width: number;
    if (step !== undefined) {
      width = (this.width ?? limits.width) + step * KEY_STEP * limits.sign;
    } else if (event.key === 'Home') {
      width = limits.min;
    } else if (event.key === 'End') {
      width = limits.max;
    } else {
      return;
    }
    event.preventDefault();
    this.set(clamp(width, limits));
  }

  private dragged(drag: Limits & { readonly x: number }): number {
    return clamp(drag.width + (this.x - drag.x) * drag.sign, drag);
  }

  private stop(): void {
    const zone = this.zone().nativeElement;
    zone.removeEventListener('pointermove', this.move);
    zone.removeEventListener('pointerup', this.end);
    zone.removeEventListener('pointercancel', this.end);
    if (this.frame !== 0) {
      this.window?.cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    this.drag = null;
    // the panes get their motion back before the last width is written: a snap moves on its spring
    this.pane().parentElement?.classList.remove('tb-panes--resizing');
  }

  private set(width: number | null): void {
    this.width = width;
    if (width !== null) {
      this.custom = width;
    }
    this.apply(width);
    // the default width is the CSS one (412 dp); the pane itself is still moving to it
    this.now.set(width ?? clamp(LARGE_WIDTH, this.measure()));
    try {
      if (width === null) {
        this.window?.localStorage.removeItem(this.storageKey());
      } else {
        this.window?.localStorage.setItem(this.storageKey(), String(width));
      }
    } catch {
      // storage is off: the width lives until the page closes
    }
  }

  private apply(width: number | null): void {
    const style = this.pane().style;
    if (width === null) {
      style.removeProperty('--tb-pane-width');
    } else {
      style.setProperty('--tb-pane-width', `${String(width)}px`);
    }
  }

  private stored(): number | null {
    try {
      const width = Number(this.window?.localStorage.getItem(this.storageKey()) ?? '');
      return Number.isFinite(width) && width > 0 ? width : null;
    } catch {
      return null;
    }
  }

  private storageKey(): string {
    return `tb.pane-width.${this.user()?.id ?? ''}.${this.resizeKey()}`;
  }
}

/** A computed length in px; none (`normal`, empty) — 0. */
function px(value: string): number {
  return parseFloat(value) || 0;
}

function clamp(width: number, limits: Pick<Limits, 'min' | 'max'>): number {
  return Math.min(limits.max, Math.max(limits.min, width));
}
