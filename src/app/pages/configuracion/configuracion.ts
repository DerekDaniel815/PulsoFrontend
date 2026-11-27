import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, computed, effect, inject, signal, viewChild, viewChildren } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PULSO_API_URL } from '../../core/auth/auth.config';
import { PulsoUser } from '../../core/auth/auth.models';
import { SessionStore } from '../../core/auth/session-store';
import { UserDeviceAssignment, UserDevicesApi, isActiveUserDevice } from '../../core/devices/user-devices-api';
import { LocationsStore } from '../../core/locations/locations-store';
import { OverviewStore } from '../../core/overview/overview-store';

@Component({
  selector: 'app-configuracion',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.scss',
})
export class Configuracion {
  private readonly http = inject(HttpClient);
  private readonly userDevices = inject(UserDevicesApi);
  private readonly locations = inject(LocationsStore);
  private readonly overview = inject(OverviewStore);
  private readonly devicesTitle = viewChild<ElementRef<HTMLElement>>('devicesTitle');
  private readonly aliasInput = viewChild<ElementRef<HTMLInputElement>>('aliasInput');
  private readonly aliasEditButtons = viewChildren<ElementRef<HTMLButtonElement>>('aliasEditButton');
  private generation = 0;
  protected readonly session = inject(SessionStore);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal(false);
  protected readonly devices = signal<UserDeviceAssignment[]>([]);
  protected readonly activeDevices = computed(() => this.devices().filter(isActiveUserDevice));
  protected readonly pastDevices = computed(() => this.devices().filter((item) => !isActiveUserDevice(item)));
  protected readonly devicesLoading = signal(true);
  protected readonly deviceError = signal<string | null>(null);
  protected readonly deviceListError = signal(false);
  protected readonly deviceNotice = signal<string | null>(null);
  protected readonly linking = signal(false);
  protected readonly updatingDevice = signal<number | null>(null);
  protected readonly editingAliasId = signal<number | null>(null);
  protected readonly linkForm = new FormGroup({
    codigoDispositivo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    alias: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
  });
  protected readonly aliasControl = new FormControl('', {
    nonNullable: true, validators: [Validators.maxLength(100)],
  });
  protected readonly isUser = computed(() =>
    this.session.isAuthenticated() && this.session.user()?.rol === 'USUARIO');
  protected readonly nombres = signal('');
  protected readonly apellidos = signal('');
  protected readonly telefono = signal('');
  protected readonly profileName = computed(() => {
    const user = this.session.user();
    return user ? `${user.nombres} ${user.apellidos}`.trim() : '';
  });

  constructor() {
    effect(() => {
      const active = this.isUser();
      const generation = ++this.generation;
      this.devices.set([]);
      this.deviceError.set(null);
      this.deviceListError.set(false);
      this.deviceNotice.set(null);
      this.linking.set(false);
      this.updatingDevice.set(null);
      this.editingAliasId.set(null);
      if (active) void this.loadDevices(generation);
      else this.devicesLoading.set(false);
    });
    effect(() => {
      if (this.editingAliasId() !== null) this.aliasInput()?.nativeElement.focus();
    });
  }

  protected async loadDevices(generation = this.generation): Promise<void> {
    if (!this.isUser()) return;
    this.devicesLoading.set(true);
    try {
      const devices = await firstValueFrom(this.userDevices.list());
      if (generation !== this.generation || !this.isUser()) return;
      this.devices.set(devices);
      this.deviceError.set(null);
      this.deviceListError.set(false);
    } catch {
      if (generation === this.generation) {
        this.deviceError.set('No se pudieron cargar tus dispositivos.');
        this.deviceListError.set(true);
      }
    } finally {
      if (generation === this.generation) this.devicesLoading.set(false);
    }
  }

  protected async linkDevice(): Promise<void> {
    if (!this.isUser() || this.linking() || this.updatingDevice() !== null || this.linkForm.invalid) return;
    const form = this.linkForm.getRawValue();
    const codigoDispositivo = form.codigoDispositivo.trim().toUpperCase();
    if (!codigoDispositivo) return;
    const generation = this.generation;
    this.linking.set(true);
    this.deviceError.set(null);
    this.deviceNotice.set(null);
    try {
      const alias = form.alias.trim();
      const linked = await firstValueFrom(this.userDevices.link({
        codigoDispositivo, ...(alias ? { alias } : {}),
      }));
      if (generation !== this.generation || !this.isUser()) return;
      this.devices.update((items) => [linked, ...items]);
      this.linkForm.reset();
      this.deviceNotice.set('GPS vinculado. Ahora puedes gestionar su visibilidad.');
      await this.loadDevices(generation);
      if (generation === this.generation && this.isUser()) {
        void this.locations.refresh();
        void this.overview.refresh();
      }
    } catch (error: unknown) {
      if (generation === this.generation) this.deviceError.set(this.linkError(error));
    } finally {
      if (generation === this.generation) this.linking.set(false);
    }
  }

