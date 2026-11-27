import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { EmergenciesApi, PublicEmergencyResponse } from '../../core/emergencies/emergencies-api';

@Component({
  selector: 'app-public-emergency-lookup',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule],
  templateUrl: './public-emergency-lookup.html',
  styleUrl: './public-emergency-lookup.scss',
})
export class PublicEmergencyLookup {
  private readonly api = inject(EmergenciesApi);
  private generation = 0;

  protected readonly code = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^EME-[0-9A-F]{8}$/i)],
  });
  protected readonly form = new FormGroup({ code: this.code });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<PublicEmergencyResponse | null>(null);
  protected readonly coordinates = computed(() => {
    const location = this.result()?.ubicacion;
    if (!location || !Number.isFinite(location.latitud) || !Number.isFinite(location.longitud) ||
        Math.abs(location.latitud) > 90 || Math.abs(location.longitud) > 180) return null;
    return location;
  });
  protected readonly mapUrl = computed(() => {
    const location = this.coordinates();
    return location
      ? `https://www.google.com/maps/search/?api=1&query=${location.latitud},${location.longitud}`
      : null;
  });

  protected clearResult(): void {
    ++this.generation;
    this.result.set(null);
    this.error.set(null);
    this.loading.set(false);
  }

  protected async search(): Promise<void> {
    const code = this.code.value.trim().toUpperCase();
    this.code.setValue(code);
    if (this.code.invalid) {
      this.code.markAsTouched();
      this.clearResult();
      return;
    }

    const generation = ++this.generation;
    this.loading.set(true);
    this.result.set(null);
    this.error.set(null);
    try {
      const result = await firstValueFrom(this.api.findPublicByCode(code));
      if (generation === this.generation) this.result.set(result);
    } catch (error: unknown) {
      if (generation !== this.generation) return;
      this.error.set(error instanceof HttpErrorResponse && error.status === 404
        ? 'No hay una emergencia activa para ese código.'
        : 'No se pudo consultar la emergencia. Comprueba la conexión e inténtalo de nuevo.');
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
}
