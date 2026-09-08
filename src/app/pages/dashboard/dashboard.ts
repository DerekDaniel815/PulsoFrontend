import { Component, DestroyRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LayoutMode } from '../../layout/layout-mode';
import { LiveMap } from '../../shared/live-map/live-map';
import { DASHBOARD_ACTIVITY, DASHBOARD_CONTACTS } from './dashboard.data';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, LiveMap],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly destroyRef = inject(DestroyRef);
  private readonly layout = inject(LayoutMode);

  protected readonly contacts = DASHBOARD_CONTACTS;
  protected readonly activity = DASHBOARD_ACTIVITY;
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
