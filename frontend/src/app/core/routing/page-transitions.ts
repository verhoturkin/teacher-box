import { DOCUMENT, inject } from '@angular/core';
import { type ActivatedRouteSnapshot, type ViewTransitionInfo } from '@angular/router';

/**
 * How a page replaces the previous one (M3 transition patterns on M3E springs, design-system §1
 * «Motion»): `through` — fade through, between destinations of the navigation and at equal depth;
 * `forward` / `back` — shared axis X, deeper into a section and back out of it.
 */
export type PageMotion = 'through' | 'forward' | 'back';

/** The attribute of `<html>` that `styles/_motion.scss` reads while a page transition runs. */
export const PAGE_MOTION_ATTRIBUTE = 'data-tb-page';

function leaf(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  let current = snapshot;
  while (current.firstChild) {
    current = current.firstChild;
  }
  return current;
}

function segments(snapshot: ActivatedRouteSnapshot): string[] {
  return snapshot.pathFromRoot.flatMap((part) => part.url.map((segment) => segment.path));
}

/**
 * The motion from one page to another, or `null` when the page stays: the same route with other
 * parameters (a list-detail pane, a tab or a filter in the address) moves its own parts.
 * A section is the first two segments (`teacher/billing`); a role's home is a section of its own.
 */
export function pageMotion(
  from: ActivatedRouteSnapshot,
  to: ActivatedRouteSnapshot,
): PageMotion | null {
  const before = leaf(from);
  const after = leaf(to);
  if (before.routeConfig === after.routeConfig) {
    return null;
  }
  const was = segments(before);
  const is = segments(after);
  const section = (path: readonly string[]): string => path.slice(0, 2).join('/');
  if (section(was) !== section(is) || was.length === is.length) {
    return 'through';
  }
  return is.length > was.length ? 'forward' : 'back';
}

let running: ViewTransition | null = null;

/**
 * `onViewTransitionCreated` of `withViewTransitions`: marks `<html>` with the motion for the CSS, or
 * skips the transition when the page stays or the system asks for less motion.
 */
export function startPageTransition({ transition, from, to }: ViewTransitionInfo): void {
  const document = inject(DOCUMENT);
  const motion = pageMotion(from, to);
  const reduced = document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (motion === null || reduced === true) {
    transition.skipTransition();
    return;
  }
  const root = document.documentElement;
  root.setAttribute(PAGE_MOTION_ATTRIBUTE, motion);
  running = transition;
  void transition.finished.finally(() => {
    if (running === transition) {
      running = null;
      root.removeAttribute(PAGE_MOTION_ATTRIBUTE);
    }
  });
}
