import { DestroyRef, Injectable, InjectionToken, Type, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** The tabs of the notifications sheet: the inbox and, for the teacher, the messages sent to students. */
export type NotificationsTab = 'inbox' | 'sent';

/**
 * The query parameter that opens the notifications sheet over any page: `?notifications=inbox|sent` (old
 * links to the notifications page lead to the home page with it, redesign spec §10.3).
 */
export const NOTIFICATIONS_PARAM = 'notifications';

/**
 * Loads the content of the notifications sheet (the tabs of the notifications feature). The application
 * provides it: the frame in core/ does not import features (AGENTS.md §4.2 rule 6).
 */
export const NOTIFICATIONS_SHEET_CONTENT = new InjectionToken<() => Promise<Type<unknown>>>(
  'NOTIFICATIONS_SHEET_CONTENT',
);

/** Whether the notifications sheet of the bell is open and on which tab. */
@Injectable({ providedIn: 'root' })
export class NotificationsSheetState {
  private readonly openState = signal(false);

  readonly open = this.openState.asReadonly();
  readonly tab = signal<NotificationsTab>('inbox');

  show(tab: NotificationsTab = this.tab()): void {
    this.tab.set(tab);
    this.openState.set(true);
  }

  close(): void {
    this.openState.set(false);
  }

  toggle(): void {
    this.openState.update((open) => !open);
  }
}

/** The tab a value of {@link NOTIFICATIONS_PARAM} asks for; any other value — the inbox. */
export function notificationsTab(value: string): NotificationsTab {
  return value === 'sent' ? 'sent' : 'inbox';
}

/**
 * Opens the sheet when an address asks for it (`?notifications=…`) — on arrival and on later navigations —
 * and drops the parameter (replacing the address), so a reload or «Назад» does not open it again. Other
 * parameters stay. Call it in an injection context of the frame.
 */
export function openOnNotificationsParam(): void {
  const router = inject(Router);
  const state = inject(NotificationsSheetState);
  const check = (): void => {
    const tree = router.parseUrl(router.url);
    const value: unknown = tree.queryParams[NOTIFICATIONS_PARAM];
    if (typeof value !== 'string') {
      return;
    }
    state.show(notificationsTab(value));
    tree.queryParams = Object.fromEntries(
      Object.entries(tree.queryParams).filter(([name]) => name !== NOTIFICATIONS_PARAM),
    );
    void router.navigateByUrl(tree, { replaceUrl: true });
  };
  const subscription = router.events
    .pipe(filter((event) => event instanceof NavigationEnd))
    .subscribe(check);
  inject(DestroyRef).onDestroy(() => {
    subscription.unsubscribe();
  });
  check();
}
