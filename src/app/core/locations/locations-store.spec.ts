import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { io, Socket } from 'socket.io-client';
import { SessionStore } from '../auth/session-store';
import { LocationsStore, VisibleLocation } from './locations-store';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));

describe('LocationsStore', () => {
  const user = signal({ rol: 'USUARIO' as 'USUARIO' | 'ADMIN' });
  const handlers = new Map<string, (payload: { idUsuarioDispositivo: number }) => void>();
  const socket = {
    on: vi.fn((event: string, handler: (payload: { idUsuarioDispositivo: number }) => void) => {
      handlers.set(event, handler);
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  const location: VisibleLocation = {
    assignment: {
      idUsuarioDispositivo: 7, idUsuario: 12, alias: null, codigoDispositivo: 'PUL-123',
      visibilidadPreferida: 'GRUPO', ubicacionActiva: true,
    },
    location: {
      idUsuarioDispositivo: 7, latitud: -12, longitud: -77,
      fechaHoraDispositivo: '2026-11-19T12:00:00Z',
    },
    emergenciaActiva: false,
  };

  beforeEach(() => {
    user.set({ rol: 'USUARIO' });
    handlers.clear();
    vi.mocked(io).mockReturnValue(socket as unknown as Socket);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionStore, useValue: {
          isAuthenticated: signal(true), token: signal('jwt'), user,
        } },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.clearAllMocks();
  });

  it('never restores a revoked location from a REST request already in flight', async () => {
    const store = TestBed.inject(LocationsStore);
    const http = TestBed.inject(HttpTestingController);
    TestBed.tick();
    http.expectOne((request) => request.url.endsWith('/locations/visible')).flush([location]);
    await vi.waitFor(() => expect(store.locations()).toHaveLength(1));

    const refresh = store.refresh();
    const stale = http.expectOne((request) => request.url.endsWith('/locations/visible'));
    handlers.get('location.private.removed')?.({ idUsuarioDispositivo: 7 });
    expect(store.locations()).toHaveLength(0);
    expect(store.revokedAssignments().has(7)).toBe(true);
    expect(store.notificationVersion()).toBe(1);

    stale.flush([location]);
    await refresh;
    const current = http.expectOne((request) => request.url.endsWith('/locations/visible'));
    expect(store.locations()).toHaveLength(0);
    current.flush([]);
    await vi.waitFor(() => expect(store.locations()).toHaveLength(0));
  });

  it('does not connect or load user locations for ADMIN', async () => {
    user.set({ rol: 'ADMIN' });
    const store = TestBed.inject(LocationsStore);
    TestBed.tick();
    await store.refresh();
    expect(socket.connect).not.toHaveBeenCalled();
    expect(TestBed.inject(HttpTestingController).match(() => true)).toEqual([]);
    expect(store.locations()).toEqual([]);
  });
});
