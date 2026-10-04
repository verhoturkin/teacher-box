import { BreakpointObserver } from '@angular/cdk/layout';
import { Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/**
 * Phones and small tablets: the bottom navigation, cards, the day list (ADR-0015). The bounds are in
 * em and ranges without gaps, the same as in the styles (ADR-0024): 768 and 1200 px at the usual
 * font, a larger font moves the layout to the rail or the phone.
 */
export const MOBILE_QUERY = '(width <= 48em)';

/** Tablets and small laptops: the navigation rail (ADR-0017). */
export const MEDIUM_QUERY = '(48em < width < 75em)';

/** M3 window size classes: bottom navigation, rail or drawer (ADR-0017). */
export type WindowSize = 'compact' | 'medium' | 'expanded';

function matches(query: string): Signal<boolean> {
  return toSignal(
    inject(BreakpointObserver)
      .observe(query)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
}

/** Whether the screen is a phone's; follows rotation and window resizing. Call in an injection context. */
export function injectMobile(): Signal<boolean> {
  return matches(MOBILE_QUERY);
}

/** The size class of the window; follows rotation and resizing. Call in an injection context. */
export function injectWindowSize(): Signal<WindowSize> {
  const compact = matches(MOBILE_QUERY);
  const medium = matches(MEDIUM_QUERY);
  return computed(() => {
    if (compact()) {
      return 'compact';
    }
    return medium() ? 'medium' : 'expanded';
  });
}
