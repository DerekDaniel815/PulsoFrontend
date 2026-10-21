import { HttpClient } from '@angular/common/http';
import { Service, effect, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { firstValueFrom } from 'rxjs';
import { SessionStore } from '../auth/session-store';
import { PULSO_API_URL, REMOTE_API_URL } from '../auth/auth.config';

export interface VisibleLocation {
  assignment: {
    idUsuarioDispositivo: number;
    idUsuario: number;
    alias: string | null;
    codigoDispositivo: string;
    visibilidadPreferida: string;
    ubicacionActiva: boolean;
  };
  location: {
    idUsuarioDispositivo: number;
    latitud: number;
    longitud: number;
    fechaHoraDispositivo: string;
  };
  emergenciaActiva: boolean;
}

@Service()
export class LocationsStore {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionStore);
  private socket: Socket | null = null;
  private generation = 0;
  private readonly locationsState = signal<VisibleLocation[]>([]);
  readonly locations = this.locationsState.asReadonly();
  readonly error = signal<string | null>(null);
  readonly connected = signal(false);
  readonly notificationVersion = signal(0);

  constructor() {
    effect(() => {
      const token = this.session.isAuthenticated() ? this.session.token() : null;
      this.generation++;
      this.socket?.removeAllListeners();
      this.socket?.disconnect();
      this.socket = null;
      this.connected.set(false);
      this.locationsState.set([]);
      this.error.set(null);
      if (!token) return;

      const generation = this.generation;
      this.socket = io(`${REMOTE_API_URL}/locations`, {
        auth: { token },
        autoConnect: false,
      });
      this.socket.on('connect', () => {
        this.connected.set(true);
        void this.refresh();
      });
      this.socket.on('disconnect', () => this.connected.set(false));
      this.socket.on('notification.created', () => {
        if (generation === this.generation) this.notificationVersion.update((version) => version + 1);
      });
      this.socket.on('location.updated', (payload: unknown) => {
        if (generation !== this.generation) return;
        const item = this.toVisibleLocation(payload);
        if (!item) return;
        this.locationsState.update((current) => [
          ...current.filter(
            (existing) => existing.assignment.idUsuarioDispositivo !== item.assignment.idUsuarioDispositivo,
          ),
          item,
        ]);
      });
      this.socket.on('location.private.removed', (payload: unknown) => {
        if (generation !== this.generation || typeof payload !== 'object' || payload === null) return;
        const id = (payload as { idUsuarioDispositivo?: unknown }).idUsuarioDispositivo;
        if (typeof id === 'number') {
          this.locationsState.update((items) =>
            items.filter((item) => item.assignment.idUsuarioDispositivo !== id),
          );
        }
      });
      this.socket.connect();
      void this.refresh();
    });
  }

  async refresh(): Promise<void> {
    if (!this.session.isAuthenticated()) return;
    const generation = this.generation;
    try {
      const locations = await firstValueFrom(
        this.http.get<VisibleLocation[]>(`${PULSO_API_URL}/locations/visible`),
      );
      if (generation === this.generation) {
        this.locationsState.set(locations);
        this.error.set(null);
      }
    } catch {
      if (generation === this.generation) this.error.set('No se pudieron cargar las ubicaciones.');
    }
  }

  private toVisibleLocation(value: unknown): VisibleLocation | null {
    if (typeof value !== 'object' || value === null) return null;
    const item = value as Partial<VisibleLocation> & {
      idUsuarioDispositivo?: number;
      latitud?: number;
      longitud?: number;
    };
    if (
      typeof item.assignment?.idUsuarioDispositivo === 'number' &&
      typeof item.location?.latitud === 'number' &&
      typeof item.location?.longitud === 'number'
    ) return item as VisibleLocation;
    const id = item.idUsuarioDispositivo ?? item.assignment?.idUsuarioDispositivo;
    const latitud = item.location?.latitud ?? item.latitud;
    const longitud = item.location?.longitud ?? item.longitud;
    if (typeof id !== 'number' || typeof latitud !== 'number' || typeof longitud !== 'number') return null;
    const previous = this.locationsState().find((entry) => entry.assignment.idUsuarioDispositivo === id);
    return {
      assignment: {
        idUsuarioDispositivo: id,
        idUsuario: item.assignment?.idUsuario ?? previous?.assignment.idUsuario ?? 0,
        alias: item.assignment?.alias ?? previous?.assignment.alias ?? null,
        codigoDispositivo: item.assignment?.codigoDispositivo ?? previous?.assignment.codigoDispositivo ?? `Dispositivo ${id}`,
        visibilidadPreferida: item.assignment?.visibilidadPreferida ?? previous?.assignment.visibilidadPreferida ?? '',
        ubicacionActiva: item.assignment?.ubicacionActiva ?? previous?.assignment.ubicacionActiva ?? true,
      },
      location: {
        idUsuarioDispositivo: id,
        latitud,
        longitud,
        fechaHoraDispositivo: item.location?.fechaHoraDispositivo ?? previous?.location.fechaHoraDispositivo ?? '',
      },
      emergenciaActiva: item.emergenciaActiva ?? previous?.emergenciaActiva ?? false,
    };
  }
}
