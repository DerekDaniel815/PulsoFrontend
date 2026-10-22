import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SessionStore } from '../../core/auth/session-store';
import { VisibleLocation, LocationsStore } from '../../core/locations/locations-store';
import { GoogleMapsLoader } from '../../core/maps/google-maps.loader';
import { LiveMap } from './live-map';

describe('LiveMap for a selected contact', () => {
  const visible = signal<VisibleLocation[]>([]);

  beforeEach(async () => {
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
        { provide: SessionStore, useValue: { isAuthenticated: signal(true) } },
        { provide: LocationsStore, useValue: { locations: visible, error: signal(null) } },
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
});
