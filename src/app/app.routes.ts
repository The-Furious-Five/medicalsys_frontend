import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'catalogos',
    title: 'MedicalSys · Catálogos clínicos',
    loadComponent: () =>
      import('./features/catalogs/catalogs-page').then((module) => module.CatalogsPage),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'catalogos',
  },
  {
    path: '**',
    redirectTo: 'catalogos',
  },
];
