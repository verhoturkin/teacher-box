import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { Portal } from './portal';

export const SETUP_URL = '/teacher/setup';

/**
 * The teacher's first setup (ADR-0014): a generated password must be replaced before anything else;
 * the home page leads to the wizard until it is finished or skipped.
 */
export const setupGuard: CanActivateChildFn = async (_route, state) => {
  const router = inject(Router);
  if (state.url.startsWith(SETUP_URL)) {
    return true;
  }
  if (inject(AuthService).user()?.passwordChangeRequired === true) {
    return router.parseUrl(SETUP_URL);
  }
  const home = state.url === '/teacher' || state.url === '/teacher/';
  if (!home) {
    return true;
  }
  const portal = inject(Portal);
  return (await portal.setupCompleted()) ? true : router.parseUrl(SETUP_URL);
};
