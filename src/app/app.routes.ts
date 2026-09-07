import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'MedicalSys · Inicio',
    loadComponent: () => import('./features/home/home-page').then((module) => module.HomePage),
  },
  {
    path: 'auditoria',
    title: 'MedicalSys · Auditoría',
    loadComponent: () => import('./features/audit/audit-page').then((module) => module.AuditPage),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
