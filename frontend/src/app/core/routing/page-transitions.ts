import { DOCUMENT, inject } from '@angular/core';
import { type ActivatedRouteSnapshot, type ViewTransitionInfo } from '@angular/router';

/**
 * How a page replaces the previous one (M3 transition patterns, ADR-0066, design-system §1 «Motion»):
 * `through` — top level (fade through), between destinations of the navigation and at equal depth;
 * `forward` / `back` — forward and backward, deeper into a section and back out of it; `detail` — only
 * the last of the panes side by side fades out and in (the list beside it stays).
 */
export type PageMotion = 'through' | 'forward' | 'back' | 'detail';

/**
 * A detail beside its list in the content: the second of panes side by side from expanded (a side
 * sheet is not a detail), or the detail column of a list inside one pane (`data-tb-detail`, Settings).
 */
const SIDE_BY_SIDE =
  '.tb-shell__content tb-panes:not(.tb-panes--single) > tb-pane + tb-pane:not(.tb-pane--sheet), ' +
  '.tb-shell__content [data-tb-detail]';

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
 * The motion from one page to another, or `null` when the page stays (only the query changes: a tab
 * or a filter). The same route with other segments (`/teacher/homework` → `/teacher/homework/:id`)
 * changes the detail: beside the list (`sideBySide`) only the detail pane fades, on one pane it is
 * deeper or back. So does the same page on two routes of a section (`help` and `help/:topic`): the
 * first choice beside the list moves like every later one. A section is the first two segments
 * (`teacher/billing`); a role's home is a section of its own.
 */
export function pageMotion(
  from: ActivatedRouteSnapshot,
  to: ActivatedRouteSnapshot,
  sideBySide = false,
): PageMotion | null {
  const before = leaf(from);
  const after = leaf(to);
  const was = segments(before);
  const is = segments(after);
  const depth = (): PageMotion => (is.length > was.length ? 'forward' : 'back');
  if (before.routeConfig === after.routeConfig) {
    if (was.join('/') === is.join('/')) {
      return null;
    }
    return sideBySide ? 'detail' : was.length === is.length ? 'through' : depth();
  }
  const section = (path: readonly string[]): string => path.slice(0, 2).join('/');
  if (section(was) !== section(is)) {
    return 'through';
  }
  if (sideBySide && before.component !== null && before.component === after.component) {
    return 'detail';
  }
  return was.length === is.length ? 'through' : depth();
}

/** The custom property of `<html>` with the frame a page slides in (`styles/_motion.scss`). */
export const PAGE_CLIP_PROPERTY = '--tb-page-clip';

/** The custom property of `<html>` with the surface of a single pane, which stays while it changes. */
export const PAGE_SURFACE_PROPERTY = '--tb-page-surface';

/** The surface of the only pane of the page (no list beside it, no side sheet), or `null`. */
function paneSurface(document: Document): string | null {
  const panes = document.querySelectorAll('.tb-shell__content tb-panes > tb-pane');
  const [pane] = panes;
  return panes.length === 1 && pane !== undefined
    ? (document.defaultView?.getComputedStyle(pane).backgroundColor ?? null)
    : null;
}

function setOrRemove(root: HTMLElement, property: string, value: string | null): void {
  if (value === null) {
    root.style.removeProperty(property);
  } else {
    root.style.setProperty(property, value);
  }
}

/**
 * The frame of the panes inside the content: the content minus the margins of `tb-panes`, with the
 * corners of a pane; `null` when the panes lie on the window (a phone) or there are none.
 */
function paneFrame(document: Document): string | null {
  const panes = document.querySelector('.tb-shell__content tb-panes');
  const style = panes === null ? null : document.defaultView?.getComputedStyle(panes);
  if (!style) {
    return null;
  }
  const sides = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
  return sides.every((side) => (Number.parseFloat(side) || 0) === 0)
    ? null
    : `inset(${sides.join(' ')} round var(--tb-shape-xl))`;
}

let running: ViewTransition | null = null;

/**
 * `onViewTransitionCreated` of `withViewTransitions`: marks `<html>` with the motion for the CSS, or
 * skips the transition when the page stays. With less motion the CSS keeps only the fades (ADR-0066).
 */
export function startPageTransition({ transition, from, to }: ViewTransitionInfo): void {
  const document = inject(DOCUMENT);
  const motion = pageMotion(from, to, document.querySelector(SIDE_BY_SIDE) !== null);
  if (motion === null) {
    transition.skipTransition();
    return;
  }
  const root = document.documentElement;
  root.setAttribute(PAGE_MOTION_ATTRIBUTE, motion);
  setOrRemove(root, PAGE_CLIP_PROPERTY, paneFrame(document));
  setOrRemove(root, PAGE_SURFACE_PROPERTY, paneSurface(document));
  running = transition;
  void transition.finished.finally(() => {
    if (running === transition) {
      running = null;
      root.removeAttribute(PAGE_MOTION_ATTRIBUTE);
      root.style.removeProperty(PAGE_CLIP_PROPERTY);
      root.style.removeProperty(PAGE_SURFACE_PROPERTY);
    }
  });
}
