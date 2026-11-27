import { provideHttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, input, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SessionStore } from '../../core/auth/session-store';
import { ContactRecord } from '../../core/contacts/contacts-api';
import { VisibleLocation, LocationsStore } from '../../core/locations/locations-store';
import { GoogleMapsLoader } from '../../core/maps/google-maps.loader';
import { ActiveEmergency, OverviewStore } from '../../core/overview/overview-store';
import { LiveMap } from './live-map';

@Component({ selector: 'google-map', template: '<ng-content />' })
class GoogleMapStub {
  readonly height = input('');
  readonly width = input('');
  readonly center = input<google.maps.LatLngLiteral>();
  readonly zoom = input(0);
  readonly options = input<google.maps.MapOptions>();
  readonly mapInitialized = output<google.maps.Map>();
}

@Component({ selector: 'map-marker', template: '' })
class MapMarkerStub {
  readonly position = input<google.maps.LatLngLiteral>();
  readonly title = input('');
  readonly options = input<google.maps.MarkerOptions>();
  readonly mapClick = output<void>();
  readonly mapMouseover = output<google.maps.MapMouseEvent>();
  readonly mapMouseout = output<google.maps.MapMouseEvent>();
}

class OverlayViewStub {
  static pixel = { x: 200, y: 150 };
  onAdd(): void {}
  draw(): void {}
  onRemove(): void {}
  getProjection() {
    return { fromLatLngToContainerPixel: () => OverlayViewStub.pixel };
  }
  setMap(map: google.maps.Map | null): void {
    if (map) {
      this.onAdd();
      this.draw();
    } else this.onRemove();
  }
}

