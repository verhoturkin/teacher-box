import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

/**
 * Whether the page asks the expanded navigation rail to collapse to 96 dp (redesign spec §9: the review
 * of a work gets the room of its third pane). Only the extra-large window has the expanded rail; elsewhere
 * the rail is collapsed anyway. Set by {@link collapseRail}.
 */
@Injectable({ providedIn: 'root' })
export class RailState {
  readonly collapsed = signal(false);
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
