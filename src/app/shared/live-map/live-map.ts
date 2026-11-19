import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { firstValueFrom } from 'rxjs';
import { PULSO_API_URL } from '../../core/auth/auth.config';
import { SessionStore } from '../../core/auth/session-store';
import { GoogleMapsLoader } from '../../core/maps/google-maps.loader';
import { isApproximateLocation, locationStatus } from '../../core/locations/location-status';
import { LocationData, LocationsStore } from '../../core/locations/locations-store';
import { DARK_MAP_STYLES, MAP_BACKGROUND, MAP_CENTER, MapPoint, markerOptions } from '../../core/maps/map-theme';
import { OverviewStore } from '../../core/overview/overview-store';

interface ReadyMarker {
  id: string;
  title: string;
  deviceLabel?: string;
  updatedAt?: string;
  observation?: LocationData;
  emergencyActive?: boolean;
  publicCode?: string;
  kind: 'self' | 'private' | 'public';
  position: google.maps.LatLngLiteral;
  options: google.maps.MarkerOptions;
}

interface PublicLocation {
  clavePublica: string;
  origen: 'PUBLICO' | 'EMERGENCIA';
  codigoPublico?: string | null;
  ubicacion: { latitud: number; longitud: number; fechaHoraDispositivo?: string };
}

interface PublicEmergency {
  clavePublica: string;
  codigoPublico: string;
  estado: string;
  ubicacion: PublicLocation['ubicacion'] | null;
}

