import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { SessionStore } from '../../core/auth/session-store';
import { UserDeviceAssignment, UserDevicesApi } from '../../core/devices/user-devices-api';
import { LocationsStore } from '../../core/locations/locations-store';
import { OverviewStore } from '../../core/overview/overview-store';
import { Configuracion } from './configuracion';

describe('Configuracion', () => {
  let fixture: ComponentFixture<Configuracion>;
  const user = {
    idUsuario: 1, nombres: 'Ana', apellidos: 'López', correo: 'ana@example.com',
    telefono: null, rol: 'USUARIO' as const, estado: true, fechaRegistro: '', fechaActualizacion: '',
  };
  const assignment: UserDeviceAssignment = {
    idUsuarioDispositivo: 9, alias: 'Mi GPS', ubicacionActiva: true,
    visibilidadPreferida: 'SOLO_YO', estado: true, fechaDesvinculacion: null,
    dispositivo: { codigoDispositivo: 'PUL-00000009' },
  };
  let devices: UserDeviceAssignment[];
  const http = { patch: vi.fn(() => of({ ...user, nombres: 'Ana María' })) };
  const api = {
    list: vi.fn<() => Observable<UserDeviceAssignment[]>>(),
    link: vi.fn(() => of(assignment)),
    update: vi.fn<(_id: number, change: Partial<UserDeviceAssignment>) => Observable<UserDeviceAssignment>>(),
    unlink: vi.fn(() => of({ ...assignment, estado: false, fechaDesvinculacion: '2026-11-27T00:00:00Z' })),
  };
  const locations = { refresh: vi.fn(() => Promise.resolve()) };
  const overview = { refresh: vi.fn(() => Promise.resolve()) };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    devices = [assignment, { ...assignment, idUsuarioDispositivo: 4, alias: 'Antiguo', estado: false,
      fechaDesvinculacion: '2026-01-01T00:00:00Z' }];
    api.list.mockImplementation(() => of(devices));
    api.link.mockImplementation(() => of({ ...assignment, idUsuarioDispositivo: 10, alias: 'Nuevo',
      dispositivo: { codigoDispositivo: 'PUL-00000010' } }));
    api.update.mockImplementation((_id, change) => of({ ...assignment, ...change }));
    api.unlink.mockImplementation(() => of({ ...assignment, estado: false,
      fechaDesvinculacion: '2026-11-27T00:00:00Z' }));
    await TestBed.configureTestingModule({ imports: [Configuracion], providers: [
      provideRouter([]),
      { provide: HttpClient, useValue: http },
      { provide: UserDevicesApi, useValue: api },
      { provide: LocationsStore, useValue: locations },
      { provide: OverviewStore, useValue: overview },
      SessionStore,
    ] }).compileComponents();
    TestBed.inject(SessionStore).establish({ accessToken: 'jwt', user });
    fixture = TestBed.createComponent(Configuracion);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows the authenticated profile and separates active devices from historical ones', () => {
    expect(fixture.nativeElement.textContent).toContain('Ana López');
    expect(fixture.nativeElement.querySelectorAll('.device-row')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.past-devices').textContent).toContain('Antiguo');
    expect(fixture.nativeElement.querySelectorAll('.unlink-button')).toHaveLength(1);
  });

  it('updates the profile via PATCH /users/me', async () => {
    (fixture.nativeElement.querySelector('.profile-card .secondary-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.profile-card button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(http.patch).toHaveBeenCalledWith(expect.stringContaining('/users/me'), expect.objectContaining({ nombres: 'Ana' }));
    expect(fixture.nativeElement.textContent).toContain('Ana María');
  });

  it('links by code and optional alias once, then reloads devices and location views', async () => {
    const [code, alias] = fixture.nativeElement.querySelectorAll('.link-fields input') as NodeListOf<HTMLInputElement>;
    code.value = ' pul-00000010 ';
    code.dispatchEvent(new Event('input'));
    alias.value = ' Nuevo ';
    alias.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const submit = fixture.nativeElement.querySelector('.link-device button[type="submit"]') as HTMLButtonElement;
    submit.click();
    submit.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.link).toHaveBeenCalledExactlyOnceWith({ codigoDispositivo: 'PUL-00000010', alias: 'Nuevo' });
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(locations.refresh).toHaveBeenCalled();
    expect(overview.refresh).toHaveBeenCalled();
    expect(code.value).toBe('');
    expect(fixture.nativeElement.querySelector('[role="status"].action-feedback').textContent).toContain('GPS vinculado');
  });

  it.each([
    [404, 'No existe'],
    [400, 'DISPONIBLE'],
    [409, 'asignación activa'],
  ])('explains linking HTTP %i without clearing the code', async (status, message) => {
    api.link.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status })));
    const code = fixture.nativeElement.querySelector('.link-fields input') as HTMLInputElement;
    code.value = 'PUL-00000010';
    code.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.link-device button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(message);
    expect(code.value).toBe('PUL-00000010');
  });

  it('updates alias and excludes unlinked devices from controls while retaining history', async () => {
    (fixture.nativeElement.querySelector('.device-actions .secondary-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const alias = fixture.nativeElement.querySelector('.alias-form input') as HTMLInputElement;
    expect(document.activeElement).toBe(alias);
    alias.value = 'Casa';
    alias.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.alias-form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.update).toHaveBeenCalledWith(9, { alias: 'Casa' });
    expect(fixture.nativeElement.querySelector('.device-row').textContent).toContain('Casa');

    devices = [{ ...assignment, alias: 'Casa', estado: false, fechaDesvinculacion: '2026-11-27T00:00:00Z' }];
    (fixture.nativeElement.querySelector('.unlink-button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.unlink).toHaveBeenCalledExactlyOnceWith(9);
    expect(fixture.nativeElement.querySelectorAll('.device-row')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.past-devices').textContent).toContain('Casa');
    expect(document.activeElement?.id).toBe('devices-title');
    expect(locations.refresh).toHaveBeenCalled();
  });

  it('does not unlink when the user cancels the confirmation', () => {
    vi.mocked(globalThis.confirm).mockReturnValueOnce(false);
    (fixture.nativeElement.querySelector('.unlink-button') as HTMLButtonElement).click();
    expect(api.unlink).not.toHaveBeenCalled();
  });
});
