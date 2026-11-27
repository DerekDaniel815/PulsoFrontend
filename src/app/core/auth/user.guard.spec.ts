import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthDialogService } from './auth-dialog.service';
import { userGuard, dashboardGuard } from './user.guard';
import { AuthResponse } from './auth.models';
import { SessionStore } from './session-store';

const SESSION: AuthResponse = {
  accessToken: 'test-token',
  user: {
    idUsuario: 1, nombres: 'Ana', apellidos: 'Ruiz',
    correo: 'ana@example.com', rol: 'USUARIO', estado: true,
    fechaRegistro: '', fechaActualizacion: '',
  },
};

describe('role-limited routes', () => {
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

  function enterUser(url: string): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      userGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot) as boolean | UrlTree);
  }

  function enterDashboard(): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      dashboardGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as boolean | UrlTree);
  }

  it('lets guests see the login dashboard but prompts them for private routes', () => {
    expect(enterDashboard()).toBe(true);
    expect(router.serializeUrl(enterUser('/mapa') as UrlTree)).toBe('/dashboard');
    expect(dialog.returnUrl()).toBe('/mapa');
    expect(dialog.isOpen()).toBe(true);
  });

  it('lets USUARIO enter their private routes and dashboard', () => {
    store.establish(SESSION);
    expect(enterUser('/mapa')).toBe(true);
    expect(enterUser('/configuracion')).toBe(true);
    expect(enterDashboard()).toBe(true);
  });

  it('sends ADMIN to inventory from dashboard or any user-only route', () => {
    store.establish({ ...SESSION, user: { ...SESSION.user, rol: 'ADMIN' } });
    expect(router.serializeUrl(enterDashboard() as UrlTree)).toBe('/inventario');
    expect(router.serializeUrl(enterUser('/alertas') as UrlTree)).toBe('/inventario');
    expect(router.serializeUrl(enterUser('/mapa') as UrlTree)).toBe('/inventario');
  });
});
