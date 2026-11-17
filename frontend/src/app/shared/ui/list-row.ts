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

/** The class of every row, so a batch can tell the rows that stay. */
const ROW = 'tb-list-row';

/** The rows of one list added and removed in one update, decided together on the next microtask. */
interface Batch {
  readonly enter: Map<HTMLElement, RowAnimation>;
  readonly leave: Map<HTMLElement, RowAnimation>;
}

const batches = new WeakMap<Element, Batch>();

/**
 * A row of a list that enters and leaves with motion (`styles/_motion.scss`, ADR-0066): a new row opens its
 * height on the standard fast spring and fades in, a leaving row fades out on fast effects and then closes its
 * height, so the rows under it close up without a jump. The rows of the first render of a list stand still;
 * so does a list whose rows are all replaced at once (another student's tasks in the same card): no row stays,
 * so nothing would close up, the old rows go and the new ones stand at once. Everything stands when the system
 * asks for less motion (the global rule makes the animations instant). `height: auto` does not animate, so the
 * row's height is measured into `--tb-motion-height`.
 */
@Directive({
  selector: '[tbListRow]',
  host: {
    class: ROW,
    '(animate.enter)': 'enter($event)',
    '(animate.leave)': 'leave($event)',
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
    const list = this.row.parentElement;
    if (list === null || !settled.has(list)) {
      complete(event);
      return;
    }
    queue(list).enter.set(this.row, event);
  }

  /** Angular calls it when the row is removed; it goes when its close ends (or at once, see `run`). */
  leave(event: RowAnimation): void {
    const list = this.row.parentElement;
    if (list === null) {
      complete(event);
      return;
    }
    queue(list).leave.set(this.row, event);
  }
}

function queue(list: Element): Batch {
  let batch = batches.get(list);
  if (batch === undefined) {
    const created: Batch = { enter: new Map(), leave: new Map() };
    batches.set(list, created);
    queueMicrotask(() => {
      batches.delete(list);
      run(list, created);
    });
    batch = created;
  }
  return batch;
}

/** A batch with no row staying and more than one row changing replaces the list: it changes without motion. */
function run(list: Element, { enter, leave }: Batch): void {
  const stays = Array.from(list.children).some(
    (child) =>
      child instanceof HTMLElement &&
      child.classList.contains(ROW) &&
      !child.classList.contains(ROW_LEAVE) &&
      !enter.has(child) &&
      !leave.has(child),
  );
  const replaced = !stays && enter.size + leave.size > 1;
  leave.forEach((event, row) => {
    if (replaced) {
      complete(event);
    } else {
      close(row);
    }
  });
  enter.forEach((event, row) => {
    if (replaced) {
      complete(event);
    } else {
      open(row, event);
    }
  });
}

function open(row: HTMLElement, event: RowAnimation): void {
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
function close(row: HTMLElement): void {
  measure(row);
  row.classList.add(ROW_LEAVE);
}

function complete(event: RowAnimation): void {
  Reflect.apply(event.animationComplete, undefined, []);
}

function measure(row: HTMLElement): void {
  row.style.setProperty('--tb-motion-height', `${String(row.offsetHeight)}px`);
}
