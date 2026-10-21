import { Component, computed, inject, signal } from '@angular/core';
import { SessionStore } from '../../core/auth/session-store';
import { SafeZone, SafeZoneTone } from './zonas-seguras.data';

@Component({
  selector: 'app-zonas-seguras',
  templateUrl: './zonas-seguras.html',
  styleUrl: './zonas-seguras.scss',
})
export class ZonasSeguras {
  private readonly session = inject(SessionStore);
  private readonly storageKey = `pulso.zonas-locales.${this.session.user()?.idUsuario ?? 'anonimo'}`;
  protected readonly zones = signal<readonly SafeZone[]>(this.readZones());
  protected readonly selectedZoneId = signal<number | null>(this.zones()[0]?.id ?? null);
  protected readonly showForm = signal(false);
  protected readonly name = signal('');
  protected readonly address = signal('');
  protected readonly radius = signal(100);
  protected readonly activeZones = computed(() => this.zones().filter((zone) => zone.active));
  protected readonly selectedZone = computed(() => this.zones().find((zone) => zone.id === this.selectedZoneId()) ?? null);

  protected updateName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  protected updateAddress(event: Event): void {
    this.address.set((event.target as HTMLInputElement).value);
  }

  protected updateRadius(event: Event): void {
    this.radius.set(Number((event.target as HTMLInputElement).value));
  }

  protected addZone(): void {
    const name = this.name().trim();
    const radius = this.radius();
    if (!name || !Number.isFinite(radius) || radius < 25 || radius > 2000) return;
    const id = Math.max(Date.now(), ...this.zones().map((zone) => zone.id + 1));
    const index = this.zones().length;
    const tones: SafeZoneTone[] = ['success', 'warning', 'primary', 'shield'];
    const zone: SafeZone = {
      id, name, address: this.address().trim(), radius, nearbyContacts: 0,
      icon: '⌖', active: true, tone: tones[index % tones.length],
      mapX: 28 + (index % 3) * 23, mapY: 30 + (Math.floor(index / 3) % 3) * 20,
      mapSize: Math.min(45, Math.max(18, radius / 10)),
    };
    this.save([...this.zones(), zone]);
    this.selectedZoneId.set(id);
    this.name.set('');
    this.address.set('');
    this.radius.set(100);
    this.showForm.set(false);
  }

  protected selectZone(zoneId: number): void {
    this.selectedZoneId.set(zoneId);
  }

  protected toggleZone(zoneId: number): void {
    this.save(this.zones().map((zone) => zone.id === zoneId ? { ...zone, active: !zone.active } : zone));
  }

  protected removeZone(zone: SafeZone): void {
    if (!globalThis.confirm(`¿Eliminar la zona local ${zone.name}?`)) return;
    const updated = this.zones().filter((item) => item.id !== zone.id);
    this.save(updated);
    if (this.selectedZoneId() === zone.id) this.selectedZoneId.set(updated[0]?.id ?? null);
  }

  private save(zones: readonly SafeZone[]): void {
    this.zones.set(zones);
    try { globalThis.localStorage?.setItem(this.storageKey, JSON.stringify(zones)); } catch { /* Modo privado: conservar en memoria. */ }
  }

  private readZones(): readonly SafeZone[] {
    try {
      const stored = JSON.parse(globalThis.localStorage?.getItem(this.storageKey) ?? '[]') as unknown;
      if (!Array.isArray(stored)) return [];
      return stored.filter((item): item is SafeZone =>
        typeof item === 'object' && item !== null &&
        typeof item.id === 'number' && typeof item.name === 'string' &&
        typeof item.radius === 'number' && typeof item.active === 'boolean' &&
        typeof item.mapX === 'number' && typeof item.mapY === 'number' &&
        typeof item.mapSize === 'number',
      );
    } catch { return []; }
  }
}
