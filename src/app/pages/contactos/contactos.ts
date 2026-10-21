import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ContactRecord, ContactsApi, PublicUser } from '../../core/contacts/contacts-api';
import { LocationsStore } from '../../core/locations/locations-store';

@Component({
  selector: 'app-contactos',
  imports: [RouterLink],
  templateUrl: './contactos.html',
  styleUrl: './contactos.scss',
})
export class Contactos {
  private readonly api = inject(ContactsApi);
  private readonly locations = inject(LocationsStore);
  private readonly destroyRef = inject(DestroyRef);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchGeneration = 0;
  protected readonly contacts = signal<ContactRecord[]>([]);
  protected readonly requests = signal<ContactRecord[]>([]);
  protected readonly results = signal<PublicUser[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly busy = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly received = computed(() => this.requests().filter((r) => !r.soySolicitante));
  protected readonly sent = computed(() => this.requests().filter((r) => r.soySolicitante));
  protected readonly filteredContacts = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase('es');
    return this.contacts().filter((record) =>
      `${record.contacto.nombres} ${record.contacto.apellidos}`.toLocaleLowerCase('es').includes(term),
    );
  });

  constructor() {
    void this.refresh();
    effect(() => {
      if (this.locations.notificationVersion() > 0) void this.refresh();
    });
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchGeneration++;
    });
  }

  protected name(user: PublicUser): string {
    return `${user.nombres} ${user.apellidos}`;
  }

  protected isKnown(user: PublicUser): boolean {
    return [...this.contacts(), ...this.requests()].some(
      (record) => record.contacto.idUsuario === user.idUsuario,
    );
  }

  protected updateSearch(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.searchTerm.set(term);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const generation = ++this.searchGeneration;
    if (term.trim().length < 2) {
      this.results.set([]);
      return;
    }
    this.searchTimer = setTimeout(async () => {
      try {
        const results = await firstValueFrom(this.api.search(term.trim()));
        if (generation === this.searchGeneration) this.results.set(results);
      } catch {
        if (generation === this.searchGeneration) this.error.set('No se pudo buscar usuarios.');
      }
    }, 300);
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const [contacts, requests] = await Promise.all([
        firstValueFrom(this.api.list()),
        firstValueFrom(this.api.requests()),
      ]);
      this.contacts.set(contacts);
      this.requests.set(requests);
      this.error.set(null);
    } catch {
      this.error.set('No se pudieron cargar los contactos.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async send(user: PublicUser): Promise<void> {
    await this.act(() => firstValueFrom(this.api.request(user.idUsuario)));
  }

  protected async respond(record: ContactRecord, action: 'accept' | 'reject' | 'cancel'): Promise<void> {
    await this.act(() => firstValueFrom(this.api.respond(record.idUsuarioContacto, action)));
  }

  protected async toggleSharing(record: ContactRecord): Promise<void> {
    await this.act(() => firstValueFrom(this.api.share(record.idUsuarioContacto, !record.yoCompartoUbicacion)));
    void this.locations.refresh();
  }

  protected async remove(record: ContactRecord): Promise<void> {
    if (!globalThis.confirm(`¿Eliminar a ${this.name(record.contacto)} de tus contactos?`)) return;
    await this.act(() => firstValueFrom(this.api.remove(record.idUsuarioContacto)));
    void this.locations.refresh();
  }

  private async act(action: () => Promise<unknown>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await action();
      await this.refresh();
    } catch (error) {
      this.error.set(
        error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
          ? error.error.message
          : 'No se pudo completar la acción. Inténtalo de nuevo.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
