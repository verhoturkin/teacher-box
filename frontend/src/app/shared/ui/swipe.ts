import { DestroyRef, Directive, ElementRef, inject, input, output, signal } from '@angular/core';

/** How far a row must go aside to count as swiped: this share of its width, but at least `SWIPE_MIN_PX`. */
export const SWIPE_SHARE = 0.3;
export const SWIPE_MIN_PX = 64;
/** A move shorter than this is a tap: the row stays and the click goes through. */
const TAP_SLOP_PX = 8;
/** A swiped row the page did not take away comes back after this time (e.g. the request failed). */
export const SWIPE_RESTORE_MS = 1500;

/**
 * A row that a finger moves aside to act on it (a notification on a phone: «прочитано»). The row follows the
 * finger sideways and fades; let go far enough — `tbSwiped` fires and the row slides out, otherwise it comes
 * back. Vertical moves stay the page's scroll (`touch-action: pan-y`), a mouse does nothing. A swipe is a
 * shortcut only: the row keeps its button for the same action (WCAG 2.5.1).
 */
@Directive({
  selector: '[tbSwipe]',
  host: {
    '[class.tb-swipe]': 'tbSwipe()',
    '[class.tb-swipe--dragging]': 'dragging()',
    '[style.touch-action]': "tbSwipe() ? 'pan-y' : null",
    '[style.transform]': "offset() === 0 ? null : 'translateX(' + offset() + 'px)'",
    '[style.opacity]': 'opacity()',
    '(pointerdown)': 'start($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'end()',
    '(pointercancel)': 'reset()',
  },
})
export class Swipe {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Whether the row can be swiped (e.g. only on a phone and only while unread). */
  readonly tbSwipe = input(false);
  /** The row went far enough aside. */
  readonly tbSwiped = output();

  protected readonly offset = signal(0);
  protected readonly dragging = signal(false);
  private origin: { readonly x: number; readonly y: number; readonly id: number } | null = null;
  private moved = false;
  private restore: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // capturing: the click is stopped before a button of the row gets it
    const swallow = (event: Event): void => {
      this.swallow(event);
    };
    this.host.nativeElement.addEventListener('click', swallow, true);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.restore);
      this.host.nativeElement.removeEventListener('click', swallow, true);
    });
  }

  protected opacity(): number | null {
    const width = this.width();
    return this.offset() === 0 ? null : Math.max(0.2, 1 - Math.abs(this.offset()) / width);
  }

  protected start(event: PointerEvent): void {
    if (!this.tbSwipe() || event.pointerType === 'mouse' || this.origin !== null) {
      return;
    }
    clearTimeout(this.restore);
    this.offset.set(0);
    this.origin = { x: event.clientX, y: event.clientY, id: event.pointerId };
    this.moved = false;
  }

  protected move(event: PointerEvent): void {
    const origin = this.origin;
    if (origin?.id !== event.pointerId) {
      return;
    }
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (!this.moved) {
      if (Math.abs(dx) < TAP_SLOP_PX) {
        return;
      }
      if (Math.abs(dy) > Math.abs(dx)) {
        // a scroll: the page takes it
        this.reset();
        return;
      }
      this.moved = true;
      this.dragging.set(true);
    }
    this.offset.set(dx);
  }

  protected end(): void {
    if (this.origin === null) {
      return;
    }
    this.origin = null;
    this.dragging.set(false);
    const offset = this.offset();
    if (Math.abs(offset) < Math.max(SWIPE_MIN_PX, this.width() * SWIPE_SHARE)) {
      this.offset.set(0);
      return;
    }
    this.offset.set(Math.sign(offset) * this.width());
    this.tbSwiped.emit();
    this.restore = setTimeout(() => {
      this.offset.set(0);
    }, SWIPE_RESTORE_MS);
  }

  protected reset(): void {
    this.origin = null;
    this.dragging.set(false);
    this.offset.set(0);
  }

  /** The click that ends a swipe opens nothing. */
  private swallow(event: Event): void {
    if (this.moved) {
      this.moved = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  private width(): number {
    return Math.max(this.host.nativeElement.offsetWidth, SWIPE_MIN_PX * 2);
  }
}
