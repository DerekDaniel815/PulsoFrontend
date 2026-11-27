import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { SessionStore } from '../../core/auth/session-store';
import { UserDeviceAssignment, UserDevicesApi } from '../../core/devices/user-devices-api';
import { EmergenciesApi, EmergencyResponse } from '../../core/emergencies/emergencies-api';
import { LocationsStore } from '../../core/locations/locations-store';
import { ActiveEmergency, OverviewStore } from '../../core/overview/overview-store';
import { EmergencyControls } from './emergency-controls';

describe('EmergencyControls', () => {
  let fixture: ComponentFixture<EmergencyControls>;
  const user = signal({ idUsuario: 1, rol: 'USUARIO' });
  const isAuthenticated = signal(true);
  const token = signal('jwt');
  const active = signal<ActiveEmergency[]>([]);
  const gps: UserDeviceAssignment = {
    idUsuarioDispositivo: 9, alias: 'GPS casa', estado: true, fechaDesvinculacion: null,
    ubicacionActiva: true, visibilidadPreferida: 'SOLO_YO',
  };
  const emergency: EmergencyResponse = {
    idEmergencia: '123', idUsuarioDispositivo: 9, codigoPublico: 'EME-ABC',
    estado: 'ACTIVA', activadaDesde: 'WEB', descripcion: 'Ayuda',
    fechaInicio: '2026-11-27T14:00:00Z',
  };
  let assignments: UserDeviceAssignment[];
  const devicesApi = { list: vi.fn<() => Observable<UserDeviceAssignment[]>>() };
  const api = {
    activate: vi.fn<(id: number, description?: string) => Observable<EmergencyResponse>>(),
    finish: vi.fn<(id: string) => Observable<EmergencyResponse>>(),
  };
  const overview = { emergencies: active, refresh: vi.fn(() => Promise.resolve()) };
  const locations = { refresh: vi.fn(() => Promise.resolve()) };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    isAuthenticated.set(true);
    token.set('jwt');
    user.set({ idUsuario: 1, rol: 'USUARIO' });
    active.set([]);
    assignments = [gps, { ...gps, idUsuarioDispositivo: 10, alias: 'Viejo', estado: false }];
    devicesApi.list.mockImplementation(() => of(assignments));
    api.activate.mockImplementation(() => of(emergency));
    api.finish.mockImplementation(() => of({ ...emergency, estado: 'FINALIZADA' }));
    await TestBed.configureTestingModule({
      imports: [EmergencyControls],
      providers: [
        provideRouter([]),
        { provide: SessionStore, useValue: { user, isAuthenticated, token } },
        { provide: UserDevicesApi, useValue: devicesApi },
        { provide: EmergenciesApi, useValue: api },
        { provide: OverviewStore, useValue: overview },
        { provide: LocationsStore, useValue: locations },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EmergencyControls);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => vi.restoreAllMocks());

  it('only offers active own GPS assignments for starting an emergency', () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.options).toHaveLength(2);
    expect(select.textContent).toContain('GPS casa');
    expect(select.textContent).not.toContain('Viejo');
    expect(fixture.nativeElement.textContent).toContain('última ubicación disponible');
  });

  it('limits the optional description to 300 characters and shows the count', () => {
    const description = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    expect(description.maxLength).toBe(300);
    expect(description.getAttribute('aria-describedby')).toBe('emergency-description-count');
    description.value = 'a'.repeat(300);
    description.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.description-count').textContent).toContain('300/300');

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '9';
    select.dispatchEvent(new Event('change'));
    description.value = 'a'.repeat(301);
    description.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('.activate-form button') as HTMLButtonElement).disabled).toBe(true);
    (fixture.nativeElement.querySelector('.activate-form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
    expect(api.activate).not.toHaveBeenCalled();
  });

  it('activates once after confirmation with trimmed description and refreshes views', async () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '9';
    select.dispatchEvent(new Event('change'));
    const description = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    description.value = ' Ayuda ';
    description.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('.activate-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.activate).toHaveBeenCalledExactlyOnceWith(9, 'Ayuda');
    expect(overview.refresh).toHaveBeenCalled();
    expect(locations.refresh).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="status"].emergency-notice').textContent).toContain('Emergencia activada');
  });

  it('does not activate when confirmation is cancelled', () => {
    vi.mocked(globalThis.confirm).mockReturnValueOnce(false);
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '9';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.activate-form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
    expect(api.activate).not.toHaveBeenCalled();
  });

  it('explains conflict and reloads visible emergencies', async () => {
    api.activate.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409 })));
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '9';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.activate-form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('ya tiene una emergencia activa');
    expect(overview.refresh).toHaveBeenCalled();
  });

  it('shows finish only for emergencies associated with own assignments', () => {
    active.set([emergency, { ...emergency, idEmergencia: '456', idUsuarioDispositivo: 99 }]);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.own-emergencies button') as NodeListOf<HTMLButtonElement>;
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('aria-label')).toContain('GPS casa');
    expect(fixture.nativeElement.querySelector('.own-emergencies').textContent).not.toContain('99');
  });

  it('finishes a decimal-string BigInt ID and returns focus to the heading', async () => {
    active.set([emergency]);
    overview.refresh.mockImplementationOnce(async () => { active.set([]); });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.own-emergencies button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.finish).toHaveBeenCalledExactlyOnceWith('123');
    expect(fixture.nativeElement.querySelector('.own-emergencies')).toBeNull();
    expect(fixture.nativeElement.querySelector('.emergency-notice').textContent).toContain('finalizada');
    expect(document.activeElement?.id).toBe('emergency-controls-title');
  });

  it('keeps the emergency active when finishing is cancelled', () => {
    active.set([emergency]);
    fixture.detectChanges();
    vi.mocked(globalThis.confirm).mockReturnValueOnce(false);
    (fixture.nativeElement.querySelector('.own-emergencies button') as HTMLButtonElement).click();
    expect(api.finish).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.own-emergencies')).toBeTruthy();
  });

  it('explains a forbidden finish and refreshes ownership from the server', async () => {
    active.set([emergency]);
    fixture.detectChanges();
    api.finish.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));
    (fixture.nativeElement.querySelector('.own-emergencies button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Solo el propietario');
    expect(overview.refresh).toHaveBeenCalled();
  });

  it('rejects invalid or unsafe identifiers instead of risking the wrong emergency', () => {
    active.set([{ ...emergency, idEmergencia: '9007199254740993' }]);
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('.own-emergencies button') as HTMLButtonElement).disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.id-warning').textContent).toContain('identificador no válido');
    expect(api.finish).not.toHaveBeenCalled();
  });

  it('does not offer controls to administrators', async () => {
    user.set({ idUsuario: 1, rol: 'ADMIN' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.activate-form')).toBeNull();
    expect(fixture.nativeElement.querySelector('.own-emergencies')).toBeNull();
  });

  it('clears old account emergencies and assignments on account switch', async () => {
    active.set([emergency]);
    fixture.detectChanges();
    user.set({ idUsuario: 2, rol: 'USUARIO' });
    assignments = [];
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.own-emergencies')).toBeNull();
    expect(fixture.nativeElement.querySelector('.activate-form')).toBeNull();
  });
});
