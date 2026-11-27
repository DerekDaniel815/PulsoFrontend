import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../core/auth/session-store';
import { LocationsStore } from '../../core/locations/locations-store';
import { OverviewStore } from '../../core/overview/overview-store';
import { LayoutMode } from '../../layout/layout-mode';
import { LiveMap } from '../../shared/live-map/live-map';
import { EmergencyControls } from './emergency-controls';
import { PublicEmergencyLookup } from './public-emergency-lookup';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, LiveMap, DatePipe, EmergencyControls, PublicEmergencyLookup],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly destroyRef = inject(DestroyRef);
  private readonly layout = inject(LayoutMode);
  private readonly mobileViewport = globalThis.matchMedia?.('(max-width: 960px)');
  protected readonly isMobile = signal(this.mobileViewport?.matches ?? false);
  protected readonly isAuthenticated = inject(SessionStore).isAuthenticated;

  protected readonly locationStore = inject(LocationsStore);
  protected readonly overview = inject(OverviewStore);
  protected readonly locations = this.locationStore.locations;
  protected readonly activeEmergency = computed(() => this.overview.emergencies()[0] ?? null);
  protected readonly mapExpanded = this.layout.mapExpanded;

  constructor() {
    const onViewportChange = (event: MediaQueryListEvent) => this.isMobile.set(event.matches);
    this.mobileViewport?.addEventListener('change', onViewportChange);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.mapExpanded()) {
        this.layout.setMapExpanded(false);
        this.refreshMapSize();
      }
    };
    document.addEventListener('keydown', onKey);
    this.destroyRef.onDestroy(() => {
      this.mobileViewport?.removeEventListener('change', onViewportChange);
      document.removeEventListener('keydown', onKey);
      this.layout.setMapExpanded(false);
    });
  }

  protected toggleMapExpand(): void {
    this.layout.setMapExpanded(!this.mapExpanded());
    this.refreshMapSize();
  }

  private refreshMapSize(): void {
    setTimeout(() => window.dispatchEvent(new Event('resize')), 80);
  }
}
