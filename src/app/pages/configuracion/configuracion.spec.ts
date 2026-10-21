import { HttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SessionStore } from '../../core/auth/session-store';
import { Configuracion } from './configuracion';

describe('Configuracion', () => {
  let fixture: ComponentFixture<Configuracion>;
  const user = {
    idUsuario: 1, nombres: 'Ana', apellidos: 'López', correo: 'ana@example.com',
    telefono: null, rol: 'USUARIO' as const, estado: true, fechaRegistro: '', fechaActualizacion: '',
  };
  const http = { patch: vi.fn(() => of({ ...user, nombres: 'Ana María' })) };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Configuracion], providers: [
      { provide: HttpClient, useValue: http }, SessionStore,
    ] }).compileComponents();
    TestBed.inject(SessionStore).setUser(user);
    fixture = TestBed.createComponent(Configuracion);
    fixture.detectChanges();
  });

  it('shows the authenticated profile', () => {
    expect(fixture.nativeElement.textContent).toContain('Ana López');
  });

  it('updates the profile via PATCH /users/me', async () => {
    (fixture.nativeElement.querySelector('.secondary-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(http.patch).toHaveBeenCalledWith(expect.stringContaining('/users/me'), expect.objectContaining({ nombres: 'Ana' }));
    expect(fixture.nativeElement.textContent).toContain('Ana María');
  });
});
