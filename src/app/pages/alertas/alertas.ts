import { DatePipe } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SessionStore } from '../../core/auth/session-store';
import { LocationsStore } from '../../core/locations/locations-store';
import { NotificationRecord, NotificationsApi } from '../../core/notifications/notifications-api';
import { OverviewStore } from '../../core/overview/overview-store';
import { RouterLink } from '@angular/router';

type AlertFilter = 'all' | 'unread' | 'critical' | 'warning' | 'info';
const PAGE_SIZE = 5;

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
  private readonly session = inject(SessionStore);
  private readonly pageSummary = viewChild<ElementRef<HTMLElement>>('pageSummary');
  private requestGeneration = 0;
  private failedOffset = 0;
  protected readonly globalUnreadCount = this.overview.unreadCount;
  protected readonly alerts = signal<NotificationRecord[]>([]);
  protected readonly selectedFilter = signal<AlertFilter>('all');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly loadError = signal(false);
  protected readonly pageIndex = signal(0);
  protected readonly hasNextPage = signal(false);
  protected readonly pageNumber = computed(() => this.pageIndex() + 1);
  protected readonly resultStart = computed(() => this.alerts().length ? this.pageIndex() * PAGE_SIZE + 1 : 0);
  protected readonly resultEnd = computed(() => this.pageIndex() * PAGE_SIZE + this.alerts().length);
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
      const userId = this.session.user()?.idUsuario;
      const token = this.session.token();
      const isUser = this.session.isAuthenticated() && this.session.user()?.rol === 'USUARIO';
      this.locations.notificationVersion();
      if (!isUser || userId === undefined || !token) {
        this.requestGeneration++;
        this.alerts.set([]);
        this.pageIndex.set(0);
        this.hasNextPage.set(false);
        this.error.set(null);
        this.loadError.set(false);
        this.loading.set(false);
        return;
      }
      untracked(() => this.reloadFirstPage());
    });
  }

  protected async refresh(): Promise<void> {
    await this.loadPage(this.pageIndex() * PAGE_SIZE);
  }

  protected retryLoad(): void {
    void this.loadPage(this.failedOffset);
  }

  protected selectFilter(filter: AlertFilter): void {
    const previous = this.selectedFilter();
    if (filter === previous) return;
    this.selectedFilter.set(filter);
    if (this.pageIndex() === 0 && this.source(previous) === this.source(filter) &&
        !this.loading() && !this.error()) return;
    this.reloadFirstPage();
  }

  protected goToPage(direction: -1 | 1): void {
    if (this.loading() || this.busy() ||
        (direction < 0 && this.pageIndex() === 0) ||
        (direction > 0 && !this.hasNextPage())) return;
    void this.loadPage((this.pageIndex() + direction) * PAGE_SIZE, true);
  }

  private source(filter: AlertFilter): 'all' | 'unread' {
    return filter === 'unread' ? 'unread' : 'all';
  }

  private reloadFirstPage(): void {
    this.requestGeneration++;
    this.pageIndex.set(0);
    this.alerts.set([]);
    this.hasNextPage.set(false);
    void this.loadPage(0);
  }

  private async loadPage(offset: number, focusSummary = false): Promise<void> {
    if (!this.session.isAuthenticated() || this.session.user()?.rol !== 'USUARIO') return;
    const generation = ++this.requestGeneration;
    const userId = this.session.user()?.idUsuario;
    const token = this.session.token();
    const source = this.source(this.selectedFilter());
    this.loading.set(true);
    this.error.set(null);
    this.loadError.set(false);
    try {
      const alerts = await firstValueFrom(source === 'unread'
        ? this.api.unread(PAGE_SIZE, offset)
        : this.api.list(PAGE_SIZE, offset));
      if (generation !== this.requestGeneration || this.session.user()?.idUsuario !== userId ||
          this.session.token() !== token || this.source(this.selectedFilter()) !== source) return;
      if (!alerts.length && offset > 0) {
        if (this.pageIndex() * PAGE_SIZE === offset) {
          await this.loadPage(offset - PAGE_SIZE, true);
        } else {
          this.hasNextPage.set(false);
          if (focusSummary) queueMicrotask(() => this.pageSummary()?.nativeElement.focus());
        }
        return;
      }
      this.alerts.set(alerts);
      this.pageIndex.set(offset / PAGE_SIZE);
      this.hasNextPage.set(alerts.length === PAGE_SIZE);
      if (focusSummary) queueMicrotask(() => this.pageSummary()?.nativeElement.focus());
    } catch {
      if (generation === this.requestGeneration) {
        this.failedOffset = offset;
        this.error.set('No se pudieron cargar las notificaciones.');
        this.loadError.set(true);
      }
    } finally {
      if (generation === this.requestGeneration) this.loading.set(false);
    }
  }

  protected async markRead(item: NotificationRecord): Promise<void> {
    if (this.busy()) return;
    const userId = this.session.user()?.idUsuario;
    const token = this.session.token();
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.read(item.idNotificacion));
      if (this.session.user()?.idUsuario !== userId || this.session.token() !== token) return;
      await this.refresh();
      void this.overview.refresh();
    } catch {
      if (this.session.user()?.idUsuario === userId && this.session.token() === token) {
        this.error.set('No se pudo marcar la notificación como leída.');
        this.loadError.set(false);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async markAllRead(): Promise<void> {
    if (this.busy() || !this.globalUnreadCount()) return;
    const userId = this.session.user()?.idUsuario;
    const token = this.session.token();
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.readAll());
      if (this.session.user()?.idUsuario !== userId || this.session.token() !== token) return;
      if (this.selectedFilter() === 'unread') this.reloadFirstPage();
      else await this.refresh();
      void this.overview.refresh();
    } catch {
      if (this.session.user()?.idUsuario === userId && this.session.token() === token) {
        this.error.set('No se pudieron actualizar las notificaciones.');
        this.loadError.set(false);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
