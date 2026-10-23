import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { MenuItem } from 'primeng/api';

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
  /** The page's own top app bar on compact (spec §10.2): its title and actions in place of the section's. */
  readonly compactBar = signal<CompactBar | null>(null);
}

/** An icon action of the top app bar on compact. */
export interface CompactBarAction {
  readonly icon: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly command: () => void;
}

/**
 * What a page puts into the top app bar of a phone (M3 small top app bar: ☰, the title, up to a few trailing
 * icons): the title replaces the section's name, `actions` stand as icons, `menu` is the overflow «⋮». The
 * bell and the account button give their place to them.
 */
export interface CompactBar {
  readonly title: string;
  readonly actions: readonly CompactBarAction[];
  readonly menu: MenuItem[];
  /** The accessible name of «⋮». */
  readonly menuLabel: string;
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
