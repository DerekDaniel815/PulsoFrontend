import { Component, signal } from '@angular/core';

type PersonalStatus = 'safe' | 'attention' | 'emergency' | 'unknown';
type GpsPrecision = 'high' | 'balanced' | 'battery';
type UpdateFrequency = '10s' | '30s' | '1m' | '5m';

@Component({
  selector: 'app-configuracion',
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.scss',
})
export class Configuracion {
  protected readonly personalStatus = signal<PersonalStatus>('safe');
  protected readonly gpsEnabled = signal(true);
  protected readonly precision = signal<GpsPrecision>('high');
  protected readonly frequency = signal<UpdateFrequency>('30s');
  protected readonly notificationsEnabled = signal(true);
  protected readonly globalEmergencyEnabled = signal(false);
  protected readonly actionMessage = signal('');

  protected setPersonalStatus(status: PersonalStatus): void {
    this.personalStatus.set(status);
  }

  protected toggleGps(): void {
    this.gpsEnabled.update((enabled) => !enabled);
  }

  protected setPrecision(precision: GpsPrecision): void {
    this.precision.set(precision);
  }

  protected setFrequency(frequency: UpdateFrequency): void {
    this.frequency.set(frequency);
  }

  protected toggleNotifications(): void {
    this.notificationsEnabled.update((enabled) => !enabled);
  }

  protected toggleGlobalEmergency(): void {
    this.globalEmergencyEnabled.update((enabled) => !enabled);
  }

  protected executeAction(message: string): void {
    this.actionMessage.set(message);
  }
}