@Component({
  selector: 'app-live-map',
  imports: [GoogleMap, MapMarker, DatePipe],
  templateUrl: './live-map.html',
  styleUrl: './live-map.scss',
})
export class LiveMap {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly loader = inject(GoogleMapsLoader);
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionStore);
  private readonly overview = inject(OverviewStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mapFocus = viewChild<ElementRef<HTMLElement>>('mapFocus');
  private readonly emptyMap = viewChild<ElementRef<HTMLElement>>('emptyMap');
  private readonly detailsTitle = viewChild<ElementRef<HTMLElement>>('detailsTitle');
  private readonly publicLocations = signal<PublicLocation[]>([]);
  protected readonly unlocatedEmergencies = signal<PublicEmergency[]>([]);
  protected readonly publicError = signal(false);
  private publicGeneration = 0;
  private publicFetchVersion = 0;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private focusReturn: HTMLElement | null = null;
  private focusOnOpen = false;
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
    return userId === null || this.locations.locations().some((item) => item.assignment.idUsuario === userId);
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
  protected readonly hoveredMarkerId = signal<string | null>(null);
  protected readonly previewPosition = signal<{ left: number; top: number } | null>(null);
  protected readonly expandedMarkerId = signal<string | null>(null);
  protected readonly selectedMarker = computed(() =>
    this.markers().find((marker) => marker.id === (this.selectedMarkerId() ?? this.hoveredMarkerId())) ?? null,
  );
  private readonly now = signal(Date.now());

  constructor() {
    void this.init();
    const clock = setInterval(() => this.now.set(Date.now()), 30_000);
    this.destroyRef.onDestroy(() => {
      clearInterval(clock);
      this.cancelPreviewHide();
    });
    effect(() => {
      if (this.selectedMarkerId() && this.focusOnOpen && this.detailsTitle()) {
        this.detailsTitle()?.nativeElement.focus();
        this.focusOnOpen = false;
      }
    });
    effect(() => {
      const id = this.selectedMarkerId();
      if (id && !this.markers().some((marker) => marker.id === id)) {
        this.selectedMarkerId.set(null);
        this.expandedMarkerId.set(null);
        (this.focusReturn?.isConnected ? this.focusReturn :
          this.mapFocus()?.nativeElement ?? this.emptyMap()?.nativeElement)?.focus();
        this.focusReturn = null;
        this.focusOnOpen = false;
      }
      if (this.hoveredMarkerId() && !this.markers().some((marker) => marker.id === this.hoveredMarkerId())) {
        this.hoveredMarkerId.set(null);
        this.cancelPreviewHide();
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
    effect((onCleanup) => {
      const generation = ++this.publicGeneration;
      if (this.session.isAuthenticated()) {
        this.publicLocations.set([]);
        this.unlocatedEmergencies.set([]);
        this.publicError.set(false);
      } else {
        void this.loadPublicLocations(generation);
        const interval = setInterval(() => void this.loadPublicLocations(generation), 30_000);
        onCleanup(() => clearInterval(interval));
      }
    });
  }

  protected async loadPublicLocations(generation = this.publicGeneration): Promise<void> {
    const fetchVersion = ++this.publicFetchVersion;
    const [locations, emergencies] = await Promise.allSettled([
      firstValueFrom(this.http.get<PublicLocation[]>(`${PULSO_API_URL}/locations/public`)),
      firstValueFrom(this.http.get<PublicEmergency[]>(`${PULSO_API_URL}/emergencies/public`)),
    ]);
    if (generation !== this.publicGeneration || fetchVersion !== this.publicFetchVersion ||
        this.session.isAuthenticated()) return;
    if (locations.status === 'rejected' && emergencies.status === 'rejected') {
      this.publicLocations.set([]);
      this.unlocatedEmergencies.set([]);
      this.publicError.set(true);
      return;
    }
    const markers = new Map<string, PublicLocation>();
    if (locations.status === 'fulfilled') {
      for (const location of locations.value) markers.set(location.clavePublica, location);
    }
    if (emergencies.status === 'fulfilled') {
      this.unlocatedEmergencies.set(emergencies.value.filter((item) =>
        item.estado === 'ACTIVA' && (!item.ubicacion ||
          !Number.isFinite(item.ubicacion.latitud) || !Number.isFinite(item.ubicacion.longitud))));
      for (const emergency of emergencies.value) {
        if (emergency.estado !== 'ACTIVA' || !emergency.ubicacion ||
            !Number.isFinite(emergency.ubicacion.latitud) || !Number.isFinite(emergency.ubicacion.longitud)) continue;
        markers.set(emergency.clavePublica, {
          clavePublica: emergency.clavePublica,
          origen: 'EMERGENCIA',
          codigoPublico: emergency.codigoPublico,
          ubicacion: emergency.ubicacion,
        });
      }
    } else {
      this.unlocatedEmergencies.set([]);
    }
    this.publicLocations.set([...markers.values()]);
    this.publicError.set(locations.status === 'rejected' || emergencies.status === 'rejected');
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

  protected showMarkerPreview(marker: ReadyMarker, event?: google.maps.MapMouseEvent): void {
    if (this.selectedMarkerId() === marker.id) return;
    this.cancelPreviewHide();
    this.selectedMarkerId.set(null);
    this.expandedMarkerId.set(null);
    this.focusReturn = null;
    this.focusOnOpen = false;
    this.positionPreview(event);
    this.hoveredMarkerId.set(marker.id);
  }

  protected schedulePreviewHide(marker: ReadyMarker): void {
    if (this.selectedMarkerId() || this.hoveredMarkerId() !== marker.id) return;
    this.cancelPreviewHide();
    this.previewTimer = setTimeout(() => {
      this.hoveredMarkerId.set(null);
      this.previewTimer = null;
    }, 600);
  }

  protected cancelPreviewHide(): void {
    if (this.previewTimer !== null) clearTimeout(this.previewTimer);
    this.previewTimer = null;
  }

  protected onPreviewLeave(): void {
    if (this.selectedMarkerId()) return;
    this.cancelPreviewHide();
    this.hoveredMarkerId.set(null);
  }

  protected selectMarker(marker: ReadyMarker, event?: google.maps.MapMouseEvent): void {
    this.cancelPreviewHide();
    this.positionPreview(event);
    this.hoveredMarkerId.set(null);
    this.focusOnOpen = event?.domEvent instanceof KeyboardEvent;
    this.focusReturn = event?.domEvent.target instanceof HTMLElement && event.domEvent.target.tabIndex >= 0
      ? event.domEvent.target : null;
    this.selectedMarkerId.set(marker.id);
    this.expandedMarkerId.set(null);
  }

  protected toggleMarkerDetails(markerId: string): void {
    this.cancelPreviewHide();
    if (this.expandedMarkerId() !== markerId) {
      this.hoveredMarkerId.set(null);
      this.selectedMarkerId.set(markerId);
    }
    this.expandedMarkerId.update((current) => current === markerId ? null : markerId);
  }

  protected closeDetails(): void {
    const trigger = this.focusReturn?.isConnected ? this.focusReturn :
      this.mapFocus()?.nativeElement ?? this.emptyMap()?.nativeElement;
    this.cancelPreviewHide();
    this.selectedMarkerId.set(null);
    this.hoveredMarkerId.set(null);
    this.expandedMarkerId.set(null);
    this.focusReturn = null;
    this.focusOnOpen = false;
    trigger?.focus();
  }

  private positionPreview(event?: google.maps.MapMouseEvent): void {
    if (!(event?.domEvent instanceof MouseEvent)) {
      this.previewPosition.set(null);
      return;
    }
    const bounds = this.host.nativeElement.getBoundingClientRect();
    if (bounds.width < 220 || bounds.height < 240) {
      this.previewPosition.set(null);
      return;
    }
    const x = event.domEvent.clientX - bounds.left;
    const y = event.domEvent.clientY - bounds.top;
    const cardWidth = Math.min(310, bounds.width - 24);
    const left = x + cardWidth + 20 < bounds.width ? x + 16 : x - cardWidth - 16;
    this.previewPosition.set({
      left: Math.max(12, Math.min(left, bounds.width - cardWidth - 12)),
      top: Math.max(12, Math.min(y - 60, bounds.height - 220)),
    });
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

  protected validCaptureTime(value?: string): boolean {
    return value !== undefined && Number.isFinite(Date.parse(value));
  }

  protected freshness(location: LocationData): string {
    const state = locationStatus(location, this.now());
    return state === 'recent' ? 'Ubicación reciente' :
      state === 'old' ? 'Última ubicación conocida · puede no ser la posición actual' : 'Vigencia no confirmada';
  }

  protected approximate(location: LocationData): boolean {
    return isApproximateLocation(location);
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
        status: item.emergenciaActiva ? 'emergencia' :
          locationStatus(item.location, this.now()) === 'recent' ? 'conectado' : 'anterior',
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
        observation: visibleById.get(point.id)?.location,
        emergencyActive: visibleById.get(point.id)?.emergenciaActiva,
        publicCode: publicById.get(point.id)?.codigoPublico ?? undefined,
        updatedAt: visibleById.get(point.id)?.location.fechaHoraDispositivo ??
          publicById.get(point.id)?.ubicacion.fechaHoraDispositivo,
        position: point.position,
        options: markerOptions(point),
      })),
    );
  }
}
