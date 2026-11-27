import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PULSO_API_URL } from '../auth/auth.config';
import { ActiveEmergency } from '../overview/overview-store';

export interface EmergencyResponse extends ActiveEmergency {
  codigoPublico: string;
  activadaDesde: string;
}

export interface PublicEmergencyResponse {
  clavePublica: string;
  codigoPublico: string;
  estado: string;
  ubicacion: {
    latitud: number;
    longitud: number;
    isApproximate: boolean;
    isLive: boolean;
    fechaHoraDispositivo: string;
    fechaHoraServidor: string;
  } | null;
  fechaUltimaUbicacion: string | null;
}

@Service()
export class EmergenciesApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${PULSO_API_URL}/emergencies`;

  activate(idUsuarioDispositivo: number, descripcion?: string): Observable<EmergencyResponse> {
    return this.http.post<EmergencyResponse>(this.base, {
      idUsuarioDispositivo,
      activadaDesde: 'WEB',
      ...(descripcion ? { descripcion } : {}),
    });
  }

  finish(idEmergencia: string): Observable<EmergencyResponse> {
    return this.http.patch<EmergencyResponse>(`${this.base}/${encodeURIComponent(idEmergencia)}/finish`, {});
  }

  findPublicByCode(codigoPublico: string): Observable<PublicEmergencyResponse> {
    return this.http.get<PublicEmergencyResponse>(`${this.base}/public/${encodeURIComponent(codigoPublico)}`);
  }
}
