import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LocationsStore } from '../../core/locations/locations-store';
import { NotificationRecord, NotificationsApi } from '../../core/notifications/notifications-api';
import { OverviewStore } from '../../core/overview/overview-store';
import { RouterLink } from '@angular/router';

type AlertFilter = 'all' | 'unread' | 'critical' | 'warning' | 'info';

@Component({
  selector: 'app-alertas',
  imports: [DatePipe, RouterLink],
  templateUrl: './alertas.html',
  styleUrl: './alertas.scss',
})
export class Alertas {
  private readonly api = inject(NotificationsApi);
  private readonly locations = inject(LocationsStore);
  private readonly overview = inject(OverviewStore);
  protected readonly alerts = signal<NotificationRecord[]>([]);
  protected readonly selectedFilter = signal<AlertFilter>('all');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly unreadCount = computed(() => this.alerts().filter((item) => !item.leida).length);
  protected readonly counts = computed(() => ({
    critical: this.alerts().filter((item) => this.severity(item) === 'critical').length,
    warning: this.alerts().filter((item) => this.severity(item) === 'warning').length,
    info: this.alerts().filter((item) => this.severity(item) === 'info').length,
  }));
  protected readonly filtered = computed(() => {
    const filter = this.selectedFilter();
    if (filter === 'all') return this.alerts();
    if (filter === 'unread') return this.alerts().filter((item) => !item.leida);
    return this.alerts().filter((item) => this.severity(item) === filter);
  });

  protected severity(item: NotificationRecord): 'critical' | 'warning' | 'info' {
    const type = item.tipo.toUpperCase();
    if (type.includes('SOS') || type.includes('EMERGENCIA')) return 'critical';
    if (type.includes('DESCONEX') || type.includes('ALERTA') || type.includes('ADVERTENCIA')) return 'warning';
    return 'info';
  }

  constructor() {
    effect(() => {
      this.locations.notificationVersion();
      void this.refresh();
    });
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.alerts.set(await firstValueFrom(this.api.list()));
      this.error.set(null);
    } catch {
      this.error.set('No se pudieron cargar las notificaciones.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async markRead(item: NotificationRecord): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.read(item.idNotificacionUsuario));
      await this.refresh();
      void this.overview.refresh();
    } catch {
      this.error.set('No se pudo marcar la notificación como leída.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async markAllRead(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.readAll());
      await this.refresh();
      void this.overview.refresh();
    } catch {
      this.error.set('No se pudieron actualizar las notificaciones.');
    } finally {
      this.busy.set(false);
    }
  }
}
