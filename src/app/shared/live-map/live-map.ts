import { Component, effect, inject, input, signal } from '@angular/core';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { GoogleMapsLoader } from '../../core/maps/google-maps.loader';
import { DARK_MAP_STYLES, MAP_CENTER, MAP_POINTS, MapPoint, markerOptions } from '../../core/maps/map-theme';

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

  readonly overlayLayout = input(false);
  readonly showDemoMarkers = input(false);

  protected readonly ready = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly locationMessage = signal<string | null>(null);
  protected readonly locating = signal(true);
  protected readonly center = signal(MAP_CENTER);
  protected readonly zoom = 15;
  protected readonly options = signal<google.maps.MapOptions>({});
  protected readonly markers = signal<ReadyMarker[]>([]);

  constructor() {
    void this.init();
    effect(() => {
      const overlay = this.overlayLayout();
      if (!this.ready() || !globalThis.google?.maps) {
        return;
      }
      this.options.update((current) => ({
        ...current,
        zoomControlOptions: {
          position: overlay
            ? google.maps.ControlPosition.RIGHT_BOTTOM
            : google.maps.ControlPosition.LEFT_BOTTOM,
        },
      }));
    });
    effect(() => {
      this.showDemoMarkers();
      if (this.ready()) {
        this.updateMarkers();
      }
    });
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
      this.ready.set(true);
      this.requestLocation();
    } catch {
      this.error.set(
        'No se pudo cargar Google Maps. Copia public/maps-config.example.json a public/maps-config.json y pega tu API key.',
      );
    }
  }

  protected requestLocation(): void {
    const geolocation = globalThis.navigator?.geolocation;
    if (!geolocation) {
      this.locating.set(false);
      this.locationMessage.set('La geolocalización no está disponible en este navegador.');
      this.updateMarkers();
      return;
    }

    this.locating.set(true);
    this.locationMessage.set(null);
    geolocation.getCurrentPosition(
      ({ coords }) => {
        this.center.set({ lat: coords.latitude, lng: coords.longitude });
        this.locating.set(false);
        this.locationMessage.set(null);
        this.updateMarkers(this.center());
      },
      () => {
        this.locating.set(false);
        this.locationMessage.set('No pudimos acceder a tu ubicación. Puedes habilitar el permiso y reintentar.');
        this.updateMarkers();
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000 },
    );
  }

  private updateMarkers(currentPosition?: google.maps.LatLngLiteral): void {
    if (!globalThis.google?.maps) {
      return;
    }

    const points: MapPoint[] = this.showDemoMarkers()
      ? MAP_POINTS.filter((point) => point.id !== 'tu')
      : [];

    if (currentPosition) {
      points.unshift({
        id: 'tu',
        title: 'Tu ubicación actual',
        initials: 'TÚ',
        status: 'yo',
        position: currentPosition,
      });
    } else if (this.center() !== MAP_CENTER) {
      points.unshift({
        id: 'tu',
        title: 'Tu ubicación actual',
        initials: 'TÚ',
        status: 'yo',
        position: this.center(),
      });
    }

    this.markers.set(
      points.map((point) => ({
        id: point.id,
        title: point.title,
        position: point.position,
        options: markerOptions(point),
      })),
    );
  }
}
