import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PULSO_API_URL } from '../auth/auth.config';

export interface UserDeviceAssignment {
  idUsuarioDispositivo: number;
  alias: string | null;
  ubicacionActiva: boolean;
  visibilidadPreferida: 'SOLO_YO' | 'GRUPO' | 'PUBLICO';
  estado?: boolean;
  fechaDesvinculacion?: string | null;
  dispositivo?: { codigoDispositivo?: string };
}

export function isActiveUserDevice(assignment: Pick<UserDeviceAssignment, 'estado' | 'fechaDesvinculacion'>): boolean {
  return assignment.estado !== false && !assignment.fechaDesvinculacion;
}

@Service()
export class UserDevicesApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${PULSO_API_URL}/user-devices`;

  list(): Observable<UserDeviceAssignment[]> {
    return this.http.get<UserDeviceAssignment[]>(`${this.base}/me`);
  }

  link(data: { codigoDispositivo: string; alias?: string }): Observable<UserDeviceAssignment> {
    return this.http.post<UserDeviceAssignment>(this.base, data);
  }

  update(id: number, data: Partial<Pick<UserDeviceAssignment, 'alias' | 'ubicacionActiva' | 'visibilidadPreferida'>>): Observable<UserDeviceAssignment> {
    return this.http.patch<UserDeviceAssignment>(`${this.base}/${id}`, data);
  }

  unlink(id: number): Observable<UserDeviceAssignment> {
    return this.http.post<UserDeviceAssignment>(`${this.base}/${id}/unlink`, null);
  }
}
