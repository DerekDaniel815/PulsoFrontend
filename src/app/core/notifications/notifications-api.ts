import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { PULSO_API_URL } from '../auth/auth.config';

export interface NotificationRecord {
  idNotificacionUsuario: string;
  idNotificacion: string;
  tipo: string;
  titulo: string;
  mensaje: string | null;
  leida: boolean;
  fechaCreacion: string;
}

@Service()
export class NotificationsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${PULSO_API_URL}/notifications`;

  list(limit = 20, offset = 0) {
    return this.http.get<NotificationRecord[]>(this.base, {
      params: new HttpParams().set('limit', limit).set('offset', offset),
    });
  }

  unread(limit = 20, offset = 0) {
    return this.http.get<NotificationRecord[]>(`${this.base}/unread`, {
      params: new HttpParams().set('limit', limit).set('offset', offset),
    });
  }

  read(idNotificacion: string) {
    return this.http.patch(`${this.base}/${encodeURIComponent(idNotificacion)}/read`, {});
  }

  readAll() {
    return this.http.patch(`${this.base}/read-all`, {});
  }
}
