import { Component, DestroyRef, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../core/auth/session-store';
import { LocationsStore } from '../../core/locations/locations-store';
import { OverviewStore } from '../../core/overview/overview-store';
import { LayoutMode } from '../../layout/layout-mode';
import { LiveMap } from '../../shared/live-map/live-map';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, LiveMap, DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly destroyRef = inject(DestroyRef);
  private readonly layout = inject(LayoutMode);
  protected readonly isAuthenticated = inject(SessionStore).isAuthenticated;

  protected readonly locationStore = inject(LocationsStore);
  protected readonly overview = inject(OverviewStore);
  protected readonly locations = this.locationStore.locations;
  protected readonly activeEmergency = computed(() => this.overview.emergencies()[0] ?? null);
  protected readonly mapExpanded = this.layout.mapExpanded;

  constructor() {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.mapExpanded()) {
        this.layout.setMapExpanded(false);
        this.refreshMapSize();
      }
    };
    document.addEventListener('keydown', onKey);
    this.destroyRef.onDestroy(() => {
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
