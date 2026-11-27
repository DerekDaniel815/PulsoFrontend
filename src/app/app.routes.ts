import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';
import { dashboardGuard, userGuard } from './core/auth/user.guard';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        canActivate: [dashboardGuard],
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'mapa',
        canActivate: [userGuard],
        loadComponent: () => import('./pages/mapa/mapa').then((m) => m.Mapa),
      },
      {
        path: 'contactos',
        canActivate: [userGuard],
        loadComponent: () => import('./pages/contactos/contactos').then((m) => m.Contactos),
      },
      {
        path: 'grupos',
        canActivate: [userGuard],
        loadComponent: () => import('./pages/grupos/grupos').then((m) => m.Grupos),
      },
      {
        path: 'alertas',
        canActivate: [userGuard],
        loadComponent: () => import('./pages/alertas/alertas').then((m) => m.Alertas),
      },
      {
        path: 'historial',
        canActivate: [userGuard],
        loadComponent: () => import('./pages/historial/historial').then((m) => m.Historial),
      },
      {
        path: 'inventario',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/inventario/inventario').then((m) => m.Inventario),
      },
      {
        path: 'configuracion',
        canActivate: [userGuard],
        loadComponent: () => import('./pages/configuracion/configuracion').then((m) => m.Configuracion),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
