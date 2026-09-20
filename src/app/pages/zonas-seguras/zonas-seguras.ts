import { Component, computed, signal } from '@angular/core';
import { SAFE_ZONES } from './zonas-seguras.data';

@Component({
  selector: 'app-zonas-seguras',
  templateUrl: './zonas-seguras.html',
  styleUrl: './zonas-seguras.scss',
})
export class ZonasSeguras {
  protected readonly zones = signal(SAFE_ZONES);
  protected readonly selectedZoneId = signal(SAFE_ZONES[0].id);
  protected readonly activeZones = computed(() => this.zones().filter((zone) => zone.active));
  protected readonly nearbyContacts = computed(() =>
    this.zones().reduce((total, zone) => total + zone.nearbyContacts, 0),
  );
  protected readonly selectedZone = computed(
    () => this.zones().find((zone) => zone.id === this.selectedZoneId()) ?? this.zones()[0],
  );

  protected selectZone(zoneId: number): void {
    this.selectedZoneId.set(zoneId);
  }

  protected toggleZone(zoneId: number): void {
    this.zones.update((zones) =>
      zones.map((zone) => (zone.id === zoneId ? { ...zone, active: !zone.active } : zone)),
    );
  }
}
