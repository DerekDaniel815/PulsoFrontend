import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, provideRouter } from '@angular/router';
import { AuthDialog } from '../core/auth/auth-dialog';
import { AuthSession } from '../core/auth/auth-session';
import { PulsoUser } from '../core/auth/auth.models';
import { SessionStore } from '../core/auth/session-store';
import { LocationsStore } from '../core/locations/locations-store';
import { OverviewStore } from '../core/overview/overview-store';
import { Shell } from './shell';

@Component({ selector: 'app-auth-dialog', template: '' })
class DialogStub {}

@Component({ template: '' })
class PageStub {}

const ADMIN: PulsoUser = {
  idUsuario: 1, nombres: 'Ana', apellidos: 'Ruiz',
  correo: 'ana@example.com', rol: 'ADMIN', estado: true,
  fechaRegistro: '', fechaActualizacion: '',
};

describe('Shell navigation by role', () => {
  const user = signal<PulsoUser | null>(ADMIN);
  const token = signal<string | null>('test-token');

  beforeEach(async () => {
    user.set(ADMIN);
    token.set('test-token');
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([
          { path: 'dashboard', component: PageStub },
          { path: 'inventario', component: PageStub },
          { path: 'historial', component: PageStub },
          { path: 'configuracion', component: PageStub },
          { path: 'alertas', component: PageStub },
        ]),
        { provide: AuthSession, useValue: { logout: vi.fn() } },
        { provide: SessionStore, useValue: {
          user, token, isAuthenticated: computed(() => !!user() && !!token()),
        } },
        { provide: LocationsStore, useValue: { connected: signal(false) } },
        { provide: OverviewStore, useValue: { unreadCount: signal(0) } },
      ],
    }).overrideComponent(Shell, {
      set: { imports: [RouterOutlet, RouterLink, RouterLinkActive, DialogStub] },
    }).compileComponents();
  });

  it('shows only inventory and logout to an authenticated ADMIN', async () => {
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const links = Array.from(fixture.nativeElement.querySelectorAll('.nav-link')) as HTMLAnchorElement[];

    expect(links.map((link) => link.textContent?.trim())).toEqual(['Inventario']);
    expect(fixture.nativeElement.querySelector('[aria-label="Notificaciones"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Mapa en directo');
    expect(fixture.nativeElement.querySelector('[aria-label="Cerrar sesión"]')).not.toBeNull();
    expect(TestBed.inject(Router).url).toBe('/inventario');
  });

  it('removes inventory and safe zones from a regular user menu', async () => {
    user.set({ ...ADMIN, rol: 'USUARIO' });
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.nav-link'))
      .map((link) => (link as HTMLAnchorElement).textContent?.trim());

    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Mapa');
    expect(labels).not.toContain('Inventario');
    expect(labels).not.toContain('Zonas Seguras');
  });

  it('scrolls each long section inside the shell while Dashboard uses its own layout', async () => {
    user.set({ ...ADMIN, rol: 'USUARIO' });
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.shell').classList.contains('is-dashboard')).toBe(true);
    expect(fixture.nativeElement.querySelector('.shell').classList.contains('is-compact-page')).toBe(false);

    for (const path of ['/historial', '/configuracion', '/alertas']) {
      await router.navigateByUrl(path);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.shell').classList.contains('is-dashboard')).toBe(false);
      expect(fixture.nativeElement.querySelector('.shell').classList.contains('is-compact-page'))
        .toBe(path !== '/configuracion');
      expect(getComputedStyle(fixture.nativeElement.querySelector('main.content')).overflow).toBe('auto');
    }

    user.set(ADMIN);
    await router.navigateByUrl('/inventario');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.shell').classList.contains('is-dashboard')).toBe(false);
    expect(fixture.nativeElement.querySelector('.shell').classList.contains('is-inventory')).toBe(true);
    expect(getComputedStyle(fixture.nativeElement.querySelector('.shell')).overflow).toBe('hidden');
  });
});