describe('LiveMap for a selected contact', () => {
  const visible = signal<VisibleLocation[]>([]);
  const contacts = signal<ContactRecord[]>([]);
  const emergencies = signal<ActiveEmergency[]>([]);
  const revokedAssignments = signal<ReadonlySet<number>>(new Set());

  beforeEach(async () => {
    emergencies.set([]);
    revokedAssignments.set(new Set());
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
        OverlayView: OverlayViewStub,
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
        { provide: LocationsStore, useValue: { locations: visible, revokedAssignments, error: signal(null) } },
        { provide: OverviewStore, useValue: { contacts, emergencies } },
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
    fixture.componentInstance['toggleMarkerDetails'](marker.id);
    expect(fixture.componentInstance['expandedMarkerId']()).toBe(marker.id);

    visible.update((items) => [{
      ...items[0], location: { ...items[0].location, fechaHoraDispositivo: '2026-10-26T12:02:00Z' },
    }, items[1]]);
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedMarker']()?.updatedAt).toBe('2026-10-26T12:02:00Z');

    visible.set([visible()[1]]);
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedMarker']()).toBeNull();
    expect(fixture.componentInstance['expandedMarkerId']()).toBeNull();
  });

  it('does not expose a name for an authorized group member without a contact record', () => {
    contacts.set([]);
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.detectChanges();
    expect(fixture.componentInstance['markers']()[0].title).toBe('Dispositivo autorizado');
  });

  it('removes a hover preview immediately when the location is no longer authorized', () => {
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.detectChanges();
    fixture.componentInstance['showMarkerPreview'](fixture.componentInstance['markers']()[0]);
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedMarker']()?.id).toBe('1');

    visible.set([visible()[1]]);
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedMarker']()).toBeNull();
    expect(fixture.componentInstance['hoveredMarkerId']()).toBeNull();
  });

  it('restores the last authorized emergency position after a new page load with no live GPS', () => {
    visible.set([]);
    emergencies.set([{
      idEmergencia: 'sos-1', idUsuarioDispositivo: 1, estado: 'ACTIVA',
      fechaInicio: '2026-11-19T12:00:00Z', descripcion: null,
      ubicacion: {
        idUsuarioDispositivo: 1, latitud: 40.5, longitud: -3.7,
        fechaHoraDispositivo: '2026-11-19T12:03:00Z', isLive: true,
      },
      fechaUltimaUbicacion: '2026-11-19T12:03:00Z',
    }]);
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.detectChanges();

    const [marker] = fixture.componentInstance['markers']();
    expect(marker.position).toEqual({ lat: 40.5, lng: -3.7 });
    expect(fixture.componentInstance['center']()).toEqual(marker.position);
    expect(marker.title).toBe('Emergencia autorizada');
    expect(marker.emergencyActive).toBe(true);
    expect(marker.observation?.isLive).toBe(false);
    expect(marker.updatedAt).toBe('2026-11-19T12:03:00Z');
    expect(fixture.componentInstance['freshness'](marker.observation!))
      .toContain('Última ubicación conocida');
    fixture.destroy();

    const reopened = TestBed.createComponent(LiveMap);
    reopened.componentInstance['ready'].set(true);
    reopened.detectChanges();
    expect(reopened.componentInstance['markers']()[0].position).toEqual(marker.position);
    emergencies.set([]);
    reopened.detectChanges();
    expect(reopened.componentInstance['markers']()).toEqual([]);
  });

  it('does not attribute an emergency with no verified assignment to a selected person', () => {
    visible.set([]);
    emergencies.set([{
      idEmergencia: 'sos-2', idUsuarioDispositivo: 1, estado: 'ACTIVA',
      fechaInicio: '2026-11-19T12:00:00Z', descripcion: null,
      ubicacion: {
        idUsuarioDispositivo: 1, latitud: 40.5, longitud: -3.7,
        fechaHoraDispositivo: '2026-11-19T12:03:00Z',
      },
    }]);
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentRef.setInput('selectedUserId', 99);
    fixture.componentInstance['ready'].set(true);
    fixture.detectChanges();
    expect(fixture.componentInstance['canShowMap']()).toBe(false);
    expect(fixture.componentInstance['markers']()).toEqual([]);
  });

  it('does not invent a location when an active emergency has no recorded coordinate', () => {
    visible.set([]);
    emergencies.set([{
      idEmergencia: 'sos-no-position', idUsuarioDispositivo: 1, estado: 'ACTIVA',
      fechaInicio: '2026-11-19T12:00:00Z', descripcion: null, ubicacion: null,
    }]);
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.detectChanges();
    expect(fixture.componentInstance['markers']()).toEqual([]);
  });

  it('does not duplicate an emergency marker when the last location is already visible', () => {
    emergencies.set([{
      idEmergencia: 'sos-3', idUsuarioDispositivo: 1, estado: 'ACTIVA',
      fechaInicio: '2026-11-19T12:00:00Z', descripcion: null,
      ubicacion: {
        idUsuarioDispositivo: 1, latitud: 40.5, longitud: -3.7,
        fechaHoraDispositivo: '2026-11-19T12:03:00Z',
      },
    }]);
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.detectChanges();
    expect(fixture.componentInstance['markers']().map((marker) => marker.id)).toEqual(['1', '2']);
    expect(fixture.componentInstance['markers']()[0].emergencyActive).toBe(true);
  });

  it('hides an emergency fallback immediately when its assignment access is revoked', () => {
    visible.set([]);
    emergencies.set([{
      idEmergencia: 'sos-revoked', idUsuarioDispositivo: 1, estado: 'ACTIVA',
      fechaInicio: '2026-11-19T12:00:00Z', descripcion: null,
      ubicacion: {
        idUsuarioDispositivo: 1, latitud: 40.5, longitud: -3.7,
        fechaHoraDispositivo: '2026-11-19T12:03:00Z',
      },
    }]);
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.detectChanges();
    expect(fixture.componentInstance['markers']()).toHaveLength(1);
    revokedAssignments.set(new Set([1]));
    fixture.detectChanges();
    expect(fixture.componentInstance['markers']()).toEqual([]);
  });
});

