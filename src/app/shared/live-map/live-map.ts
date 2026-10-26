import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { firstValueFrom } from 'rxjs';
import { PULSO_API_URL } from '../../core/auth/auth.config';
import { SessionStore } from '../../core/auth/session-store';
import { GoogleMapsLoader } from '../../core/maps/google-maps.loader';
import { LocationsStore } from '../../core/locations/locations-store';
import { DARK_MAP_STYLES, MAP_BACKGROUND, MAP_CENTER, MapPoint, markerOptions } from '../../core/maps/map-theme';
import { OverviewStore } from '../../core/overview/overview-store';

interface ReadyMarker {
  id: string;
  title: string;
  deviceLabel?: string;
  updatedAt?: string;
  kind: 'self' | 'private' | 'public';
  position: google.maps.LatLngLiteral;
  options: google.maps.MarkerOptions;
}

interface PublicLocation {
  clavePublica: string;
  origen: 'PUBLICO' | 'EMERGENCIA';
  ubicacion: { latitud: number; longitud: number; fechaHoraDispositivo?: string };
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
  private readonly overview = inject(OverviewStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly markerAccess = viewChild<ElementRef<HTMLElement>>('markerAccess');
  private readonly detailsTitle = viewChild<ElementRef<HTMLElement>>('detailsTitle');
  private readonly publicLocations = signal<PublicLocation[]>([]);
  protected readonly locations = inject(LocationsStore);

  readonly overlayLayout = input(false);
  readonly selectedUserId = input<number | null>(null);
  private mapInstance: google.maps.Map | null = null;
  private fittedUserId: number | null = null;
  private fittedWithOwn = false;
  private lastSelectedUserId: number | null = null;
  private readonly ownPosition = signal<google.maps.LatLngLiteral | null>(null);
  protected readonly canShowMap = computed(() => {
    const userId = this.selectedUserId();
    return userId === null || this.ownPosition() !== null ||
      this.locations.locations().some((item) => item.assignment.idUsuario === userId);
  });

  protected readonly ready = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly locationMessage = signal<string | null>(null);
  protected readonly locating = signal(true);
  protected readonly center = signal(MAP_CENTER);
  protected readonly zoom = 15;
  protected readonly options = signal<google.maps.MapOptions>({});
  protected readonly markers = signal<ReadyMarker[]>([]);
  protected readonly selectedMarkerId = signal<string | null>(null);
  protected readonly selectedMarker = computed(() =>
    this.markers().find((marker) => marker.id === this.selectedMarkerId()) ?? null,
  );
  private readonly now = signal(Date.now());

  constructor() {
    void this.init();
    const clock = setInterval(() => this.now.set(Date.now()), 30_000);
    this.destroyRef.onDestroy(() => clearInterval(clock));
    effect(() => {
      if (this.selectedMarkerId()) this.detailsTitle()?.nativeElement.focus();
    });
    effect(() => {
      const id = this.selectedMarkerId();
      if (id && !this.markers().some((marker) => marker.id === id)) {
        this.selectedMarkerId.set(null);
        this.markerAccess()?.nativeElement.focus();
      }
    });
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
      this.session.user();
      this.overview.contacts();
      const own = this.ownPosition();
      const userId = this.selectedUserId();
      if (userId !== this.lastSelectedUserId) {
        this.lastSelectedUserId = userId;
        this.fittedUserId = null;
        this.fittedWithOwn = false;
      }
      if (userId !== null && this.fittedUserId !== userId) {
        const contact = this.locations.locations().find((item) => item.assignment.idUsuario === userId);
        if (contact) this.center.set({ lat: contact.location.latitud, lng: contact.location.longitud });
        else if (own) this.center.set(own);
      }
      if (!this.canShowMap()) this.mapInstance = null;
      if (this.ready()) {
        this.updateMarkers();
      }
    });
    effect(() => {
      this.selectedUserId();
      this.locations.locations();
      this.ownPosition();
      this.locating();
      this.focusSelected();
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
      this.ownPosition.set(null);
      this.locationMessage.set('La geolocalización no está disponible en este navegador.');
      this.updateMarkers();
      return;
    }

    this.locating.set(true);
    this.ownPosition.set(null);
    this.locationMessage.set(null);
    geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = { lat: coords.latitude, lng: coords.longitude };
        this.ownPosition.set(position);
        if (this.selectedUserId() === null) this.center.set(position);
        this.locating.set(false);
        this.locationMessage.set(null);
        this.updateMarkers();
      },
      () => {
        this.locating.set(false);
        this.ownPosition.set(null);
        this.locationMessage.set('No pudimos acceder a tu ubicación. Puedes habilitar el permiso y reintentar.');
        this.updateMarkers();
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000 },
    );
  }

  protected onMapInitialized(map: google.maps.Map): void {
    this.mapInstance = map;
    this.focusSelected();
  }

  protected selectMarker(marker: ReadyMarker): void {
    this.selectedMarkerId.set(marker.id);
  }

  protected closeDetails(): void {
    const id = this.selectedMarkerId();
    this.selectedMarkerId.set(null);
    const buttons = this.markerAccess()?.nativeElement.querySelectorAll<HTMLButtonElement>('button');
    const trigger = Array.from(buttons ?? []).find((button) => button.dataset['markerId'] === id);
    (trigger ?? this.markerAccess()?.nativeElement)?.focus();
  }

  protected relativeTime(value?: string): string {
    if (!value) return 'No disponible';
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return 'No disponible';
    const minutes = Math.max(0, Math.floor((this.now() - timestamp) / 60_000));
    if (minutes < 1) return 'Hace menos de un minuto';
    if (minutes < 60) return `Hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
  }

  private initials(firstName: string, lastName: string): string {
    const first = firstName.trim().match(/\p{L}/u)?.[0] ?? '';
    const last = lastName.trim().match(/\p{L}/u)?.[0] ?? '';
    return `${first}${last}`.toLocaleUpperCase('es') || '?';
  }

  private focusSelected(): void {
    const userId = this.selectedUserId();
    const own = this.ownPosition();
    if (userId === null || !this.mapInstance || (this.fittedUserId === userId && (!own || this.fittedWithOwn))) return;
    const contactLocations = this.locations.locations().filter((item) => item.assignment.idUsuario === userId);
    if (contactLocations.length === 0) return;

    const positions = contactLocations.map((item) => ({ lat: item.location.latitud, lng: item.location.longitud }));
    if (own) positions.push(own);
    if (positions.length === 1) {
      this.mapInstance.setCenter(positions[0]);
      this.mapInstance.setZoom(15);
    } else {
      const bounds = new google.maps.LatLngBounds();
      for (const position of positions) bounds.extend(position);
      this.mapInstance.fitBounds(bounds, 72);
    }
    this.fittedUserId = userId;
    this.fittedWithOwn = !!own;
  }

  private updateMarkers(): void {
    if (!globalThis.google?.maps) {
      return;
    }

    const selectedUserId = this.selectedUserId();
    const visibleLocations = selectedUserId === null
      ? this.locations.locations()
      : this.locations.locations().filter((item) => item.assignment.idUsuario === selectedUserId);
    const contacts = this.overview.contacts();
    const me = this.session.user();
    const privatePoints: MapPoint[] = visibleLocations.map((item) => {
      const user = item.assignment.idUsuario === me?.idUsuario
        ? me
        : contacts.find((record) => record.contacto.idUsuario === item.assignment.idUsuario)?.contacto;
      return {
        id: String(item.assignment.idUsuarioDispositivo),
        title: user ? `${user.nombres} ${user.apellidos}`.trim() : 'Dispositivo autorizado',
        initials: user ? this.initials(user.nombres, user.apellidos) : '?',
        status: item.emergenciaActiva ? 'emergencia' : 'conectado',
        position: { lat: item.location.latitud, lng: item.location.longitud },
      };
    });
    const publicPoints: MapPoint[] = this.publicLocations().map((item) => ({
      id: `public-${item.clavePublica}`,
      title: item.origen === 'EMERGENCIA' ? 'Emergencia pública' : 'Ubicación pública',
      initials: item.origen === 'EMERGENCIA' ? 'SOS' : 'GPS',
      status: item.origen === 'EMERGENCIA' ? 'emergencia' : 'conectado',
      position: { lat: item.ubicacion.latitud, lng: item.ubicacion.longitud },
    }));
    const points = this.session.isAuthenticated() ? privatePoints : publicPoints;
    const visibleById = new Map(visibleLocations.map((item) => [String(item.assignment.idUsuarioDispositivo), item]));
    const publicById = new Map(this.publicLocations().map((item) => [`public-${item.clavePublica}`, item]));

    const currentPosition = this.ownPosition();
    if (currentPosition) {
      points.unshift({
        id: 'tu',
        title: me ? `${me.nombres} ${me.apellidos}`.trim() : 'Tu ubicación',
        initials: me ? this.initials(me.nombres, me.apellidos) : 'TÚ',
        status: 'yo',
        position: currentPosition,
      });
    }

    this.markers.set(
      points.map((point) => ({
        id: point.id,
        title: point.title,
        kind: point.id === 'tu' ? 'self' : point.id.startsWith('public-') ? 'public' : 'private',
        deviceLabel: visibleById.get(point.id)?.assignment.alias ?? undefined,
        updatedAt: visibleById.get(point.id)?.location.fechaHoraDispositivo ??
          publicById.get(point.id)?.ubicacion.fechaHoraDispositivo,
        position: point.position,
        options: markerOptions(point),
      })),
    );
  }
}
