import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthDialogService } from './auth-dialog.service';
import { AuthResponse } from './auth.models';
import { SessionStore } from './session-store';

const SESSION: AuthResponse = {
  accessToken: 'test-token',
  user: {
    idUsuario: 1,
    nombres: 'Test',
    apellidos: 'User',
    correo: 'test@example.com',
    rol: 'USUARIO',
    estado: true,
    fechaRegistro: '2026-09-20T10:00:00.000Z',
    fechaActualizacion: '2026-09-20T10:00:00.000Z',
  },
};

describe('authGuard', () => {
  let store: SessionStore;
  let dialog: AuthDialogService;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    store = TestBed.inject(SessionStore);
    dialog = TestBed.inject(AuthDialogService);
    router = TestBed.inject(Router);
  });

  function runGuard(url: string): boolean | UrlTree {
    return TestBed.runInInjectionContext(
      () =>
        authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot) as
          boolean | UrlTree,
    );
  }

  it('opens the login and redirects an anonymous visitor to the map', () => {
    const result = runGuard('/contactos');

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/dashboard');
    expect(dialog.isOpen()).toBe(true);
    expect(dialog.returnUrl()).toBe('/contactos');
  });

  it('allows an authenticated user to continue', () => {
    store.establish(SESSION);

    expect(runGuard('/contactos')).toBe(true);
    expect(dialog.isOpen()).toBe(false);
  });
});
