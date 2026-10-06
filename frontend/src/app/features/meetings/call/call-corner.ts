import { DOCUMENT, ElementRef, computed, inject, signal } from '@angular/core';

/** A corner a floating part of a call keeps to. */
export type CallCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** The order of «move to the next corner». */
const CORNERS: readonly CallCorner[] = ['bottom-right', 'bottom-left', 'top-left', 'top-right'];

/** A side an arrow key moves to. */
export type CallSide = 'top' | 'bottom' | 'left' | 'right';

interface Drag {
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
}

/**
 * Moving a floating part of a call (the mini window, the own camera) between corners: dragged, it follows
 * the pointer (`offset` for `translate`); dropped, it snaps to the corner nearest to its middle within its
 * positioning parent (the screen for a fixed element). The corner is remembered on the device under `key`.
 */
export class CornerDrag {
  private readonly current = signal<CallCorner>('bottom-right');
  private readonly moving = signal<Drag | null>(null);

  readonly corner = this.current.asReadonly();
  readonly dragging = computed(() => this.moving() !== null);
  readonly offset = computed(() => {
    const drag = this.moving();
    return drag === null ? null : `${String(drag.dx)}px ${String(drag.dy)}px`;
  });

  constructor(
    private readonly host: HTMLElement,
    private readonly window: Window | null,
    private readonly key: string,
  ) {
    this.current.set(this.stored());
  }

  next(): void {
    const index = CORNERS.indexOf(this.current());
    this.set(CORNERS[(index + 1) % CORNERS.length] ?? 'bottom-right');
  }

  /** The corner on the given side, keeping the other half (an arrow key). */
  toward(side: CallSide): void {
    const [vertical, horizontal] = this.current().split('-');
    if (side === 'top' || side === 'bottom') {
      this.set(`${side}-${horizontal === 'left' ? 'left' : 'right'}`);
    } else {
      this.set(`${vertical === 'top' ? 'top' : 'bottom'}-${side}`);
    }
  }

  start(event: PointerEvent): void {
    const handle = event.currentTarget;
    if (handle instanceof Element) {
      handle.setPointerCapture(event.pointerId);
    }
    this.moving.set({ x: event.clientX, y: event.clientY, dx: 0, dy: 0 });
  }

  move(event: PointerEvent): void {
    const drag = this.moving();
    if (drag !== null) {
      this.moving.set({ ...drag, dx: event.clientX - drag.x, dy: event.clientY - drag.y });
    }
  }

  end(): void {
    if (this.moving() === null) {
      return;
    }
    const box = this.host.getBoundingClientRect();
    const area = this.area(box);
    const middleX = box.left + box.width / 2 - area.left;
    const middleY = box.top + box.height / 2 - area.top;
    this.moving.set(null);
    const top = middleY < area.height / 2;
    const left = middleX < area.width / 2;
    this.set(`${top ? 'top' : 'bottom'}-${left ? 'left' : 'right'}`);
  }

  cancel(): void {
    this.moving.set(null);
  }

  private area(box: DOMRect): { left: number; top: number; width: number; height: number } {
    const parent = this.host.offsetParent;
    if (parent !== null) {
      return parent.getBoundingClientRect();
    }
    return {
      left: 0,
      top: 0,
      width: this.window?.innerWidth ?? box.right,
      height: this.window?.innerHeight ?? box.bottom,
    };
  }

  private set(corner: CallCorner): void {
    this.current.set(corner);
    try {
      this.window?.localStorage.setItem(this.key, corner);
    } catch {
      // storage is off: the corner lives until the page closes
    }
  }

  private stored(): CallCorner {
    try {
      const stored = this.window?.localStorage.getItem(this.key);
      return CORNERS.find((corner) => corner === stored) ?? 'bottom-right';
    } catch {
      return 'bottom-right';
    }
  }
}

/** A `CornerDrag` of the component's host element. */
export function injectCornerDrag(key: string): CornerDrag {
  const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  return new CornerDrag(host, inject(DOCUMENT).defaultView, key);
}
