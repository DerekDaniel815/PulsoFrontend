import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PULSO_API_URL } from '../../core/auth/auth.config';
import { SessionStore } from '../../core/auth/session-store';
import { LocationsStore } from '../../core/locations/locations-store';
import { OverviewStore } from '../../core/overview/overview-store';

interface Assignment {
  idUsuarioDispositivo: number;
  alias: string | null;
  dispositivo?: { codigoDispositivo?: string };
}

interface HistorySource {
  id: number;
  label: string;
}

// El servidor solo devuelve asignaciones cuyo historial sigue autorizado,
// independientemente de que el GPS esté reportando en este momento.
interface SharedHistorySource {
  idUsuarioDispositivo: number;
  idUsuario: number;
  alias: string | null;
  codigoDispositivo: string;
}

interface HistoryLocation {
  idUbicacion: string;
  latitud: number;
  longitud: number;
  precisionGps: number | null;
  fechaHoraDispositivo: string;
}

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

@Component({
  selector: 'app-historial',
  imports: [DatePipe],
  templateUrl: './historial.html',
  styleUrl: './historial.scss',
})
export class Historial {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionStore);
  private readonly locations = inject(LocationsStore);
  private readonly overview = inject(OverviewStore);
  private requestGeneration = 0;
  private sourceGeneration = 0;
  private readonly ownAssignments = signal<Assignment[]>([]);
  private readonly sharedAssignments = signal<SharedHistorySource[] | null>([]);
  protected readonly sourceError = signal<string | null>(null);
  protected readonly historySourcesUnavailable = computed(() => this.sharedAssignments() === null);
  protected readonly sources = computed<HistorySource[]>(() => {
    if (!this.session.isAuthenticated()) return [];
    const own = this.ownAssignments().map((item) => ({
      id: item.idUsuarioDispositivo,
      label: `Mi dispositivo · ${item.alias || item.dispositivo?.codigoDispositivo || item.idUsuarioDispositivo}`,
    }));
    const contacts = new Map(this.overview.contacts()
      .filter((record) => record.estado === 'ACEPTADO' && record.contactoComparteUbicacion)
      .map((record) => [record.contacto.idUsuario, record.contacto]));
    // Solo el 404 del endpoint nuevo usa el listado de ubicaciones visibles
    // como compatibilidad; nunca se usa como sustituto tras un error de permisos.
    const sharedAssignments = this.sharedAssignments() ?? this.locations.locations().map((item) => item.assignment);
    const shared = sharedAssignments
      .filter((item) => contacts.has(item.idUsuario))
      .map((item) => {
        const person = contacts.get(item.idUsuario)!;
        return {
          id: item.idUsuarioDispositivo,
          label: `${person.nombres} ${person.apellidos} · ${item.alias || item.codigoDispositivo}`,
        };
      });
    return [...own, ...shared.filter((item) => !own.some((mine) => mine.id === item.id))];
  });
  protected readonly selectedId = signal<number | null>(null);
  protected readonly selectedSource = computed(() =>
    this.sources().find((source) => source.id === this.selectedId()) ?? null);
  protected readonly period = signal<Period>('today');
  protected readonly date = signal('');
  protected readonly points = signal<HistoryLocation[]>([]);
  protected readonly route = computed(() => {
    const locations = this.points();
    const latitudes = locations.map((point) => point.latitud);
    const longitudes = locations.map((point) => point.longitud);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    return locations.map((point) => ({
      id: point.idUbicacion,
      x: minLng === maxLng ? 55 : 10 + 90 * (point.longitud - minLng) / (maxLng - minLng),
      y: minLat === maxLat ? 50 : 90 - 80 * (point.latitud - minLat) / (maxLat - minLat),
    }));
  });
  protected readonly routePoints = computed(() => this.route().map((point) => `${point.x},${point.y}`).join(' '));
  protected readonly distanceKm = computed(() => {
    const points = this.points();
    let distance = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const latDelta = (b.latitud - a.latitud) * Math.PI / 180;
      const lngDelta = (b.longitud - a.longitud) * Math.PI / 180;
      const haversine = Math.sin(latDelta / 2) ** 2 +
        Math.cos(a.latitud * Math.PI / 180) * Math.cos(b.latitud * Math.PI / 180) * Math.sin(lngDelta / 2) ** 2;
      distance += 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(haversine)));
    }
    return distance.toFixed(1);
  });
  protected readonly loading = signal(true);
  private readonly initialized = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.session.isAuthenticated()) return;
      this.sourceGeneration++;
      this.sharedAssignments.set([]);
      this.ownAssignments.set([]);
    });
    effect(() => {
      const version = this.locations.notificationVersion();
      if (version > 0 && this.initialized() && this.session.isAuthenticated()) {
        void this.refreshSources();
      }
    });
    effect(() => {
      if (!this.initialized()) return;
      const sources = this.sources();
      const id = this.selectedId();
      if (!this.session.isAuthenticated() ||
          (id !== null && !sources.some((item) => item.id === id)) ||
          (id === null && sources.length > 0)) {
        this.requestGeneration++;
        this.points.set([]);
        this.error.set(null);
        this.selectedId.set(this.session.isAuthenticated() ? sources[0]?.id ?? null : null);
        if (this.selectedId() !== null) void this.refresh();
        else this.loading.set(false);
      }
    });
    void this.loadAssignments();
  }

  private async loadAssignments(): Promise<void> {
    const [own] = await Promise.allSettled([
      firstValueFrom(this.http.get<Assignment[]>(`${PULSO_API_URL}/user-devices/me`)),
      this.overview.refresh(),
      this.locations.refresh(),
      this.refreshSources(),
    ]);
    if (own.status === 'fulfilled') this.ownAssignments.set(own.value);
    else this.error.set('No se pudieron cargar tus dispositivos.');
    this.initialized.set(true);
    if (!this.sources().length) this.loading.set(false);
  }

  protected async refreshSources(): Promise<void> {
    if (!this.session.isAuthenticated()) return;
    const generation = ++this.sourceGeneration;
    try {
      const sources = await firstValueFrom(this.http.get<SharedHistorySource[]>(
        `${PULSO_API_URL}/locations/history-sources`,
      ));
      if (generation !== this.sourceGeneration || !this.session.isAuthenticated()) return;
      this.sharedAssignments.set(sources);
      this.sourceError.set(null);
    } catch (error: unknown) {
      if (generation !== this.sourceGeneration || !this.session.isAuthenticated()) return;
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.sharedAssignments.set(null);
        this.sourceError.set(null);
      } else {
        this.sharedAssignments.set([]);
        this.sourceError.set('No se pudieron comprobar los dispositivos con historial compartido.');
      }
    }
  }

  protected selectAssignment(event: Event): void {
    const id = Number((event.target as HTMLSelectElement).value);
    if (!this.sources().some((source) => source.id === id)) return;
    this.requestGeneration++;
    this.points.set([]);
    this.error.set(null);
    this.selectedId.set(id);
    void this.refresh();
  }

  protected selectPeriod(period: Period): void {
    this.period.set(period);
    if (period !== 'custom') this.date.set('');
    void this.refresh();
  }

  protected selectDate(event: Event): void {
    this.date.set((event.target as HTMLInputElement).value);
    this.period.set('custom');
    void this.refresh();
  }

  protected async refresh(): Promise<void> {
    const id = this.selectedId();
    if (id === null || !this.session.isAuthenticated() ||
        !this.sources().some((source) => source.id === id)) return;
    const generation = ++this.requestGeneration;
    const now = new Date();
    const start = this.period() === 'custom' ? new Date(`${this.date()}T00:00:00`) : new Date(now);
    if (Number.isNaN(start.getTime())) return;
    if (this.period() === 'yesterday') start.setDate(start.getDate() - 1);
    if (this.period() === 'week') start.setDate(start.getDate() - 6);
    if (this.period() === 'month') start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    const end = this.period() === 'custom' || this.period() === 'yesterday'
      ? new Date(start.getTime() + 86_400_000 - 1)
      : now;
    this.loading.set(true);
    this.points.set([]);
    this.error.set(null);
    try {
      const params = new HttpParams().set('from', start.toISOString()).set('to', end.toISOString());
      const points = await firstValueFrom(this.http.get<HistoryLocation[]>(
        `${PULSO_API_URL}/locations/user-device/${id}/history`, { params },
      ));
      if (generation === this.requestGeneration && this.session.isAuthenticated() &&
          this.sources().some((source) => source.id === id)) {
        this.points.set(points);
      }
    } catch (error: unknown) {
      if (generation === this.requestGeneration && this.sources().some((source) => source.id === id)) {
        this.error.set(error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404)
          ? 'El servidor no autoriza consultar el historial de este dispositivo.'
          : 'No se pudo cargar el historial.');
      }
    } finally {
      if (generation === this.requestGeneration) this.loading.set(false);
    }
  }

  protected exportData(): void {
    if (this.loading() || this.error() || !this.selectedSource() || !this.points().length) return;
    const rows = [
      ['Fecha', 'Latitud', 'Longitud', 'Precisión GPS'],
      ...this.points().map((point) => [
        point.fechaHoraDispositivo, String(point.latitud), String(point.longitud),
        String(point.precisionGps ?? ''),
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial-${this.date() || this.period()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
