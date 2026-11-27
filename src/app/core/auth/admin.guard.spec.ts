import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthDialogService } from './auth-dialog.service';
import { adminGuard } from './admin.guard';
import { AuthResponse } from './auth.models';
import { SessionStore } from './session-store';

const session: AuthResponse = {
  accessToken: 'test-token',
  user: {
    idUsuario: 1, nombres: 'Ana', apellidos: 'Ruiz',
    correo: 'ana@example.com', rol: 'USUARIO', estado: true,
    fechaRegistro: '', fechaActualizacion: '',
  },
};

describe('adminGuard', () => {
  let store: SessionStore;
  let router: Router;
  let dialog: AuthDialogService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    store = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
    dialog = TestBed.inject(AuthDialogService);
  });

  function enter(): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, { url: '/inventario' } as RouterStateSnapshot) as boolean | UrlTree);
  }

  it('opens login for an unauthenticated visitor and redirects to dashboard', () => {
    expect(router.serializeUrl(enter() as UrlTree)).toBe('/dashboard');
    expect(dialog.returnUrl()).toBe('/inventario');
  });

  it('does not allow an authenticated USUARIO into inventory', () => {
    store.establish(session);
    expect(router.serializeUrl(enter() as UrlTree)).toBe('/dashboard');
    expect(dialog.isOpen()).toBe(false);
  });

  it('allows only the system ADMIN role', () => {
    store.establish({ ...session, user: { ...session.user, rol: 'ADMIN' } });
    expect(enter()).toBe(true);
  });
});
