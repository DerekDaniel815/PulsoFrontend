import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SessionStore } from '../../core/auth/session-store';
import { ContactRecord } from '../../core/contacts/contacts-api';
import { VisibleLocation, LocationsStore } from '../../core/locations/locations-store';
import { GoogleMapsLoader } from '../../core/maps/google-maps.loader';
import { OverviewStore } from '../../core/overview/overview-store';
import { LiveMap } from './live-map';

describe('LiveMap for a selected contact', () => {
  const visible = signal<VisibleLocation[]>([]);
  const contacts = signal<ContactRecord[]>([]);

  beforeEach(async () => {
    contacts.set([{
      idUsuarioContacto: 3,
      contacto: { idUsuario: 12, nombres: 'Ana', apellidos: 'Ruiz' },
      estado: 'ACEPTADO',
      yoCompartoUbicacion: false,
      contactoComparteUbicacion: true,
      soySolicitante: false,
      fechaSolicitud: '',
    }]);
    visible.set([
      { assignment: { idUsuarioDispositivo: 1, idUsuario: 12, alias: 'Ana', codigoDispositivo: 'A', visibilidadPreferida: '', ubicacionActiva: true }, location: { idUsuarioDispositivo: 1, latitud: 40.5, longitud: -3.7, fechaHoraDispositivo: '' }, emergenciaActiva: false },
      { assignment: { idUsuarioDispositivo: 2, idUsuario: 30, alias: 'Otro', codigoDispositivo: 'B', visibilidadPreferida: '', ubicacionActiva: true }, location: { idUsuarioDispositivo: 2, latitud: 41, longitud: -4, fechaHoraDispositivo: '' }, emergenciaActiva: false },
    ]);
    vi.stubGlobal('google', {
      maps: {
        ControlPosition: { LEFT_BOTTOM: 1, RIGHT_BOTTOM: 2 },
        Size: class { constructor(_width: number, _height: number) {} },
        Point: class { constructor(_x: number, _y: number) {} },
        LatLngBounds: class {
          extend = vi.fn();
        },
      },
    });
    await TestBed.configureTestingModule({
      imports: [LiveMap],
      providers: [
        provideHttpClient(),
        { provide: GoogleMapsLoader, useValue: { load: () => new Promise<void>(() => {}) } },
        { provide: SessionStore, useValue: {
          isAuthenticated: signal(true),
          user: signal({ idUsuario: 50, nombres: 'Lucía', apellidos: 'García' }),
        } },
        { provide: LocationsStore, useValue: { locations: visible, error: signal(null) } },
        { provide: OverviewStore, useValue: { contacts } },
      ],
    }).overrideComponent(LiveMap, { set: { template: '', imports: [] } }).compileComponents();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows only the authorized contact and the real own position, fitting both in the viewport', () => {
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentRef.setInput('selectedUserId', 12);
    fixture.componentInstance['ready'].set(true);
    fixture.componentInstance['ownPosition'].set({ lat: 40.4, lng: -3.6 });
    fixture.componentInstance['locating'].set(false);
    fixture.detectChanges();

    expect(fixture.componentInstance['markers']().map((marker) => marker.id)).toEqual(['tu', '1']);
    const map = { setCenter: vi.fn(), setZoom: vi.fn(), fitBounds: vi.fn() };
    fixture.componentInstance['onMapInitialized'](map as unknown as google.maps.Map);
    expect(map.fitBounds).toHaveBeenCalledOnce();
    expect(map.fitBounds.mock.calls[0][0].extend).toHaveBeenCalledTimes(2);
  });

  it('does not fabricate the own marker when geolocation is unavailable', () => {
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentRef.setInput('selectedUserId', 12);
    fixture.componentInstance['ready'].set(true);
    fixture.componentInstance['locating'].set(false);
    fixture.detectChanges();

    expect(fixture.componentInstance['markers']().map((marker) => marker.id)).toEqual(['1']);
  });

  it('centers on the contact first and fits both when own geolocation arrives', () => {
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentRef.setInput('selectedUserId', 12);
    fixture.componentInstance['ready'].set(true);
    fixture.detectChanges();
    const map = { setCenter: vi.fn(), setZoom: vi.fn(), fitBounds: vi.fn() };
    fixture.componentInstance['onMapInitialized'](map as unknown as google.maps.Map);
    expect(map.setCenter).toHaveBeenCalledWith({ lat: 40.5, lng: -3.7 });

    fixture.componentInstance['ownPosition'].set({ lat: 40.4, lng: -3.6 });
    fixture.componentInstance['locating'].set(false);
    fixture.detectChanges();
    expect(map.fitBounds).toHaveBeenCalledOnce();
  });

  it('does not show another contact when the selected user has no visible location', () => {
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentRef.setInput('selectedUserId', 99);
    fixture.componentInstance['ready'].set(true);
    fixture.componentInstance['ownPosition'].set({ lat: 40.4, lng: -3.6 });
    fixture.detectChanges();

    expect(fixture.componentInstance['markers']().map((marker) => marker.id)).toEqual(['tu']);
  });

  it('waits for the device location instead of showing Spain, then starts centered on the contact', () => {
    const authorized = visible()[0];
    visible.set([]);
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentRef.setInput('selectedUserId', 12);
    fixture.componentInstance['ready'].set(true);
    fixture.detectChanges();

    expect(fixture.componentInstance['canShowMap']()).toBe(false);
    visible.set([authorized]);
    fixture.detectChanges();

    expect(fixture.componentInstance['canShowMap']()).toBe(true);
    expect(fixture.componentInstance['center']()).toEqual({ lat: 40.5, lng: -3.7 });
    expect(fixture.componentInstance['markers']().map((marker) => marker.id)).toEqual(['1']);
  });

  it('labels authorized markers with contact initials and updates selected details', () => {
    visible.update((items) => [{
      ...items[0],
      location: { ...items[0].location, fechaHoraDispositivo: '2026-10-26T12:00:00Z' },
    }, items[1]]);
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.detectChanges();

    const marker = fixture.componentInstance['markers']()[0];
    expect(marker.title).toBe('Ana Ruiz');
    expect(decodeURIComponent((marker.options.icon as google.maps.Icon).url)).toContain('>AR</text>');
    fixture.componentInstance['selectMarker'](marker);
    fixture.componentInstance['now'].set(Date.parse('2026-10-26T12:03:00Z'));
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedMarker']()?.title).toBe('Ana Ruiz');
    expect(fixture.componentInstance['relativeTime'](marker.updatedAt)).toBe('Hace 3 minutos');

    visible.update((items) => [{
      ...items[0], location: { ...items[0].location, fechaHoraDispositivo: '2026-10-26T12:02:00Z' },
    }, items[1]]);
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedMarker']()?.updatedAt).toBe('2026-10-26T12:02:00Z');

    visible.set([visible()[1]]);
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedMarker']()).toBeNull();
  });

  it('does not expose a name for an authorized group member without a contact record', () => {
    contacts.set([]);
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.detectChanges();
    expect(fixture.componentInstance['markers']()[0].title).toBe('Dispositivo autorizado');
  });
});
