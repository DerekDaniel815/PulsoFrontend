import { HttpClient, HttpParams } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PULSO_API_URL } from '../../core/auth/auth.config';

interface Assignment {
  idUsuarioDispositivo: number;
  alias: string | null;
  dispositivo?: { codigoDispositivo?: string };
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
  private requestGeneration = 0;
  protected readonly assignments = signal<Assignment[]>([]);
  protected readonly selectedId = signal<number | null>(null);
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
  protected readonly error = signal<string | null>(null);

  constructor() { void this.loadAssignments(); }

  private async loadAssignments(): Promise<void> {
    try {
      const assignments = await firstValueFrom(
        this.http.get<Assignment[]>(`${PULSO_API_URL}/user-devices/me`),
      );
      this.assignments.set(assignments);
      if (assignments.length) {
        this.selectedId.set(assignments[0].idUsuarioDispositivo);
        await this.refresh();
      } else this.loading.set(false);
    } catch {
      this.error.set('No se pudieron cargar los dispositivos.');
      this.loading.set(false);
    }
  }

  protected selectAssignment(event: Event): void {
    this.selectedId.set(Number((event.target as HTMLSelectElement).value));
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
    if (id === null) return;
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
    try {
      const params = new HttpParams().set('from', start.toISOString()).set('to', end.toISOString());
      const points = await firstValueFrom(this.http.get<HistoryLocation[]>(
        `${PULSO_API_URL}/locations/user-device/${id}/history`, { params },
      ));
      if (generation === this.requestGeneration) {
        this.points.set(points);
        this.error.set(null);
      }
    } catch {
      if (generation === this.requestGeneration) this.error.set('No se pudo cargar el historial.');
    } finally {
      if (generation === this.requestGeneration) this.loading.set(false);
    }
  }

  protected exportData(): void {
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
