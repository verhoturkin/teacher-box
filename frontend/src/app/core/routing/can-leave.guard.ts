import { CanDeactivateFn } from '@angular/router';

/** A page that finishes its work before the user leaves it (e.g. saves a board). */
export interface CanLeave {
  /** @returns whether the page may be left */
  canLeave(): boolean | Promise<boolean>;
}

/** Asks the page whether it may be left. */
export const canLeaveGuard: CanDeactivateFn<CanLeave> = (page) => page.canLeave();
