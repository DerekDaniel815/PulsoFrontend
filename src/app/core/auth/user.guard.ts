import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthDialogService } from './auth-dialog.service';
import { SessionStore } from './session-store';

export const userGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionStore);
  const router = inject(Router);

  if (!session.isAuthenticated()) {
    inject(AuthDialogService).open('login', state.url);
    return router.createUrlTree(['/dashboard']);
  }

  return session.user()?.rol === 'USUARIO' ? true : router.createUrlTree(['/inventario']);
};

export const dashboardGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  return session.isAuthenticated() && session.user()?.rol === 'ADMIN'
    ? inject(Router).createUrlTree(['/inventario'])
    : true;
};