describe('LiveMap marker details', () => {
  const visible = signal<VisibleLocation[]>([]);
  const revokedAssignments = signal<ReadonlySet<number>>(new Set());

  beforeEach(async () => {
    revokedAssignments.set(new Set());
    visible.set([{
      assignment: {
        idUsuarioDispositivo: 1, idUsuario: 12, alias: 'GPS de Ana',
        codigoDispositivo: 'A', visibilidadPreferida: 'GRUPO', ubicacionActiva: true,
      },
      location: {
        idUsuarioDispositivo: 1, latitud: 40.5, longitud: -3.7,
        fechaHoraDispositivo: '2026-11-19T12:00:00Z', precisionGps: 8,
      },
      emergenciaActiva: false,
    }]);
    vi.stubGlobal('google', {
      maps: {
        ControlPosition: { LEFT_BOTTOM: 1, RIGHT_BOTTOM: 2 },
        Size: class { constructor(_width: number, _height: number) {} },
        Point: class { constructor(_x: number, _y: number) {} },
        OverlayView: OverlayViewStub,
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
        { provide: LocationsStore, useValue: { locations: visible, revokedAssignments, error: signal(null) } },
        { provide: OverviewStore, useValue: { emergencies: signal([]), contacts: signal([{
          contacto: { idUsuario: 12, nombres: 'Ana', apellidos: 'Ruiz' },
        }]) } },
      ],
    }).overrideComponent(LiveMap, {
      set: { imports: [GoogleMapStub, MapMarkerStub, DatePipe] },
    }).compileComponents();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('keeps the details next to the marker while the map is dragged or zoomed', () => {
    OverlayViewStub.pixel = { x: 200, y: 150 };
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.componentInstance['locating'].set(false);
    fixture.detectChanges();
    vi.spyOn(fixture.nativeElement, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 900, height: 600, right: 900, bottom: 600,
      x: 0, y: 0, toJSON: () => ({}),
    });
    fixture.componentInstance['onMapInitialized']({
      getDiv: () => fixture.nativeElement,
    } as unknown as google.maps.Map);
    const marker = fixture.componentInstance['markers']()[0];
    fixture.componentInstance['selectMarker'](marker, {
      domEvent: new MouseEvent('click', { clientX: 800, clientY: 500 }),
    } as google.maps.MapMouseEvent);
    fixture.detectChanges();
    const details = fixture.nativeElement.querySelector('.marker-details') as HTMLElement;
    expect(details.style.left).toBe('216px');
    expect(details.style.top).toBe('90px');

    OverlayViewStub.pixel = { x: 310, y: 260 };
    fixture.componentInstance['mapOverlay']?.draw();
    fixture.detectChanges();
    expect(details.style.left).toBe('326px');
    expect(details.style.top).toBe('200px');

    OverlayViewStub.pixel = { x: -10, y: 260 };
    fixture.componentInstance['mapOverlay']?.draw();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.marker-details')).toBeNull();
    fixture.destroy();
  });

  it('shows the last recorded position and its capture time when it is not live', () => {
    visible.update((items) => [{
      ...items[0],
      location: { ...items[0].location, isLive: false },
    }]);
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.componentInstance['locating'].set(false);
    fixture.componentInstance['now'].set(Date.parse('2026-11-19T12:00:20Z'));
    fixture.detectChanges();
    fixture.componentInstance['showMarkerPreview'](fixture.componentInstance['markers']()[0]);
    fixture.detectChanges();

    const details = fixture.nativeElement.querySelector('.marker-details') as HTMLElement;
    expect(details.textContent).toContain('Última posición registrada:');
    expect(details.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-19T12:00:00Z');
    expect(details.textContent).toContain('Última ubicación conocida · puede no ser la posición actual');
    expect(details.textContent).not.toContain('Ubicación anterior; no indica la posición actual');
  });

  it('shows the server emergency snapshot as last known, not as a live position', () => {
    visible.set([]);
    TestBed.inject(OverviewStore).emergencies.set([{
      idEmergencia: 'sos-snapshot', idUsuarioDispositivo: 1, estado: 'ACTIVA',
      fechaInicio: '2026-11-19T12:00:00Z', descripcion: null,
      ubicacion: {
        idUsuarioDispositivo: 1, latitud: 40.5, longitud: -3.7,
        fechaHoraDispositivo: '2026-11-19T12:03:00Z', isLive: true,
      },
    }]);
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.componentInstance['locating'].set(false);
    fixture.detectChanges();
    fixture.componentInstance['showMarkerPreview'](fixture.componentInstance['markers']()[0]);
    fixture.detectChanges();

    const details = fixture.nativeElement.querySelector('.marker-details') as HTMLElement;
    expect(details.textContent).toContain('Emergencia autorizada');
    expect(details.textContent).toContain('Sin ubicación en vivo');
    expect(details.textContent).toContain('Última ubicación conocida');
    expect(details.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-19T12:03:00Z');
  });

  it('keeps the recent label for a position whose server validity has not expired', () => {
    visible.update((items) => [{
      ...items[0],
      location: {
        ...items[0].location,
        fechaHoraServidor: '2026-11-19T12:00:05Z',
        liveExpiresAt: '2026-11-19T12:01:05Z',
        isLive: true,
      },
    }]);
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.componentInstance['locating'].set(false);
    fixture.componentInstance['now'].set(Date.parse('2026-11-19T12:00:20Z'));
    fixture.detectChanges();
    fixture.componentInstance['showMarkerPreview'](fixture.componentInstance['markers']()[0]);
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('.marker-details') as HTMLElement).textContent)
      .toContain('Ubicación reciente');
  });

  it('does not invent a capture time when the device did not provide one', () => {
    visible.update((items) => [{
      ...items[0],
      location: { ...items[0].location, fechaHoraDispositivo: '' },
    }]);
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.componentInstance['locating'].set(false);
    fixture.detectChanges();
    fixture.componentInstance['showMarkerPreview'](fixture.componentInstance['markers']()[0]);
    fixture.detectChanges();

    const details = fixture.nativeElement.querySelector('.marker-details') as HTMLElement;
    expect(details.textContent).toContain('Hora de captura no disponible');
    expect(details.querySelector('time')).toBeNull();
  });

  it('previews basic data on marker hover and expands the details with the arrow', () => {
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.componentInstance['locating'].set(false);
    fixture.detectChanges();
    const mapMarker = fixture.debugElement.query(By.directive(MapMarkerStub)).componentInstance as MapMarkerStub;
    vi.spyOn(fixture.nativeElement, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 900, height: 600, right: 900, bottom: 600,
      x: 0, y: 0, toJSON: () => ({}),
    });
    mapMarker.mapMouseover.emit({
      domEvent: new MouseEvent('mousemove', { clientX: 500, clientY: 300 }),
    } as google.maps.MapMouseEvent);
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector('.marker-details-toggle') as HTMLButtonElement;
    const details = fixture.nativeElement.querySelector('.marker-details-extra') as HTMLElement;
    expect((fixture.nativeElement.querySelector('.marker-details') as HTMLElement).style.left).toBe('516px');
    expect(fixture.nativeElement.querySelector('.marker-access')).toBeNull();
    expect(toggle.textContent).toContain('Ana Ruiz');
    expect(fixture.nativeElement.textContent).toContain('Dispositivo: GPS de Ana');
    expect(toggle.querySelector('.marker-chevron')).not.toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(details.id);
    expect(details.hidden).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Coordenadas:');
    expect(fixture.componentInstance['selectedMarkerId']()).toBeNull();

    toggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedMarkerId']()).toBe('1');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(details.hidden).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Precisión reportada: 8 m');
    expect(fixture.nativeElement.textContent).toContain('Coordenadas: 40.5, -3.7');

    toggle.click();
    fixture.detectChanges();
    expect(details.hidden).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Coordenadas:');
  });

  it('hides a hover preview on mouse leave, while a marker click keeps the summary open', () => {
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.componentInstance['locating'].set(false);
    fixture.detectChanges();
    const mapMarker = fixture.debugElement.query(By.directive(MapMarkerStub)).componentInstance as MapMarkerStub;
    mapMarker.mapMouseover.emit({} as google.maps.MapMouseEvent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.marker-details')).not.toBeNull();

    (fixture.nativeElement.querySelector('.marker-details') as HTMLElement)
      .dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.marker-details')).toBeNull();

    mapMarker.mapClick.emit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.marker-details')).not.toBeNull();
    (fixture.nativeElement.querySelector('.marker-details') as HTMLElement)
      .dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.marker-details')).not.toBeNull();
  });

  it('returns focus to a marker activated with the keyboard after closing its preview', () => {
    const fixture = TestBed.createComponent(LiveMap);
    fixture.componentInstance['ready'].set(true);
    fixture.componentInstance['locating'].set(false);
    fixture.detectChanges();
    const keyboardMarker = document.createElement('button');
    keyboardMarker.textContent = 'Marcador accesible';
    fixture.nativeElement.appendChild(keyboardMarker);
    keyboardMarker.addEventListener('keydown', (event) => {
      fixture.componentInstance['selectMarker'](
        fixture.componentInstance['markers']()[0],
        { domEvent: event } as google.maps.MapMouseEvent,
      );
    });
    keyboardMarker.focus();
    keyboardMarker.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#marker-details-title'));

    (fixture.nativeElement.querySelector('.marker-details-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(keyboardMarker);
  });
});

describe('LiveMap público', () => {
  it('combines anonymous public locations and emergency markers without personal data', async () => {
    const authenticated = signal(false);
    vi.stubGlobal('google', {
      maps: {
        ControlPosition: { LEFT_BOTTOM: 1, RIGHT_BOTTOM: 2 },
        Size: class { constructor(_width: number, _height: number) {} },
        Point: class { constructor(_x: number, _y: number) {} },
      },
    });
    try {
      await TestBed.configureTestingModule({
        imports: [LiveMap],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: GoogleMapsLoader, useValue: { load: () => new Promise<void>(() => {}) } },
          { provide: SessionStore, useValue: {
            isAuthenticated: authenticated, user: signal(null),
          } },
          { provide: LocationsStore, useValue: {
            locations: signal([]), revokedAssignments: signal<ReadonlySet<number>>(new Set()), error: signal(null),
          } },
          { provide: OverviewStore, useValue: { contacts: signal([]), emergencies: signal([]) } },
        ],
      }).overrideComponent(LiveMap, { set: { template: '', imports: [] } }).compileComponents();
      const fixture = TestBed.createComponent(LiveMap);
      fixture.componentInstance['ready'].set(true);
      fixture.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      http.expectOne((request) => request.url.endsWith('/locations/public')).flush([{
        clavePublica: 'VIS-123', origen: 'PUBLICO', ubicacion: { latitud: -12, longitud: -77 },
      }]);
      http.expectOne((request) => request.url.endsWith('/emergencies/public')).flush([{
        clavePublica: 'EME-ABC', codigoPublico: 'EME-ABC', estado: 'ACTIVA',
        ubicacion: { latitud: -13, longitud: -78 },
        nombres: 'No mostrar',
      }, {
        clavePublica: 'EME-SIN', codigoPublico: 'EME-SIN', estado: 'ACTIVA',
        ubicacion: null,
      }]);
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(fixture.componentInstance['markers']().map((item) => item.id)).toEqual([
          'public-VIS-123', 'public-EME-ABC',
        ]);
      });
      expect(fixture.componentInstance['markers']()[1].publicCode).toBe('EME-ABC');
      expect(fixture.componentInstance['markers']()[1].title).toBe('Emergencia pública');
      expect(fixture.componentInstance['markers']()[1].title).not.toContain('No mostrar');
      expect(fixture.componentInstance['unlocatedEmergencies']().map((item) => item.codigoPublico)).toEqual(['EME-SIN']);

      authenticated.set(true);
      fixture.detectChanges();
      expect(fixture.componentInstance['markers']()).toEqual([]);
      expect(fixture.componentInstance['unlocatedEmergencies']()).toEqual([]);
      http.verify();
      fixture.destroy();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
