import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionStore } from '../../core/auth/session-store';
import { UserDeviceAssignment, UserDevicesApi, isActiveUserDevice } from '../../core/devices/user-devices-api';
import { EmergenciesApi } from '../../core/emergencies/emergencies-api';
import { LocationsStore } from '../../core/locations/locations-store';
import { ActiveEmergency, OverviewStore } from '../../core/overview/overview-store';

@Component({
  selector: 'app-emergency-controls',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './emergency-controls.html',
  styleUrl: './emergency-controls.scss',
})
export class EmergencyControls {
  protected readonly descriptionMaxLength = 300;
  private readonly session = inject(SessionStore);
  private readonly devicesApi = inject(UserDevicesApi);
  private readonly emergenciesApi = inject(EmergenciesApi);
  private readonly overview = inject(OverviewStore);
  private readonly locations = inject(LocationsStore);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  private generation = 0;

  protected readonly isUser = computed(() =>
    this.session.isAuthenticated() && this.session.user()?.rol === 'USUARIO');
  protected readonly devices = signal<UserDeviceAssignment[]>([]);
  protected readonly activeDevices = computed(() => this.devices().filter(isActiveUserDevice));
  protected readonly ownEmergencies = computed(() => {
    const ids = new Set(this.devices().map((device) => device.idUsuarioDispositivo));
    return this.overview.emergencies().filter((emergency) =>
      emergency.estado === 'ACTIVA' && ids.has(emergency.idUsuarioDispositivo));
  });
  protected readonly loading = signal(true);
  protected readonly devicesError = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly form = new FormGroup({
    assignmentId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(this.descriptionMaxLength)] }),
  });

  constructor() {
    effect(() => {
      const userId = this.session.user()?.idUsuario;
      const token = this.session.token();
      const active = this.isUser() && userId !== undefined && !!token;
      const generation = ++this.generation;
      this.devices.set([]);
      this.error.set(null);
      this.devicesError.set(false);
      this.notice.set(null);
      this.busy.set(false);
      this.form.reset();
      if (active) void this.loadDevices(generation);
      else this.loading.set(false);
    });
  }

  protected async loadDevices(generation = this.generation): Promise<void> {
    if (!this.isUser()) return;
    this.loading.set(true);
    try {
      const devices = await firstValueFrom(this.devicesApi.list());
      if (generation !== this.generation || !this.isUser()) return;
      this.devices.set(devices);
      this.error.set(null);
      this.devicesError.set(false);
    } catch {
      if (generation === this.generation) {
        this.error.set('No se pudieron cargar tus GPS. Inténtalo de nuevo.');
        this.devicesError.set(true);
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }

  protected deviceLabel(id: number): string {
    const device = this.devices().find((item) => item.idUsuarioDispositivo === id);
    return device?.alias || device?.dispositivo?.codigoDispositivo || `Dispositivo ${id}`;
  }

  protected hasActiveEmergency(id: number): boolean {
    return this.ownEmergencies().some((item) => item.idUsuarioDispositivo === id);
  }

  protected selectedAlreadyActive(): boolean {
    return this.hasActiveEmergency(Number(this.form.controls.assignmentId.value));
  }

  protected isSafeEmergencyId(id: string): boolean {
    return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
  }

  protected async activate(): Promise<void> {
    if (!this.isUser() || this.busy() || this.loading() || this.form.invalid) return;
    const id = Number(this.form.controls.assignmentId.value);
    if (!Number.isSafeInteger(id) || !this.activeDevices().some((item) => item.idUsuarioDispositivo === id)) return;
    if (this.hasActiveEmergency(id)) return;
    if (!globalThis.confirm('¿Activar la emergencia para este GPS? Se notificará a tus contactos y grupos y podrá aparecer públicamente con su última ubicación disponible.')) return;

    const generation = this.generation;
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      const description = this.form.controls.description.value.trim();
      await firstValueFrom(this.emergenciesApi.activate(id, description || undefined));
      if (generation !== this.generation || !this.isUser()) return;
      await this.refreshViews();
      if (generation !== this.generation || !this.isUser()) return;
      this.form.reset();
      this.notice.set('Emergencia activada. La última ubicación disponible puede no ser en tiempo real.');
    } catch (error: unknown) {
      if (generation !== this.generation) return;
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.error.set('Este GPS ya tiene una emergencia activa.');
        void this.overview.refresh();
      } else if (error instanceof HttpErrorResponse && (error.status === 400 || error.status === 403 || error.status === 404)) {
        this.error.set('El GPS ya no está disponible para activar una emergencia. Actualiza la lista.');
        void this.loadDevices(generation);
      } else {
        this.error.set('No se pudo activar la emergencia. Comprueba la conexión e inténtalo de nuevo.');
      }
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }

  protected async finish(emergency: ActiveEmergency): Promise<void> {
    if (!this.isUser() || this.busy() || !this.ownEmergencies().some((item) => item.idEmergencia === emergency.idEmergencia)) return;
    if (!this.isSafeEmergencyId(emergency.idEmergencia)) {
      this.error.set('No se puede finalizar esta emergencia: el servidor devolvió un identificador no válido.');
      return;
    }
    if (!globalThis.confirm(`¿Finalizar la emergencia de ${this.deviceLabel(emergency.idUsuarioDispositivo)}? Esta acción avisará de que ya no está activa.`)) return;
    const generation = this.generation;
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await firstValueFrom(this.emergenciesApi.finish(emergency.idEmergencia));
      if (generation !== this.generation || !this.isUser()) return;
      await this.refreshViews();
      if (generation !== this.generation || !this.isUser()) return;
      this.notice.set('Emergencia finalizada.');
      queueMicrotask(() => this.heading()?.nativeElement.focus());
    } catch (error: unknown) {
      if (generation !== this.generation) return;
      this.error.set(error instanceof HttpErrorResponse && error.status === 403
        ? 'Solo el propietario puede finalizar esta emergencia.'
        : 'No se pudo finalizar la emergencia. Comprueba su estado e inténtalo de nuevo.');
      if (error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404)) {
        void this.overview.refresh();
      }
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }

  private async refreshViews(): Promise<void> {
    await Promise.allSettled([this.overview.refresh(), this.locations.refresh()]);
  }
}
