import { Routes } from '@angular/router';

const page = () => import('./gallery-page').then((m) => m.GalleryPage);

/** The gallery and its parts: `/gallery/<section>` opens the page at that section. */
export const GALLERY_ROUTES: Routes = [
  { path: '', title: 'Design gallery', loadComponent: page },
  { path: ':section', title: 'Design gallery', loadComponent: page },
];
