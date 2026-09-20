import { Component, computed, signal } from '@angular/core';
import { HISTORY_BY_PERIOD, HistoryPeriod } from './historial.data';

@Component({
  selector: 'app-historial',
  templateUrl: './historial.html',
  styleUrl: './historial.scss',
})
export class Historial {
  protected readonly selectedPeriod = signal<HistoryPeriod>('today');
  protected readonly selectedDate = signal('');
  protected readonly history = computed(() => HISTORY_BY_PERIOD[this.selectedPeriod()]);
  protected readonly routePoints = computed(() =>
    this.history()
      .points.map((point) => `${point.mapX},${point.mapY}`)
      .join(' '),
  );

  protected selectPeriod(period: HistoryPeriod): void {
    this.selectedPeriod.set(period);
    if (period !== 'custom') {
      this.selectedDate.set('');
    }
  }

  protected selectDate(event: Event): void {
    const date = (event.currentTarget as HTMLInputElement).value;
    this.selectedDate.set(date);
    if (date) {
      this.selectedPeriod.set('custom');
    }
  }

  protected exportData(): void {
    const rows = [
      ['Hora', 'Ubicación', 'Actividad', 'Precisión'],
      ...this.history().points.map((point) => [
        point.time,
        point.location,
        point.activity,
        point.accuracy,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial-${this.selectedDate() || this.selectedPeriod()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
