import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable, of, Subject, throwError } from 'rxjs';
import { SessionStore } from '../../core/auth/session-store';
import { LocationsStore, VisibleLocation } from '../../core/locations/locations-store';
import { OverviewStore } from '../../core/overview/overview-store';
import { ContactRecord } from '../../core/contacts/contacts-api';
import { Historial } from './historial';

describe('Historial', () => {
  let fixture: ComponentFixture<Historial>;
  const contacts = signal<ContactRecord[]>([]);
  const visible = signal<VisibleLocation[]>([]);
  const notificationVersion = signal(0);
  const authenticated = signal(true);
  const sharedSources = signal([{
    idUsuarioDispositivo: 2, idUsuario: 12, alias: 'GPS de Ana', codigoDispositivo: 'ANA',
  }]);
  const history = [{ idUbicacion: 'one', latitud: -12, longitud: -77,
    precisionGps: 5, fechaHoraDispositivo: '2026-10-20T09:00:00Z' }];
  const http = { get: vi.fn((_url: string, _options?: unknown): Observable<unknown> => of(history)) };

  const sharedLocation: VisibleLocation = {
    assignment: {
      idUsuarioDispositivo: 2, idUsuario: 12, alias: 'GPS de Ana',
      codigoDispositivo: 'ANA', visibilidadPreferida: 'SOLO_YO', ubicacionActiva: true,
    },
    location: { idUsuarioDispositivo: 2, latitud: -12, longitud: -77,
      fechaHoraDispositivo: '2026-10-20T09:00:00Z' },
    emergenciaActiva: false,
  };
  const contact: ContactRecord = {
    idUsuarioContacto: 4,
    contacto: { idUsuario: 12, nombres: 'Ana', apellidos: 'Ruiz' },
    estado: 'ACEPTADO', yoCompartoUbicacion: false, contactoComparteUbicacion: true,
    soySolicitante: false, fechaSolicitud: '',
  };

  beforeEach(async () => {
    contacts.set([contact]);
    visible.set([sharedLocation]);
    notificationVersion.set(0);
    sharedSources.set([{
      idUsuarioDispositivo: 2, idUsuario: 12, alias: 'GPS de Ana', codigoDispositivo: 'ANA',
    }]);
    authenticated.set(true);
    http.get.mockReset();
    http.get.mockImplementation((url: string) => of(url.endsWith('/user-devices/me')
      ? [{ idUsuarioDispositivo: 1, alias: 'GPS propio' }]
      : url.endsWith('/history-sources') ? sharedSources() : history));
    await TestBed.configureTestingModule({
      imports: [Historial],
      providers: [
        { provide: HttpClient, useValue: http },
        { provide: SessionStore, useValue: { isAuthenticated: authenticated } },
        { provide: LocationsStore, useValue: {
          locations: visible, notificationVersion, refresh: vi.fn().mockResolvedValue(undefined),
        } },
        { provide: OverviewStore, useValue: { contacts, refresh: vi.fn().mockResolvedValue(undefined) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Historial);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('offers owned and authorized shared devices, loading history for the selected person', async () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.options).toHaveLength(2);
    expect(select.options[0].textContent).toContain('GPS propio');
    expect(select.options[1].textContent).toContain('Ana Ruiz · GPS de Ana');
    expect(fixture.nativeElement.querySelectorAll('.timeline-panel li')).toHaveLength(1);

    select.value = '2';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/user-device/2/history'), expect.anything());
    expect(fixture.nativeElement.querySelector('#timeline-title').textContent).toContain('Ana Ruiz');
  });

  it('does not list a contact who has not authorized sharing', () => {
    contacts.set([{ ...contact, contactoComparteUbicacion: false }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select').options).toHaveLength(1);
  });

  it('clears a selected shared history when the contact revokes permission', async () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    contacts.set([{ ...contact, contactoComparteUbicacion: false }]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('select').options).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('#timeline-title').textContent).not.toContain('Ana Ruiz');
  });

  it('keeps shared history available when the GPS stops reporting', async () => {
    visible.set([]);
    await fixture.whenStable();
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.options[1].textContent).toContain('Ana Ruiz');

    select.value = '2';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/user-device/2/history'), expect.anything());
    expect(fixture.nativeElement.querySelector('.timeline-panel').textContent).toContain('-12, -77');
  });

  it('allows selecting an authorized contact when there are no owned devices', async () => {
    fixture.componentInstance['ownAssignments'].set([]);
    await fixture.whenStable();
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.options).toHaveLength(1);
    expect(select.value).toBe('2');
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/user-device/2/history'), expect.anything());
  });

  it('removes shared history when the server revokes access', async () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();
    sharedSources.set([]);
    await fixture.componentInstance['refreshSources']();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select').options).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('#timeline-title').textContent).not.toContain('Ana Ruiz');
    expect(fixture.componentInstance['points']()).toEqual(history);
  });

  it('does not restore a revoked location from an in-flight response', async () => {
    const pending = new Subject<typeof history>();
    http.get.mockImplementation((url: string) => url.includes('/user-device/2/history')
      ? pending.asObservable()
      : of(url.endsWith('/user-devices/me')
        ? [{ idUsuarioDispositivo: 1, alias: 'GPS propio' }]
        : url.endsWith('/history-sources') ? sharedSources() : history));
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    sharedSources.set([]);
    await fixture.componentInstance['refreshSources']();
    fixture.detectChanges();
    pending.next(history);
    pending.complete();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#timeline-title').textContent).not.toContain('Ana Ruiz');
  });

  it('shows a permission message instead of history when the server refuses access', async () => {
    http.get.mockImplementation((url: string) => url.includes('/user-device/2/history')
      ? throwError(() => new HttpErrorResponse({ status: 403 }))
      : of(url.endsWith('/user-devices/me')
        ? [{ idUsuarioDispositivo: 1, alias: 'GPS propio' }]
        : url.endsWith('/history-sources') ? sharedSources() : history));
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('no autoriza');
    expect(fixture.nativeElement.querySelector('.export-button').disabled).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.timeline-panel li')).toHaveLength(0);
  });

  it('falls back to visible locations only when the new endpoint does not exist yet', async () => {
    http.get.mockImplementation((url: string) => url.endsWith('/history-sources')
      ? throwError(() => new HttpErrorResponse({ status: 404 }))
      : of(url.endsWith('/user-devices/me')
        ? [{ idUsuarioDispositivo: 1, alias: 'GPS propio' }] : history));
    await fixture.componentInstance['refreshSources']();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select').options).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('El servidor aún no permite listar GPS compartidos');
    visible.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select').options).toHaveLength(1);
  });

  it('does not fall back to possibly revoked locations when the server denies the list', async () => {
    http.get.mockImplementation((url: string) => url.endsWith('/history-sources')
      ? throwError(() => new HttpErrorResponse({ status: 403 }))
      : of(url.endsWith('/user-devices/me')
        ? [{ idUsuarioDispositivo: 1, alias: 'GPS propio' }] : history));
    await fixture.componentInstance['refreshSources']();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select').options).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('comprobar los dispositivos');
  });

  it('refreshes authorized history sources after a permission notification', async () => {
    const previousCalls = http.get.mock.calls.filter(([url]) => url.endsWith('/history-sources')).length;
    sharedSources.set([]);
    notificationVersion.update((version) => version + 1);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(http.get.mock.calls.filter(([url]) => url.endsWith('/history-sources'))).toHaveLength(previousCalls + 1);
    expect(fixture.nativeElement.querySelector('select').options).toHaveLength(1);
  });

  it('clears the history when the session ends', async () => {
    authenticated.set(false);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
    expect(fixture.componentInstance['points']()).toEqual([]);
  });

  it('centers the empty-history message without changing the populated timeline', () => {
    expect(fixture.nativeElement.querySelector('.timeline-panel ol.is-empty')).toBeNull();
    fixture.componentInstance['points'].set([]);
    fixture.detectChanges();
    const emptyList = fixture.nativeElement.querySelector('.timeline-panel ol.is-empty') as HTMLOListElement;
    expect(emptyList).not.toBeNull();
    expect(emptyList.querySelector('.empty-message')?.textContent).toContain(
      'No hay ubicaciones registradas en este periodo.',
    );
  });

  it('paginates only the timeline and keeps the full route and summary', () => {
    const points = Array.from({ length: 9 }, (_, i) => ({
      ...history[0], idUbicacion: `point-${i}`, latitud: -12 + i,
    }));
    fixture.componentInstance['points'].set(points);
    fixture.detectChanges();

    const rows = () => fixture.nativeElement.querySelectorAll('.timeline-panel ol li') as NodeListOf<HTMLLIElement>;
    const buttons = () => fixture.nativeElement.querySelectorAll('.timeline-pagination button') as NodeListOf<HTMLButtonElement>;
    expect(rows()).toHaveLength(4);
    expect(rows()[0].textContent).toContain('-12, -77');
    expect(fixture.nativeElement.querySelector('.route-map figcaption').textContent).toContain('9 puntos');
    expect(fixture.nativeElement.querySelector('.metrics').textContent).toContain('9');
    expect(buttons()[0].disabled).toBe(true);

    buttons()[1].click();
    fixture.detectChanges();
    expect(rows()).toHaveLength(4);
    expect(rows()[0].textContent).toContain('-8, -77');
    expect(fixture.nativeElement.querySelector('.timeline-pagination span').textContent).toContain('Página 2 de 3');
    buttons()[1].click();
    fixture.detectChanges();
    expect(rows()).toHaveLength(1);
    expect(buttons()[1].disabled).toBe(true);

    fixture.componentInstance['selectPeriod']('week');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.timeline-pagination')).toBeNull();
  });

  it('fetches a new period when selected', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.period-filters button');
    const previousCalls = http.get.mock.calls.length;
    buttons[1].click();
    fixture.detectChanges();
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(http.get).toHaveBeenCalledTimes(previousCalls + 1);
  });
});
