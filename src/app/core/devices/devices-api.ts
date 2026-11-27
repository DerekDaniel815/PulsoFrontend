import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PULSO_API_URL } from '../auth/auth.config';

export type DeviceStatus = 'FABRICADO' | 'DISPONIBLE' | 'ASIGNADO' | 'MANTENIMIENTO' | 'BAJA';

export interface InventoryDevice {
  idDispositivo: number;
  codigoDispositivo: string;
  imei: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  estado: DeviceStatus;
  ultimaConexion: string | null;
  fechaFabricacion: string | null;
  fechaRegistro: string;
}

export interface DeviceWithToken extends InventoryDevice {
  deviceToken: string;
}

export interface CreateDevice {
  imei?: string;
  modelo?: string;
  numeroSerie?: string;
  fechaFabricacion?: string;
}

export interface UpdateDevice {
  modelo?: string;
  estado?: DeviceStatus;
}

@Service()
export class DevicesApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${PULSO_API_URL}/devices`;

  list(): Observable<InventoryDevice[]> {
    return this.http.get<InventoryDevice[]>(this.base);
  }

  get(id: number): Observable<InventoryDevice> {
    return this.http.get<InventoryDevice>(`${this.base}/${id}`);
  }

  create(data: CreateDevice): Observable<DeviceWithToken> {
    return this.http.post<DeviceWithToken>(this.base, data);
  }

  update(id: number, data: UpdateDevice): Observable<InventoryDevice> {
    return this.http.patch<InventoryDevice>(`${this.base}/${id}`, data);
  }

  regenerateToken(id: number): Observable<DeviceWithToken> {
    return this.http.post<DeviceWithToken>(`${this.base}/${id}/token`, null);
  }
}
