import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocationsStore } from '../../core/locations/locations-store';
import { LiveMap } from '../../shared/live-map/live-map';

@Component({
  selector: 'app-mapa',
  imports: [LiveMap, RouterLink],
  template: `
    <section class="map-page" aria-labelledby="map-title">
      <header class="map-heading">
        <div><p class="eyebrow">Ubicaciones autorizadas</p><h1 id="map-title">Mapa interactivo</h1></div>
        <span class="connection" [class.is-connected]="locations.connected()" role="status">
          {{ locations.connected() ? 'Tiempo real' : 'Reconectando' }}
        </span>
      </header>
      <div class="map-canvas">
        <app-live-map [selectedUserId]="selectedUserId()" />
        <div class="map-label"><span aria-hidden="true">●</span> {{ selectedUserId() ? 'Ubicación del contacto' : 'Vista ciudad' }} · Tiempo real</div>
        <div class="map-legend" aria-label="Leyenda del mapa">
          <span><i class="connected" aria-hidden="true"></i> Ubicación visible</span>
          <span><i class="emergency" aria-hidden="true"></i> Emergencia</span>
        </div>
      </div>
      @if (selectedUserId()) {
        @if (refreshing() && selectedLocations().length === 0) {
          <p class="map-help" role="status">Comprobando la ubicación compartida del contacto…</p>
        } @else if (selectedLocations().length === 0 && !locations.error()) {
          <p class="map-help" role="status">No hay una ubicación visible de este contacto por ahora. Debe compartirla contigo y mantener su ubicación activa.</p>
        } @else {
          <p class="map-help">Ubicación del dispositivo del contacto disponible. Tu posición también aparecerá si permites el acceso a la ubicación del navegador.</p>
        }
      } @else {
        <p class="map-help">Solo aparecen ubicaciones que el servidor te permite ver. <a routerLink="/contactos">Gestionar contactos</a></p>
      }
    </section>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-height: 0; }
    .map-page { display: flex; flex: 1; flex-direction: column; gap: 16px; min-height: 0; }
    .map-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    h1 { margin: 0; font-size: clamp(1.35rem, 2vw, 1.85rem); }
    .eyebrow { margin: 0 0 4px; color: var(--primary); font-size: 11px; text-transform: uppercase; }
    .connection { padding: 7px 12px; border: 1px solid var(--border-strong); border-radius: 9px; color: var(--text-muted); }
    .connection.is-connected { color: var(--success); border-color: color-mix(in srgb, var(--success) 40%, transparent); }
    .map-canvas { position: relative; flex: 1; min-height: 450px; overflow: hidden; border: 1px solid var(--border-strong); border-radius: var(--radius-lg); background: var(--map-bg); }
    .map-label, .map-legend { position: absolute; z-index: 2; padding: 8px 12px; border: 1px solid var(--border-strong); border-radius: 9px; background: color-mix(in srgb, var(--sidebar-bg) 93%, transparent); }
    .map-label { top: 16px; left: 16px; color: var(--text-muted); font-size: 12px; }
    .map-label span { color: var(--primary); }
    .map-legend { right: 16px; bottom: 16px; display: grid; gap: 7px; font-size: 12px; }
    .map-legend span { display: flex; align-items: center; gap: 8px; }
    .map-legend i { width: 8px; height: 8px; border-radius: 50%; }
    .map-legend .connected { background: var(--success); }
    .map-legend .emergency { background: var(--emergency); }
    .map-help { margin: 0; color: var(--text-muted); }
    .map-help a { color: var(--primary); }
  `],
})
export class Mapa {
  protected readonly locations = inject(LocationsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly selectedUserId = computed(() => {
    const raw = this.params().get('usuario');
    if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
    const id = Number(raw);
    return Number.isSafeInteger(id) ? id : null;
  });
  protected readonly selectedLocations = computed(() =>
    this.locations.locations().filter((item) => item.assignment.idUsuario === this.selectedUserId()),
  );
  protected readonly refreshing = signal(true);

  constructor() {
    void this.locations.refresh().finally(() => this.refreshing.set(false));
  }
}
