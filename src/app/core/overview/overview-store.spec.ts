import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SessionStore } from '../auth/session-store';
import { ContactsApi } from '../contacts/contacts-api';
import { LocationsStore } from '../locations/locations-store';
import { NotificationsApi } from '../notifications/notifications-api';
import { OverviewStore } from './overview-store';

describe('OverviewStore emergency location', () => {
  const authenticated = signal(true);
  const notificationVersion = signal(0);
  let http: HttpTestingController;
  let overview: OverviewStore;

  beforeEach(() => {
    authenticated.set(true);
    notificationVersion.set(0);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionStore, useValue: { isAuthenticated: authenticated } },
        { provide: LocationsStore, useValue: { notificationVersion } },
        { provide: ContactsApi, useValue: { list: () => of([]) } },
        { provide: NotificationsApi, useValue: { list: () => of([]) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    overview = TestBed.inject(OverviewStore);
    TestBed.tick();
  });

  afterEach(() => http.verify());

  it('retains the server last known position and its capture time after the GPS goes offline', async () => {
    http.expectOne((request) => request.url.endsWith('/emergencies/active')).flush([{
      idEmergencia: 'sos-1', idUsuarioDispositivo: 7, estado: 'ACTIVA',
      fechaInicio: '2026-11-19T12:00:00Z',
      ubicacion: {
        idUsuarioDispositivo: 7, latitud: -12, longitud: -77,
        fechaHoraDispositivo: '2026-11-19T12:05:00Z', isLive: false,
      },
      fechaUltimaUbicacion: '2026-11-19T12:05:00Z',
    }]);
    http.expectOne((request) => request.url.endsWith('/notifications/unread-count'))
      .flush({ count: 0 });
    await vi.waitFor(() => expect(overview.emergencies()).toHaveLength(1));

    expect(overview.emergencies()[0].ubicacion?.latitud).toBe(-12);
    expect(overview.emergencies()[0].fechaUltimaUbicacion).toBe('2026-11-19T12:05:00Z');

    authenticated.set(false);
    TestBed.tick();
    expect(overview.emergencies()).toEqual([]);
  });

  it('drops an old emergency if a refreshed authorization check fails', async () => {
    http.expectOne((request) => request.url.endsWith('/emergencies/active'))
      .flush([{ idEmergencia: 'sos-1', idUsuarioDispositivo: 7, estado: 'ACTIVA' }]);
    http.expectOne((request) => request.url.endsWith('/notifications/unread-count'))
      .flush({ count: 0 });
    await vi.waitFor(() => expect(overview.emergencies()).toHaveLength(1));

    const refresh = overview.refresh();
    http.expectOne((request) => request.url.endsWith('/emergencies/active'))
      .flush(null, { status: 403, statusText: 'Forbidden' });
    http.expectOne((request) => request.url.endsWith('/notifications/unread-count'))
      .flush({ count: 0 });
    await refresh;
    expect(overview.emergencies()).toEqual([]);
  });
});
