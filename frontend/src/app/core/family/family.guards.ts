import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { Family } from './family';

/** `/family` leads to the first child; without a child it stays on the page that says so. */
export const firstChildGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(Family)
    .load()
    .pipe(map(([first]) => (first === undefined ? true : router.parseUrl(`/family/${first.id}`))));
};

/**
 * `/family/:studentId/...` opens only a current child of the parent and makes them the child of the
 * cabinet; another address leads to `/family` (the first child). The server checks the same (404).
 */
export const familyChildGuard: CanActivateFn = (route) => {
  const family = inject(Family);
  const router = inject(Router);
  const id = route.paramMap.get('studentId');
  return family.load().pipe(
    map((children) => {
      if (children.some((child) => child.id === id)) {
        family.current.set(id);
        return true;
      }
      return router.parseUrl('/family');
    }),
  );
};
