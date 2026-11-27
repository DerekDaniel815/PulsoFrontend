import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthDialogService } from './auth-dialog.service';
import { AuthDialog } from './auth-dialog';
import { PulsoUser } from './auth.models';
import { AuthSession } from './auth-session';
import { SessionStore } from './session-store';

const USER: PulsoUser = {
  idUsuario: 1, nombres: 'Ana', apellidos: 'Ruiz',
  correo: 'ana@example.com', rol: 'USUARIO', estado: true,
  fechaRegistro: '', fechaActualizacion: '',
};

describe('AuthDialog post-login navigation', () => {
  const user = signal<PulsoUser | null>(USER);
  let router: Router;
  let dialog: AuthDialogService;

  beforeEach(async () => {
    user.set(USER);
    await TestBed.configureTestingModule({
      imports: [AuthDialog],
      providers: [
        provideRouter([]),
        { provide: AuthSession, useValue: {} },
        { provide: SessionStore, useValue: { user } },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    dialog = TestBed.inject(AuthDialogService);
  });

  it('sends ADMIN to inventory even if authentication began on another route', async () => {
    user.set({ ...USER, rol: 'ADMIN' });
    const fixture = TestBed.createComponent(AuthDialog);
    fixture.detectChanges();
    dialog.open('login', '/mapa');

    await fixture.componentInstance['finishAuthentication']();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/inventario');
  });

  it('preserves the requested route for a regular user', async () => {
    const fixture = TestBed.createComponent(AuthDialog);
    fixture.detectChanges();
    dialog.open('login', '/contactos');

    await fixture.componentInstance['finishAuthentication']();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/contactos');
  });
});
