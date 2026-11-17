import { Signal, computed } from '@angular/core';

/**
 * True from the first time `visible` is true on. A dialog wraps its template in it: the content
 * projected into `<tb-dialog>` is built with its host even while hidden, and a page's hidden forms
 * held its first render (stage 419.5). Never false again, so the closing animation still plays.
 */
export function openedOnce(visible: Signal<boolean>): Signal<boolean> {
  let opened = false;
  return computed(() => (opened ||= visible()));
}
