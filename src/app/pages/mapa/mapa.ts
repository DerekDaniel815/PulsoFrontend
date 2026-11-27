import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { SessionStore } from '../../core/auth/session-store';
import { LocationsStore } from '../../core/locations/locations-store';
import { OverviewStore } from '../../core/overview/overview-store';
import { LiveMap } from '../../shared/live-map/live-map';

@Component({
  selector: 'app-mapa',
  imports: [LiveMap, RouterLink],
  templateUrl: './mapa.html',
  styleUrl: './mapa.scss',
})
export class Mapa {
  protected readonly locations = inject(LocationsStore);
  private readonly overview = inject(OverviewStore);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly selectedUserId = computed(() => {
    const raw = this.params().get('usuario');
    if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
    const id = Number(raw);
    return Number.isSafeInteger(id) ? id : null;
  });
  protected readonly selectedLocations = computed(() =>
    this.locations.locations().filter((item) => item.assignment.idUsuario === this.selectedUserId()),
  );
  protected readonly personName = computed(() => {
    const id = this.selectedUserId();
    const own = this.session.user();
    if (id === own?.idUsuario) return `${own.nombres} ${own.apellidos}`;
    const contact = this.overview.contacts().find((item) => item.contacto.idUsuario === id)?.contacto;
    return contact ? `${contact.nombres} ${contact.apellidos}` : 'usuario autorizado';
  });
  protected readonly refreshing = signal(true);

  constructor() {
    void this.locations.refresh().finally(() => this.refreshing.set(false));
    void this.overview.refresh();
  }
}
