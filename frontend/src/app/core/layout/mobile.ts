import { BreakpointObserver } from '@angular/cdk/layout';
import { Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** Phones and small tablets: the bottom navigation, cards, the day list (ADR-0015). */
export const MOBILE_QUERY = '(max-width: 768px)';

/** Whether the screen is a phone's; follows rotation and window resizing. Call in an injection context. */
export function injectMobile(): Signal<boolean> {
  return toSignal(
    inject(BreakpointObserver)
      .observe(MOBILE_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
}
