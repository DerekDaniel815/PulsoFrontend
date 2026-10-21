import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PULSO_API_URL } from '../../core/auth/auth.config';
import { PulsoUser } from '../../core/auth/auth.models';
import { SessionStore } from '../../core/auth/session-store';

interface UserDevice {
  idUsuarioDispositivo: number;
  alias: string | null;
  ubicacionActiva: boolean;
  visibilidadPreferida: 'SOLO_YO' | 'GRUPO' | 'PUBLICO';
}

@Component({
  selector: 'app-configuracion',
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.scss',
})
export class Configuracion {
  private readonly http = inject(HttpClient);
  protected readonly session = inject(SessionStore);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal(false);
  protected readonly devices = signal<UserDevice[]>([]);
  protected readonly devicesLoading = signal(true);
  protected readonly deviceError = signal<string | null>(null);
  protected readonly updatingDevice = signal<number | null>(null);
  protected readonly nombres = signal('');
  protected readonly apellidos = signal('');
  protected readonly telefono = signal('');
  protected readonly profileName = computed(() => {
    const user = this.session.user();
    return user ? `${user.nombres} ${user.apellidos}`.trim() : '';
  });

  constructor() { void this.loadDevices(); }

  protected async loadDevices(): Promise<void> {
    this.devicesLoading.set(true);
    try {
      this.devices.set(await firstValueFrom(this.http.get<UserDevice[]>(`${PULSO_API_URL}/user-devices/me`)));
      this.deviceError.set(null);
    } catch {
      this.deviceError.set('No se pudieron cargar tus dispositivos.');
    } finally {
      this.devicesLoading.set(false);
    }
  }

  protected async updateDevice(device: UserDevice, change: Partial<Pick<UserDevice, 'ubicacionActiva' | 'visibilidadPreferida'>>): Promise<void> {
    if (this.updatingDevice() !== null) return;
    if (change.visibilidadPreferida === 'PUBLICO' && !globalThis.confirm('Tu ubicación podrá verse públicamente. ¿Deseas continuar?')) return;
    this.updatingDevice.set(device.idUsuarioDispositivo);
    this.deviceError.set(null);
    try {
      const updated = await firstValueFrom(this.http.patch<UserDevice>(
        `${PULSO_API_URL}/user-devices/${device.idUsuarioDispositivo}`, change,
      ));
      this.devices.update((items) => items.map((item) => item.idUsuarioDispositivo === device.idUsuarioDispositivo ? updated : item));
    } catch {
      this.deviceError.set('No se pudo actualizar el dispositivo.');
    } finally {
      this.updatingDevice.set(null);
    }
  }

  protected selectVisibility(device: UserDevice, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const previous = device.visibilidadPreferida;
    void this.updateDevice(device, {
      visibilidadPreferida: select.value as UserDevice['visibilidadPreferida'],
    }).finally(() => { select.value = this.devices().find((item) => item.idUsuarioDispositivo === device.idUsuarioDispositivo)?.visibilidadPreferida ?? previous; });
  }

  protected edit(): void {
    const user = this.session.user();
    if (!user) return;
    this.nombres.set(user.nombres);
    this.apellidos.set(user.apellidos);
    this.telefono.set(user.telefono ?? '');
    this.success.set(false);
    this.editing.set(true);
  }

  protected update(field: 'nombres' | 'apellidos' | 'telefono', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'nombres') this.nombres.set(value);
    if (field === 'apellidos') this.apellidos.set(value);
    if (field === 'telefono') this.telefono.set(value);
  }

  protected async save(): Promise<void> {
    if (this.saving() || !this.nombres().trim() || !this.apellidos().trim()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const user = await firstValueFrom(this.http.patch<PulsoUser>(`${PULSO_API_URL}/users/me`, {
        nombres: this.nombres().trim(),
        apellidos: this.apellidos().trim(),
        telefono: this.telefono().trim(),
      }));
      this.session.setUser(user);
      this.editing.set(false);
      this.success.set(true);
    } catch {
      this.error.set('No se pudo actualizar el perfil.');
    } finally {
      this.saving.set(false);
    }
  }
}
