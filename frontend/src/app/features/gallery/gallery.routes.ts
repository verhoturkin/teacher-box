import { Routes } from '@angular/router';

export const GALLERY_ROUTES: Routes = [
  {
    path: '',
    title: 'Design gallery',
    loadComponent: () => import('./gallery-page').then((m) => m.GalleryPage),
  },
];
