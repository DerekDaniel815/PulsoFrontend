import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SessionStore } from '../../core/auth/session-store';
import {
  CreateDevice, DeviceStatus, DeviceWithToken, DevicesApi, InventoryDevice, UpdateDevice,
} from '../../core/devices/devices-api';

type Credential = { code: string; token: string; action: 'created' | 'regenerated' };

@Component({
  selector: 'app-inventario',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './inventario.html',
  styleUrl: './inventario.scss',
})
export class Inventario {
  private readonly api = inject(DevicesApi);
  private readonly session = inject(SessionStore);
  private readonly credentialTitle = viewChild<ElementRef<HTMLElement>>('credentialTitle');
  private readonly detailTitle = viewChild<ElementRef<HTMLElement>>('detailTitle');
  private readonly createButton = viewChild<ElementRef<HTMLButtonElement>>('createButton');
  private credentialReturn: HTMLElement | null = null;
  private focusDetails = false;
  private generation = 0;
  private detailVersion = 0;

  protected readonly devices = signal<InventoryDevice[]>([]);
  protected readonly selected = signal<InventoryDevice | null>(null);
  protected readonly loading = signal(true);
  protected readonly detailLoading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly detailError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly credential = signal<Credential | null>(null);
  protected readonly isAdmin = computed(() =>
    this.session.isAuthenticated() && this.session.user()?.rol === 'ADMIN');
  protected readonly statuses: DeviceStatus[] = [
    'FABRICADO', 'DISPONIBLE', 'ASIGNADO', 'MANTENIMIENTO', 'BAJA',
  ];