  protected async updateDevice(device: UserDeviceAssignment, change: Partial<Pick<UserDeviceAssignment, 'alias' | 'ubicacionActiva' | 'visibilidadPreferida'>>): Promise<boolean> {
    if (!this.isUser() || !isActiveUserDevice(device) || this.updatingDevice() !== null || this.linking()) return false;
    if (change.visibilidadPreferida === 'PUBLICO' && !globalThis.confirm('Tu ubicación podrá verse públicamente. ¿Deseas continuar?')) return false;
    const generation = this.generation;
    this.updatingDevice.set(device.idUsuarioDispositivo);
    this.deviceError.set(null);
    try {
      const updated = await firstValueFrom(this.userDevices.update(device.idUsuarioDispositivo, change));
      if (generation !== this.generation || !this.isUser()) return false;
      this.devices.update((items) => items.map((item) =>
        item.idUsuarioDispositivo === device.idUsuarioDispositivo ? updated : item));
      void this.locations.refresh();
      void this.overview.refresh();
      return true;
    } catch {
      if (generation === this.generation) this.deviceError.set('No se pudo actualizar el dispositivo.');
      return false;
    } finally {
      if (generation === this.generation) this.updatingDevice.set(null);
    }
  }

  protected startAliasEdit(device: UserDeviceAssignment): void {
    this.aliasControl.setValue(device.alias ?? '');
    this.editingAliasId.set(device.idUsuarioDispositivo);
  }

  protected async saveAlias(device: UserDeviceAssignment): Promise<void> {
    if (this.editingAliasId() !== device.idUsuarioDispositivo || this.aliasControl.invalid) return;
    const alias = this.aliasControl.value.trim();
    if (alias === (device.alias ?? '')) {
      this.closeAliasEdit(device.idUsuarioDispositivo);
      return;
    }
    if (await this.updateDevice(device, { alias })) {
      this.closeAliasEdit(device.idUsuarioDispositivo);
      this.deviceNotice.set('Alias actualizado.');
    }
  }

  protected closeAliasEdit(id: number): void {
    this.editingAliasId.set(null);
    const index = this.activeDevices().findIndex((device) => device.idUsuarioDispositivo === id);
    queueMicrotask(() => this.aliasEditButtons()[index]?.nativeElement.focus());
  }

  protected async unlinkDevice(device: UserDeviceAssignment): Promise<void> {
    if (!this.isUser() || !isActiveUserDevice(device) || this.updatingDevice() !== null || this.linking() ||
        !globalThis.confirm('¿Desvincular este GPS? Dejarás de gestionar sus ubicaciones, pero su historial seguirá guardado.')) return;
    const generation = this.generation;
    this.updatingDevice.set(device.idUsuarioDispositivo);
    this.deviceError.set(null);
    this.deviceNotice.set(null);
    try {
      const unlinked = await firstValueFrom(this.userDevices.unlink(device.idUsuarioDispositivo));
      if (generation !== this.generation || !this.isUser()) return;
      this.devices.update((items) => items.map((item) =>
        item.idUsuarioDispositivo === device.idUsuarioDispositivo
          ? { ...item, ...unlinked, estado: false } : item));
      this.editingAliasId.set(null);
      this.deviceNotice.set('GPS desvinculado. Su historial permanece disponible.');
      await this.loadDevices(generation);
      if (generation === this.generation && this.isUser()) {
        void this.locations.refresh();
        void this.overview.refresh();
        queueMicrotask(() => this.devicesTitle()?.nativeElement.focus());
      }
    } catch (error: unknown) {
      if (generation === this.generation) this.deviceError.set(error instanceof HttpErrorResponse && error.status === 404
        ? 'Este GPS ya no está vinculado a tu cuenta.'
        : 'No se pudo desvincular el GPS. Inténtalo de nuevo.');
    } finally {
      if (generation === this.generation) this.updatingDevice.set(null);
    }
  }

  protected selectVisibility(device: UserDeviceAssignment, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const previous = device.visibilidadPreferida;
    void this.updateDevice(device, {
      visibilidadPreferida: select.value as UserDeviceAssignment['visibilidadPreferida'],
    }).finally(() => { select.value = this.devices().find((item) => item.idUsuarioDispositivo === device.idUsuarioDispositivo)?.visibilidadPreferida ?? previous; });
  }

  private linkError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 404) return 'No existe un GPS con ese código.';
      if (error.status === 400) return 'El GPS debe estar en estado DISPONIBLE para vincularse.';
      if (error.status === 409) return 'Este GPS ya tiene una asignación activa.';
    }
    return 'No se pudo vincular el GPS. Inténtalo de nuevo.';
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
