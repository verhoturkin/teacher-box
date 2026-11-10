import { Routes } from '@angular/router';

/**
 * The routes of development builds (ADR-0059): the design gallery. Production builds replace this file with
 * `dev-routes.prod.ts` (`fileReplacements` in `angular.json`), so they have neither the route nor its chunk.
 */
export const DEV_ROUTES: Routes = [
  { path: 'gallery', loadChildren: () => import('./gallery.routes').then((m) => m.GALLERY_ROUTES) },
];
