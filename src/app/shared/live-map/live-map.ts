import { Component, inject, signal } from '@angular/core';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { GoogleMapsLoader } from '../../core/maps/google-maps.loader';
import { DARK_MAP_STYLES, MAP_CENTER, MAP_POINTS, markerOptions } from '../../core/maps/map-theme';

interface ReadyMarker {
  id: string;
  title: string;
  position: google.maps.LatLngLiteral;
  options: google.maps.MarkerOptions;
}

@Component({
  selector: 'app-live-map',
  imports: [GoogleMap, MapMarker],
  templateUrl: './live-map.html',
  styleUrl: './live-map.scss',
})
export class LiveMap {
  private readonly loader = inject(GoogleMapsLoader);

  protected readonly ready = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly center = MAP_CENTER;
  protected readonly zoom = 15;
  protected readonly options = signal<google.maps.MapOptions>({});
  protected readonly markers = signal<ReadyMarker[]>([]);

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      await this.loader.load();
      this.options.set({
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.LEFT_BOTTOM,
        },
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false,
        gestureHandling: 'greedy',
        clickableIcons: false,
        backgroundColor: '#10151f',
        styles: DARK_MAP_STYLES,
      });
      this.markers.set(
        MAP_POINTS.map((point) => ({
          id: point.id,
          title: point.title,
          position: point.position,
          options: markerOptions(point),
        })),
      );
      this.ready.set(true);
    } catch {
      this.error.set(
        'No se pudo cargar Google Maps. Copia public/maps-config.example.json a public/maps-config.json y pega tu API key.',
      );
    }
  }
}
