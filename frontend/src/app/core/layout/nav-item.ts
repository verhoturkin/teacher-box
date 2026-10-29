import { Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { filter, map } from 'rxjs';

/**
 * A destination of the rail and the bottom bar. `alsoActive` — other addresses of the same section: the
 * destination is active on them too (the group card `/teacher/groups/:id` belongs to «Ученики»).
 */
export interface NavItem extends MenuItem {
  readonly alsoActive?: readonly string[];
  /** Addresses under the link that belong to another destination («Аккаунт» under the settings). */
  readonly except?: readonly string[];
  /** «Аккаунт»: the user's avatar instead of the icon, the name in the accessible name. */
  readonly account?: boolean;
  /** The counter on the destination (M3 badge); nothing at 0. */
  readonly count?: Signal<number>;
  /** What a screen reader hears for the counter. */
  readonly countLabel?: (count: number) => string;
}

function exact(item: NavItem): boolean {
  const options: unknown = item.routerLinkActiveOptions;
  return (
    typeof options === 'object' && options !== null && 'exact' in options && options.exact === true
  );
}

function under(path: string, link: string): boolean {
  return path === link || path.startsWith(`${link}/`);
}

/**
 * Whether the destination is the current one at the address (its query aside): the address is its link or
 * under it (`routerLinkActiveOptions: { exact: true }` — the link itself), or under one of `alsoActive`.
 */
export function isNavActive(item: NavItem, url: string): boolean {
  const path = url.split(/[?#]/)[0] ?? '';
  const link: unknown = item.routerLink;
  if ((item.except ?? []).some((other) => under(path, other))) {
    return false;
  }
  if (typeof link === 'string' && (exact(item) ? path === link : under(path, link))) {
    return true;
  }
  return (item.alsoActive ?? []).some((other) => under(path, other));
}

/** The address of the router after each navigation. Call in an injection context. */
export function injectUrl(): Signal<string> {
  const router = inject(Router);
  return toSignal(
    router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => router.url),
    ),
    { initialValue: router.url },
  );
}
