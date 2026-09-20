import { Component, computed, signal } from '@angular/core';
import { ALERTS, AlertSeverity } from './alertas.data';

type AlertFilter = 'all' | 'unread' | AlertSeverity;

const FILTER_LABELS: Record<AlertFilter, string> = {
  all: 'Todas las alertas',
  unread: 'Sin leer',
  critical: 'Críticas',
  warning: 'Advertencias',
  info: 'Información',
};

@Component({
  selector: 'app-alertas',
  templateUrl: './alertas.html',
  styleUrl: './alertas.scss',
})
export class Alertas {
  protected readonly alerts = ALERTS;
  protected readonly selectedFilter = signal<AlertFilter>('unread');

  protected readonly counts = computed(() => ({
    unread: this.alerts.filter((alert) => !alert.read).length,
    critical: this.alerts.filter((alert) => alert.severity === 'critical').length,
    warning: this.alerts.filter((alert) => alert.severity === 'warning').length,
    info: this.alerts.filter((alert) => alert.severity === 'info').length,
  }));

  protected readonly filteredAlerts = computed(() => {
    const filter = this.selectedFilter();

    if (filter === 'all') {
      return this.alerts;
    }

    if (filter === 'unread') {
      return this.alerts.filter((alert) => !alert.read);
    }

    return this.alerts.filter((alert) => alert.severity === filter);
  });

  protected readonly activeFilterLabel = computed(() => FILTER_LABELS[this.selectedFilter()]);

  protected selectFilter(filter: AlertFilter): void {
    this.selectedFilter.set(filter);
  }
}
