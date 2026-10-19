import { BreakpointObserver } from '@angular/cdk/layout';
import { Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** M3 breakpoints (formerly window size classes): the navigation, the rail and the number of panes. */
export type WindowSize = 'compact' | 'medium' | 'expanded' | 'large' | 'extra-large';

/**
 * The media query of each breakpoint (M3: 600 / 840 / 1200 / 1600 dp, ADR-0048). The bounds are in em and the
 * ranges have no gaps, the same as in the styles (ADR-0024): 37.5 / 52.5 / 75 / 100 em at the usual font, a
 * larger font moves the layout to a narrower breakpoint.
 */
export const BREAKPOINT_QUERIES: Readonly<Record<WindowSize, string>> = {
  compact: '(width < 37.5em)',
  medium: '(37.5em <= width < 52.5em)',
  expanded: '(52.5em <= width < 75em)',
  large: '(75em <= width < 100em)',
  'extra-large': '(width >= 100em)',
};

/** Phones: the bottom navigation, cards, the day list (ADR-0015). */
export const MOBILE_QUERY = BREAKPOINT_QUERIES.compact;

const SIZES: readonly WindowSize[] = ['compact', 'medium', 'expanded', 'large', 'extra-large'];

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

/**
 * The breakpoint of the window; follows rotation and resizing. Before the first answer of the observer
 * (and when nothing matches) it is expanded. Call in an injection context.
 */
export function injectWindowSize(): Signal<WindowSize> {
  const checks = SIZES.map((size) => [size, matches(BREAKPOINT_QUERIES[size])] as const);
  return computed(() => checks.find(([, match]) => match())?.[0] ?? 'expanded');
}
