import { inject } from '@angular/core';
import { CanActivateFn, RedirectFunction, Router } from '@angular/router';
import { Role } from './auth.models';
import { AuthService } from './auth.service';

/** Allows only users with the given role; others go to their own start page or to sign-in. */
export function roleGuard(role: Role): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const current = auth.role();
    if (current === null) {
      return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    }
    return current === role ? true : router.parseUrl(auth.homeUrl());
  };
}

/** The sign-in page is only for anonymous users. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).parseUrl(auth.homeUrl()) : true;
};

/** `/` leads to the start page of the current user. */
export const redirectToHome: RedirectFunction = () => inject(AuthService).homeUrl();
