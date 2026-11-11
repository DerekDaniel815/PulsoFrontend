import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { PULSO_API_URL } from '../auth/auth.config';

export interface GroupMember {
  idGrupoUsuario: number;
  usuario: { idUsuario: number; nombres: string; apellidos: string };
  rol: string;
}

export interface Group {
  idGrupo: number;
  idCreador: number;
  nombre: string;
  descripcion: string | null;
  estado: boolean;
  miembros?: GroupMember[];
}

export interface Invitation {
  idInvitacion: number;
  idGrupo: number;
  nombreGrupo: string;
  invitador: { nombres: string; apellidos: string };
  invitado: { nombres: string; apellidos: string };
}

@Service()
export class GroupsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${PULSO_API_URL}/groups`;

  list() { return this.http.get<Group[]>(this.base); }
  members(groupId: number) { return this.http.get<GroupMember[]>(`${this.base}/${groupId}/members`); }
  invitations() { return this.http.get<Invitation[]>(`${this.base}/invitations`); }

  create(nombre: string, descripcion?: string) {
    return this.http.post<Group>(this.base, { nombre, ...(descripcion ? { descripcion } : {}) });
  }

  update(groupId: number, change: Partial<Pick<Group, 'nombre' | 'descripcion' | 'estado'>>) {
    return this.http.patch<Group>(`${this.base}/${groupId}`, change);
  }

  invite(groupId: number, idUsuarioInvitado: number) {
    return this.http.post<Invitation>(`${this.base}/${groupId}/invitations`, { idUsuarioInvitado });
  }

  respond(invitationId: number, action: 'accept' | 'reject' | 'cancel') {
    return this.http.patch<Invitation>(`${this.base}/invitations/${invitationId}/${action}`, {});
  }

  removeMember(groupId: number, userId: number) {
    return this.http.delete<GroupMember>(`${this.base}/${groupId}/members/${userId}`);
  }
}
