import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { CallSession } from './call-session';

/**
 * `/call/:ownerId` — the link of a built-in room in reminders, calendars, the bot and messages
 * (ADR-0030): opens the pre-join sheet over the user's own pages. Inside the portal the user stays on
 * the page; a link from outside lands on the start page of the role.
 */
export const openCallGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.role();
  if (role === null) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  const ownerId = route.paramMap.get('ownerId');
  if (role !== 'ADMIN' && ownerId !== null) {
    inject(CallSession).open(ownerId);
  }
  return router.navigated ? false : router.parseUrl(auth.homeUrl());
};
