import { routes } from '../app.routes';
import { adminGuard } from '../core/auth/admin.guard';
import { dashboardGuard, userGuard } from '../core/auth/user.guard';
import { navItemsForRole } from './nav';

describe('navigation by system role', () => {
  it('only offers inventory to ADMIN', () => {
    expect(navItemsForRole('ADMIN').map((item) => item.path)).toEqual(['/inventario']);
  });

  it('keeps user navigation without inventory or safe zones', () => {
    const paths = navItemsForRole('USUARIO').map((item) => item.path);
    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/mapa');
    expect(paths).not.toContain('/inventario');
    expect(paths).not.toContain('/zonas-seguras');
  });

  it('does not expose a safe zones route to either role', () => {
    const childPaths = routes[0].children?.map((route) => route.path);
    expect(childPaths).not.toContain('zonas-seguras');
  });

  it('protects actual application routes according to system role', () => {
    const children = routes[0].children ?? [];
    for (const path of ['mapa', 'contactos', 'grupos', 'alertas', 'historial', 'configuracion']) {
      expect(children.find((route) => route.path === path)?.canActivate).toEqual([userGuard]);
    }
    expect(children.find((route) => route.path === 'dashboard')?.canActivate).toEqual([dashboardGuard]);
    expect(children.find((route) => route.path === 'inventario')?.canActivate).toEqual([adminGuard]);
  });
});
