import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

/**
 * Whether the page asks the expanded navigation rail to collapse to 96 dp (redesign spec §9: the review
 * of a work gets the room of its third pane). Only the extra-large window has the expanded rail; elsewhere
 * the rail is collapsed anyway. Set by {@link collapseRail}.
 */
@Injectable({ providedIn: 'root' })
export class RailState {
  readonly collapsed = signal(false);
  /** Whether the page hides the bottom navigation bar of a phone (the work under review, spec §9). */
  readonly bottomBarHidden = signal(false);
}

/** Hides the bottom navigation bar of a phone while the page lives and `hidden` is true: call it in the constructor. */
export function hideBottomBar(hidden: () => boolean): void {
  const state = inject(RailState);
  effect(() => {
    state.bottomBarHidden.set(hidden());
  });
  inject(DestroyRef).onDestroy(() => {
    state.bottomBarHidden.set(false);
  });
}

/** Collapses the rail while the page lives and `collapsed` is true: call it in the constructor of the page. */
export function collapseRail(collapsed: () => boolean): void {
  const state = inject(RailState);
  effect(() => {
    state.collapsed.set(collapsed());
  });
  inject(DestroyRef).onDestroy(() => {
    state.collapsed.set(false);
  });
}
