import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CONTACT_STATUS_LABELS, CONTACTS, ContactGroup, ContactStatus } from './contactos.data';

type GroupFilter = 'Todos' | ContactGroup;
type StatusFilter = 'all' | ContactStatus;
type ViewMode = 'list' | 'grid';

@Component({
  selector: 'app-contactos',
  imports: [RouterLink],
  templateUrl: './contactos.html',
  styleUrl: './contactos.scss',
})
export class Contactos {
  protected readonly contacts = CONTACTS;
  protected readonly statusLabels = CONTACT_STATUS_LABELS;
  protected readonly groups: readonly GroupFilter[] = [
    'Todos',
    'Familia',
    'Amigos',
    'Emergencias',
    'Equipo',
  ];
  protected readonly searchTerm = signal('');
  protected readonly selectedGroup = signal<GroupFilter>('Todos');
  protected readonly selectedStatus = signal<StatusFilter>('all');
  protected readonly viewMode = signal<ViewMode>('list');
  protected readonly activeContacts = computed(
    () => this.contacts.filter((contact) => contact.locationActive).length,
  );
  protected readonly filteredContacts = computed(() => {
    const search = this.searchTerm().trim().toLocaleLowerCase('es');
    const group = this.selectedGroup();
    const status = this.selectedStatus();

    return this.contacts.filter((contact) => {
      const matchesSearch =
        !search ||
        contact.name.toLocaleLowerCase('es').includes(search) ||
        contact.address.toLocaleLowerCase('es').includes(search);
      const matchesGroup = group === 'Todos' || contact.group === group;
      const matchesStatus = status === 'all' || contact.status === status;

      return matchesSearch && matchesGroup && matchesStatus;
    });
  });

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.currentTarget as HTMLInputElement).value);
  }

  protected selectGroup(group: GroupFilter): void {
    this.selectedGroup.set(group);
  }

  protected selectStatus(event: Event): void {
    this.selectedStatus.set((event.currentTarget as HTMLSelectElement).value as StatusFilter);
  }

  protected setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }
}
