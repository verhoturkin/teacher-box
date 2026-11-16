import {
  afterNextRender,
  type AnimationCallbackEvent,
  Directive,
  ElementRef,
  inject,
} from '@angular/core';

/** Lists whose first rows have rendered: rows that come later enter with motion. */
const settled = new WeakSet<Element>();

/** The class of a row that opens its height (removed when it has opened). */
export const ROW_ENTER = 'tb-list-row--enter';
/** What Angular passes to `(animate.enter)`: `animationComplete` is typed as a bare `Function`. */
export type RowAnimation = Pick<AnimationCallbackEvent, 'animationComplete'>;

/** The class of a row that fades and closes its height (Angular removes the row after it). */
export const ROW_LEAVE = 'tb-list-row--leave';

/**
 * A row of a list that enters and leaves with motion (`styles/_motion.scss`, ADR-0066): a new row opens its
 * height on the standard fast spring and fades in, a leaving row fades out on fast effects and then closes its
 * height, so the rows under it close up without a jump. The rows of the first render of a list stand still;
 * so does everything when the system asks for less motion (the global rule makes the animations instant).
 * `height: auto` does not animate, so the row's height is measured into `--tb-motion-height`.
 */
@Directive({
  selector: '[tbListRow]',
  host: {
    '(animate.enter)': 'enter($event)',
    '(animate.leave)': 'leave()',
  },
})
export class ListRow {
  private readonly row = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    const row = this.row;
    afterNextRender(() => {
      if (row.parentElement !== null) {
        settled.add(row.parentElement);
      }
    });
  }

  /** Angular calls it when the row is added. */
  enter(event: RowAnimation): void {
    const row = this.row;
    const list = row.parentElement;
    if (list === null || !settled.has(list)) {
      complete(event);
      return;
    }
    measure(row);
    row.classList.add(ROW_ENTER);
    const opened = (end: AnimationEvent): void => {
      if (end.target !== row || end.animationName !== 'tb-motion-row-open') {
        return;
      }
      row.removeEventListener('animationend', opened);
      row.classList.remove(ROW_ENTER);
      complete(event);
    };
    row.addEventListener('animationend', opened);
  }

  /** The row's one animation is the close (the fade is a transition): its end lets Angular remove the row. */
  leave(): void {
    const row = this.row;
    measure(row);
    row.classList.add(ROW_LEAVE);
  }
}

function complete(event: RowAnimation): void {
  Reflect.apply(event.animationComplete, undefined, []);
}

function measure(row: HTMLElement): void {
  row.style.setProperty('--tb-motion-height', `${String(row.offsetHeight)}px`);
}
