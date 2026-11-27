import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthDialogService } from './auth-dialog.service';
import { SessionStore } from './session-store';

export const adminGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionStore);
  const router = inject(Router);

  if (!session.isAuthenticated()) {
    inject(AuthDialogService).open('login', state.url);
    return router.createUrlTree(['/dashboard']);
  }

  return session.user()?.rol === 'ADMIN' ? true : router.createUrlTree(['/dashboard']);
};
