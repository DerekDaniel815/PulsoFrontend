import { HttpClient } from '@angular/common/http';
import { Service, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PULSO_API_URL } from '../auth/auth.config';
import { SessionStore } from '../auth/session-store';
import { ContactRecord, ContactsApi } from '../contacts/contacts-api';
import { LocationsStore } from '../locations/locations-store';
import { NotificationRecord, NotificationsApi } from '../notifications/notifications-api';

export interface ActiveEmergency {
  idEmergencia: string;
  idUsuarioDispositivo: number;
  descripcion: string | null;
  fechaInicio: string;
  estado: string;
}

@Service()
export class OverviewStore {
  private readonly http = inject(HttpClient);
  private readonly contactsApi = inject(ContactsApi);
  private readonly notificationsApi = inject(NotificationsApi);
  private readonly session = inject(SessionStore);
  private readonly locations = inject(LocationsStore);
  private generation = 0;

  readonly contacts = signal<ContactRecord[]>([]);
  readonly emergencies = signal<ActiveEmergency[]>([]);
  readonly notifications = signal<NotificationRecord[]>([]);
  readonly unreadCount = signal(0);

  constructor() {
    effect(() => {
      const active = this.session.isAuthenticated();
      this.locations.notificationVersion();
      if (!active) {
        this.generation++;
        this.contacts.set([]);
        this.emergencies.set([]);
        this.notifications.set([]);
        this.unreadCount.set(0);
        return;
      }
      void this.refresh();
    });
  }

  async refresh(): Promise<void> {
    if (!this.session.isAuthenticated()) return;
    const generation = ++this.generation;
    const [contacts, emergencies, notifications, unread] = await Promise.allSettled([
      firstValueFrom(this.contactsApi.list()),
      firstValueFrom(this.http.get<ActiveEmergency[]>(`${PULSO_API_URL}/emergencies/active`)),
      firstValueFrom(this.notificationsApi.list()),
      firstValueFrom(this.http.get<{ count: number }>(`${PULSO_API_URL}/notifications/unread-count`)),
    ]);
    if (generation !== this.generation || !this.session.isAuthenticated()) return;
    if (contacts.status === 'fulfilled') this.contacts.set(contacts.value);
    if (emergencies.status === 'fulfilled') this.emergencies.set(emergencies.value);
    if (notifications.status === 'fulfilled') this.notifications.set(notifications.value);
    if (unread.status === 'fulfilled') this.unreadCount.set(unread.value.count);
  }
}
