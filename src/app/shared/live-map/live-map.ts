import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, input, signal } from '@angular/core';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { firstValueFrom } from 'rxjs';
import { PULSO_API_URL } from '../../core/auth/auth.config';
import { SessionStore } from '../../core/auth/session-store';
import { GoogleMapsLoader } from '../../core/maps/google-maps.loader';
import { LocationsStore } from '../../core/locations/locations-store';
import { DARK_MAP_STYLES, MAP_BACKGROUND, MAP_CENTER, MapPoint, markerOptions } from '../../core/maps/map-theme';

interface ReadyMarker {
  id: string;
  title: string;
  position: google.maps.LatLngLiteral;
  options: google.maps.MarkerOptions;
}

interface PublicLocation {
  clavePublica: string;
  origen: 'PUBLICO' | 'EMERGENCIA';
  ubicacion: { latitud: number; longitud: number };
}

@Component({
  selector: 'app-live-map',
  imports: [GoogleMap, MapMarker],
  templateUrl: './live-map.html',
  styleUrl: './live-map.scss',
})
export class LiveMap {
  private readonly loader = inject(GoogleMapsLoader);
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionStore);
  private readonly publicLocations = signal<PublicLocation[]>([]);
  protected readonly locations = inject(LocationsStore);

  readonly overlayLayout = input(false);

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
      this.locations.locations();
      this.publicLocations();
      this.session.isAuthenticated();
      if (this.ready()) {
        this.updateMarkers();
      }
    });
    effect(() => {
      if (this.session.isAuthenticated()) {
        this.publicLocations.set([]);
      } else {
        void this.loadPublicLocations();
      }
    });
  }

  private async loadPublicLocations(): Promise<void> {
    try {
      const items = await firstValueFrom(this.http.get<PublicLocation[]>(`${PULSO_API_URL}/locations/public`));
      if (!this.session.isAuthenticated()) this.publicLocations.set(items);
    } catch {
      if (!this.session.isAuthenticated()) this.locationMessage.set('No se pudieron cargar las ubicaciones públicas.');
    }
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
        backgroundColor: MAP_BACKGROUND,
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

    const privatePoints: MapPoint[] = this.locations.locations().map((item) => ({
      id: String(item.assignment.idUsuarioDispositivo),
      title: item.assignment.alias || item.assignment.codigoDispositivo,
      initials: 'GPS',
      status: item.emergenciaActiva ? 'emergencia' : 'conectado',
      position: { lat: item.location.latitud, lng: item.location.longitud },
    }));
    const publicPoints: MapPoint[] = this.publicLocations().map((item) => ({
      id: `public-${item.clavePublica}`,
      title: item.origen === 'EMERGENCIA' ? 'Emergencia pública' : 'Ubicación pública',
      initials: item.origen === 'EMERGENCIA' ? 'SOS' : 'GPS',
      status: item.origen === 'EMERGENCIA' ? 'emergencia' : 'conectado',
      position: { lat: item.ubicacion.latitud, lng: item.ubicacion.longitud },
    }));
    const points = this.session.isAuthenticated() ? privatePoints : publicPoints;

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
