import { InjectionToken } from '@angular/core';

/** How often a page asks whether the portal is back after a restart, in milliseconds. */
export const RESTART_POLL_MS = new InjectionToken<number>('RESTART_POLL_MS', {
  factory: () => 2000,
});

/** How long a page waits for the portal to come back after a restart, in milliseconds. */
export const RESTART_WAIT_MS = 5 * 60_000;
