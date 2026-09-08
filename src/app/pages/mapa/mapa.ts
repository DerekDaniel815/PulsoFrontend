import { Component } from '@angular/core';
import { LiveMap } from '../../shared/live-map/live-map';

@Component({
  selector: 'app-mapa',
  imports: [LiveMap],
  template: `
    <section class="page">
      <div class="page-head">
        <h1>Mapa</h1>
        <p>Ubicaciones en vivo sobre Google Maps. Luego se conectará el websocket de coordenadas.</p>
      </div>
      <article class="map-wrap">
        <app-live-map />
      </article>
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
    }

    .page {
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
      min-height: 0;
    }

    .map-wrap {
      flex: 1;
      min-height: 360px;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
    }
  `,
})
export class Mapa {}
