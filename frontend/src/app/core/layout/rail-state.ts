import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { MenuItem } from 'primeng/api';

/**
 * What a page tells the navigation frame: the bottom bar of a phone, the top app bar of a phone. The
 * rail never changes because of a page: it is expanded from 1600 px and collapsed below.
 */
@Injectable({ providedIn: 'root' })
export class RailState {
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
