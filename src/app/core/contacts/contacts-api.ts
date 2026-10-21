import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PULSO_API_URL } from '../auth/auth.config';

export interface PublicUser {
  idUsuario: number;
  nombres: string;
  apellidos: string;
  correo?: string;
}

export interface ContactRecord {
  idUsuarioContacto: number;
  contacto: PublicUser;
  estado: string;
  yoCompartoUbicacion: boolean;
  contactoComparteUbicacion: boolean;
  soySolicitante: boolean;
  fechaSolicitud: string;
}

@Service()
export class ContactsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${PULSO_API_URL}/contacts`;

  list(): Observable<ContactRecord[]> {
    return this.http.get<ContactRecord[]>(this.base);
  }

  requests(): Observable<ContactRecord[]> {
    return this.http.get<ContactRecord[]>(`${this.base}/requests`);
  }

  search(q: string): Observable<PublicUser[]> {
    return this.http.get<PublicUser[]>(`${PULSO_API_URL}/users/search`, {
      params: new HttpParams().set('q', q),
    });
  }

  request(idUsuarioDestino: number): Observable<ContactRecord> {
    return this.http.post<ContactRecord>(`${this.base}/requests`, { idUsuarioDestino });
  }

  respond(id: number, action: 'accept' | 'reject' | 'cancel'): Observable<ContactRecord> {
    return this.http.patch<ContactRecord>(`${this.base}/requests/${id}/${action}`, {});
  }

  share(id: number, comparteUbicacion: boolean): Observable<ContactRecord> {
    return this.http.patch<ContactRecord>(`${this.base}/${id}/location-sharing`, {
      comparteUbicacion,
    });
  }

  remove(id: number): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}`);
  }
}
