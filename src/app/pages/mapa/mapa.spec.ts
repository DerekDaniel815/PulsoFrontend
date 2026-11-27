import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { SessionStore } from '../../core/auth/session-store';
import { LocationsStore, VisibleLocation } from '../../core/locations/locations-store';
import { GoogleMapsLoader } from '../../core/maps/google-maps.loader';
import { OverviewStore } from '../../core/overview/overview-store';
import { Mapa } from './mapa';

describe('Mapa de una persona autorizada', () => {
  const visible = signal<VisibleLocation[]>([]);
  const emergencies = signal<{ idUsuarioDispositivo: number; estado: string }[]>([]);
  const now = Date.now();
  const location: VisibleLocation = {
    assignment: {
      idUsuarioDispositivo: 7, idUsuario: 12, alias: 'Tracker de Ana',
      codigoDispositivo: 'PUL-123', visibilidadPreferida: 'GRUPO', ubicacionActiva: true,
    },
    location: {
      idUsuarioDispositivo: 7, latitud: -12.046, longitud: -77.042,
      fechaHoraDispositivo: new Date(now - 60_000).toISOString(),
      fechaHoraServidor: new Date(now).toISOString(),
      liveExpiresAt: new Date(now + 4 * 60_000).toISOString(),
      isLive: true, locationSource: 'GNSS', precisionGps: 8,
    },
    emergenciaActiva: false,
  };

  beforeEach(async () => {
    visible.set([location]);
    emergencies.set([]);
    const params = convertToParamMap({ usuario: '12' });
    await TestBed.configureTestingModule({
      imports: [Mapa],
      providers: [
        provideHttpClient(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: params }, queryParamMap: of(params) } },
        { provide: GoogleMapsLoader, useValue: { load: () => new Promise<void>(() => {}) } },
        { provide: SessionStore, useValue: {
          isAuthenticated: signal(true),
          user: signal({ idUsuario: 1, nombres: 'Yo', apellidos: 'Mismo' }),
        } },
        { provide: LocationsStore, useValue: {
          locations: visible, revokedAssignments: signal<ReadonlySet<number>>(new Set()),
          connected: signal(true), error: signal(null), refresh: vi.fn(async () => {}),
        } },
        { provide: OverviewStore, useValue: {
          contacts: signal([{ contacto: { idUsuario: 12, nombres: 'Ana', apellidos: 'Ruiz' } }]),
          emergencies, refresh: vi.fn(async () => {}),
        } },
      ],
    }).compileComponents();
  });

  it('shows the selected person without any buttons or cards below the map', async () => {
    const fixture = TestBed.createComponent(Mapa);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Seguimiento de Ana Ruiz');
    expect(fixture.nativeElement.querySelector('.tracking-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.tracking-toggle')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Coordenadas:');
    expect(fixture.nativeElement.textContent).not.toContain('Precisión reportada');
  });

  it('updates the details on emergency and removes the location when access is revoked', async () => {
    const fixture = TestBed.createComponent(Mapa);
    fixture.detectChanges();
    await fixture.whenStable();
    emergencies.set([{ idUsuarioDispositivo: 7, estado: 'ACTIVA' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Emergencia activa · solo consulta');

    visible.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tracking-card')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No hay una ubicación autorizada');
  });

  it('does not expose details below the map or claim the GPS is online', async () => {
    visible.set([{
      ...location,
      location: {
        ...location.location,
        isLive: false, locationSource: 'NETWORK',
        fueSincronizadaOffline: true,
      },
    }]);
    const fixture = TestBed.createComponent(Mapa);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Canal de actualizaciones conectado');
    expect(fixture.nativeElement.textContent).not.toContain('Tiempo real');
    expect(fixture.nativeElement.textContent).not.toContain('Coordenadas:');
  });
});
