import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';
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
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'mapa',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/mapa/mapa').then((m) => m.Mapa),
      },
      {
        path: 'contactos',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/contactos/contactos').then((m) => m.Contactos),
      },
      {
        path: 'grupos',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/grupos/grupos').then((m) => m.Grupos),
      },
      {
        path: 'alertas',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/alertas/alertas').then((m) => m.Alertas),
      },
      {
        path: 'historial',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/historial/historial').then((m) => m.Historial),
      },
      {
        path: 'inventario',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/inventario/inventario').then((m) => m.Inventario),
      },
      {
        path: 'zonas-seguras',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/zonas-seguras/zonas-seguras').then((m) => m.ZonasSeguras),
      },
      {
        path: 'configuracion',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/configuracion/configuracion').then((m) => m.Configuracion),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