  protected readonly createForm = new FormGroup({
    imei: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(30)] }),
    modelo: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    numeroSerie: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    fechaFabricacion: new FormControl('', { nonNullable: true }),
  });
  protected readonly editForm = new FormGroup({
    modelo: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    estado: new FormControl<DeviceStatus>('FABRICADO', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const token = this.session.token();
      const role = this.session.user()?.rol;
      const generation = ++this.generation;
      this.detailVersion++;
      this.credential.set(null);
      this.devices.set([]);
      this.selected.set(null);
      this.busy.set(false);
      this.detailLoading.set(false);
      if (token && role === 'ADMIN') void this.loadDevices(generation);
      else this.loading.set(false);
    });
    effect(() => {
      if (this.credential()) this.credentialTitle()?.nativeElement.focus();
      if (this.focusDetails && this.selected() && this.detailTitle()) {
        this.detailTitle()?.nativeElement.focus();
        this.focusDetails = false;
      }
    });
  }

  protected statusLabel(status: DeviceStatus): string {
    switch (status) {
      case 'FABRICADO': return 'Fabricado';
      case 'DISPONIBLE': return 'Disponible';
      case 'ASIGNADO': return 'Asignado';
      case 'MANTENIMIENTO': return 'Mantenimiento';
      case 'BAJA': return 'Baja';
    }
  }

  protected async loadDevices(generation = this.generation): Promise<void> {
    if (!this.isAdmin()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const devices = await firstValueFrom(this.api.list());
      if (generation !== this.generation || !this.isAdmin()) return;
      this.devices.set(devices);
      const id = this.selected()?.idDispositivo;
      if (id !== undefined && !devices.some((device) => device.idDispositivo === id)) {
        this.selected.set(null);
      }
    } catch (error: unknown) {
      if (generation === this.generation) this.error.set(this.message(error, 'No se pudo cargar el inventario.'));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }

  protected async selectDevice(id: number): Promise<void> {
    if (!this.isAdmin() || this.busy()) return;
    const generation = this.generation;
    const version = ++this.detailVersion;
    this.closeCredential(false);
    this.selected.set(null);
    this.detailError.set(null);
    this.detailLoading.set(true);
    this.focusDetails = true;
    try {
      const device = await firstValueFrom(this.api.get(id));
      if (generation !== this.generation || version !== this.detailVersion || !this.isAdmin()) return;
      this.selected.set(device);
      this.editForm.reset({ modelo: device.modelo ?? '', estado: device.estado });
    } catch (error: unknown) {
      if (generation === this.generation && version === this.detailVersion) {
        this.detailError.set(this.message(error, 'No se pudo cargar el dispositivo.'));
      }
    } finally {
      if (generation === this.generation && version === this.detailVersion) this.detailLoading.set(false);
    }
  }

  protected async create(): Promise<void> {
    if (!this.isAdmin() || this.busy() || this.createForm.invalid) return;
    const generation = this.generation;
    const form = this.createForm.getRawValue();
    const data: CreateDevice = {};
    if (form.imei.trim()) data.imei = form.imei.trim();
    if (form.modelo.trim()) data.modelo = form.modelo.trim();
    if (form.numeroSerie.trim()) data.numeroSerie = form.numeroSerie.trim();
    if (form.fechaFabricacion) data.fechaFabricacion = new Date(`${form.fechaFabricacion}T00:00:00`).toISOString();
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.closeCredential(false);
    try {
      const created = await firstValueFrom(this.api.create(data));
      if (generation !== this.generation || !this.isAdmin()) return;
      this.devices.update((devices) => [this.withoutToken(created), ...devices]);
      this.createForm.reset();
      this.showCredential(created, 'created', this.createButton()?.nativeElement ?? null);
    } catch (error: unknown) {
      if (generation === this.generation) this.error.set(this.message(error, 'No se pudo registrar el dispositivo.'));
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }

  protected async update(): Promise<void> {
    const device = this.selected();
    if (!device || !this.isAdmin() || this.busy() || this.editForm.invalid) return;
    const generation = this.generation;
    const version = this.detailVersion;
    const form = this.editForm.getRawValue();
    const change: UpdateDevice = {};
    if (form.modelo.trim() !== (device.modelo ?? '')) change.modelo = form.modelo.trim();
    if (form.estado !== device.estado) {
      if (form.estado === 'ASIGNADO') return;
      change.estado = form.estado;
    }
    if (!Object.keys(change).length) {
      this.notice.set('No hay cambios para guardar.');
      return;
    }
    this.busy.set(true);
    this.detailError.set(null);
    this.notice.set(null);
    try {
      const updated = await firstValueFrom(this.api.update(device.idDispositivo, change));
      if (generation !== this.generation || version !== this.detailVersion || !this.isAdmin()) return;
      this.selected.set(updated);
      this.devices.update((devices) => devices.map((item) =>
        item.idDispositivo === updated.idDispositivo ? updated : item));
      this.editForm.reset({ modelo: updated.modelo ?? '', estado: updated.estado });
      this.notice.set('Dispositivo actualizado.');
    } catch (error: unknown) {
      if (generation === this.generation && version === this.detailVersion) {
        this.detailError.set(this.message(error, 'No se pudo actualizar el dispositivo.'));
      }
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }

  protected async regenerate(trigger: HTMLButtonElement): Promise<void> {
    const device = this.selected();
    if (!device || !this.isAdmin() || this.busy() ||
        !globalThis.confirm('El token anterior dejará de funcionar de inmediato. ¿Regenerar la credencial del firmware?')) return;
    const generation = this.generation;
    const version = this.detailVersion;
    this.busy.set(true);
    this.detailError.set(null);
    this.closeCredential(false);
    try {
      const result = await firstValueFrom(this.api.regenerateToken(device.idDispositivo));
      if (generation !== this.generation || version !== this.detailVersion || !this.isAdmin()) return;
      const updated = this.withoutToken(result);
      this.selected.set(updated);
      this.devices.update((devices) => devices.map((item) =>
        item.idDispositivo === updated.idDispositivo ? updated : item));
      this.showCredential(result, 'regenerated', trigger);
    } catch (error: unknown) {
      if (generation === this.generation && version === this.detailVersion) {
        this.detailError.set(error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404)
          ? this.message(error, '')
          : 'No se pudo confirmar la regeneración. El token anterior podría haber quedado invalidado; verifica el estado antes de repetir.');
      }
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }

  protected closeCredential(restoreFocus = true): void {
    const trigger = this.credentialReturn;
    this.credential.set(null);
    this.credentialReturn = null;
    if (restoreFocus && trigger?.isConnected) trigger.focus();
  }

  private showCredential(device: DeviceWithToken, action: Credential['action'], trigger: HTMLElement | null): void {
    this.credentialReturn = trigger;
    this.credential.set({ code: device.codigoDispositivo, token: device.deviceToken, action });
  }

  private withoutToken({ deviceToken: _token, ...device }: DeviceWithToken): InventoryDevice {
    return device;
  }

  private message(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 403) return 'Acceso denegado. Se requiere el rol ADMIN.';
    if (error.status === 404) return 'El dispositivo ya no existe.';
    if (error.status === 409) return 'Conflicto: IMEI o número de serie duplicado, código no disponible o cambio de estado incompatible con la asignación.';
    return fallback;
  }
}
