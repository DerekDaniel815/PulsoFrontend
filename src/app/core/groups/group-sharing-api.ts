import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { PULSO_API_URL } from '../auth/auth.config';

export interface GroupSharing {
  idGrupo: number;
  nombre: string;
  compartiendo: boolean;
  miembrosExcluidos: { idUsuario: number; nombres: string; apellidos: string }[];
}

@Service()
export class GroupSharingApi {
  private readonly http = inject(HttpClient);

  list(assignmentId: number) {
    return this.http.get<GroupSharing[]>(`${PULSO_API_URL}/user-devices/${assignmentId}/groups-sharing`);
  }

  share(assignmentId: number, groupId: number, comparteUbicacion: boolean) {
    return this.http.patch<GroupSharing>(
      `${PULSO_API_URL}/user-devices/${assignmentId}/groups/${groupId}/sharing`,
      { comparteUbicacion },
    );
  }

  allowMember(assignmentId: number, groupId: number, userId: number, permitido: boolean) {
    return this.http.patch<GroupSharing>(
      `${PULSO_API_URL}/user-devices/${assignmentId}/groups/${groupId}/members/${userId}/sharing`,
      { permitido },
    );
  }
}
