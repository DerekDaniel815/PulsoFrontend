import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { PULSO_API_URL } from '../auth/auth.config';

export interface NotificationRecord {
  idNotificacionUsuario: string;
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

  list() {
    return this.http.get<NotificationRecord[]>(this.base);
  }

  read(id: string) {
    return this.http.patch(`${this.base}/${encodeURIComponent(id)}/read`, {});
  }

  readAll() {
    return this.http.patch(`${this.base}/read-all`, {});
  }
}
