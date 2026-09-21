import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthDialogService } from './auth-dialog.service';
import { SessionStore } from './session-store';

export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(SessionStore).isAuthenticated()) {
    return true;
  }

  inject(AuthDialogService).open('login', state.url);
  return inject(Router).createUrlTree(['/dashboard']);
};
