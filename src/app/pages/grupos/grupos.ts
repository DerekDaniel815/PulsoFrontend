import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PULSO_API_URL } from '../../core/auth/auth.config';
import { SessionStore } from '../../core/auth/session-store';
import { ContactsApi, PublicUser } from '../../core/contacts/contacts-api';

interface Group {
  idGrupo: number;
  idCreador?: number;
  nombre: string;
  descripcion: string | null;
  estado: boolean;
  miembros?: { idGrupoUsuario: number; usuario: { idUsuario: number; nombres: string; apellidos: string }; rol: string }[];
}

interface Assignment {
  idUsuarioDispositivo: number;
  alias: string | null;
}

interface GroupSharing {
  idGrupo: number;
  compartiendo: boolean;
}

interface Invitation {
  idInvitacion: number;
  nombreGrupo: string;
  invitador: { nombres: string; apellidos: string };
}

@Component({
  selector: 'app-grupos',
  templateUrl: './grupos.html',
  styleUrl: './grupos.scss',
})
export class Grupos {
  private readonly http = inject(HttpClient);
  private readonly contactsApi = inject(ContactsApi);
  private readonly session = inject(SessionStore);
  protected readonly groups = signal<Group[]>([]);
  protected readonly assignments = signal<Assignment[]>([]);
  protected readonly selectedAssignmentId = signal<number | null>(null);
  protected readonly sharing = signal<GroupSharing[]>([]);
  protected readonly invitations = signal<Invitation[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly loading = signal(true);
  protected readonly showForm = signal(false);
  protected readonly newName = signal('');
  protected readonly inviteGroupId = signal<number | null>(null);
  protected readonly searchTerm = signal('');
  protected readonly searchResults = signal<PublicUser[]>([]);
  protected readonly notice = signal<string | null>(null);

  constructor() { void this.refresh(); }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const [groups, invitations, assignments] = await Promise.all([
        firstValueFrom(this.http.get<Group[]>(`${PULSO_API_URL}/groups`)),
        firstValueFrom(this.http.get<Invitation[]>(`${PULSO_API_URL}/groups/invitations`)),
        firstValueFrom(this.http.get<Assignment[]>(`${PULSO_API_URL}/user-devices/me`)),
      ]);
      this.groups.set(groups);
      this.invitations.set(invitations);
      this.assignments.set(assignments);
      if (this.selectedAssignmentId() === null && assignments.length) {
        this.selectedAssignmentId.set(assignments[0].idUsuarioDispositivo);
      }
      await this.loadSharing();
      this.error.set(null);
    } catch {
      this.error.set('No se pudieron cargar los grupos.');
    } finally {
      this.loading.set(false);
    }
  }

  protected updateName(event: Event): void {
    this.newName.set((event.target as HTMLInputElement).value);
  }

  protected canInvite(group: Group): boolean {
    const userId = this.session.user()?.idUsuario;
    return userId !== undefined && (group.idCreador === userId ||
      (group.miembros?.some((member) => member.usuario.idUsuario === userId && member.rol === 'ADMIN') ?? false));
  }

  protected startInvite(groupId: number): void {
    this.inviteGroupId.set(this.inviteGroupId() === groupId ? null : groupId);
    this.searchResults.set([]);
    this.searchTerm.set('');
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected async searchUsers(): Promise<void> {
    const term = this.searchTerm().trim();
    if (term.length < 2) return;
    try {
      this.searchResults.set(await firstValueFrom(this.contactsApi.search(term)));
      this.error.set(null);
    } catch {
      this.error.set('No se pudieron buscar usuarios para invitar.');
    }
  }

  protected async invite(groupId: number, user: PublicUser): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.http.post(`${PULSO_API_URL}/groups/${groupId}/invitations`, {
        idUsuarioInvitado: user.idUsuario,
      }));
      this.notice.set(`Invitación enviada a ${user.nombres} ${user.apellidos}.`);
      this.inviteGroupId.set(null);
      this.error.set(null);
    } catch {
      this.error.set('No se pudo enviar la invitación.');
    } finally {
      this.busy.set(false);
    }
  }

  protected selectAssignment(event: Event): void {
    this.selectedAssignmentId.set(Number((event.target as HTMLSelectElement).value));
    this.sharing.set([]);
    void this.loadSharing();
  }

  protected isSharing(groupId: number): boolean {
    return this.sharing().some((item) => item.idGrupo === groupId && item.compartiendo);
  }

  protected async toggleSharing(groupId: number): Promise<void> {
    const id = this.selectedAssignmentId();
    if (id === null || this.busy()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.http.patch(
        `${PULSO_API_URL}/user-devices/${id}/groups/${groupId}/sharing`,
        { comparteUbicacion: !this.isSharing(groupId) },
      ));
      await this.loadSharing();
      this.error.set(null);
    } catch {
      this.error.set('No se pudo actualizar el permiso del grupo.');
    } finally {
      this.busy.set(false);
    }
  }

  private async loadSharing(): Promise<void> {
    const id = this.selectedAssignmentId();
    if (id === null) return;
    try {
      const items = await firstValueFrom(this.http.get<GroupSharing[]>(
        `${PULSO_API_URL}/user-devices/${id}/groups-sharing`,
      ));
      if (id === this.selectedAssignmentId()) this.sharing.set(items);
    } catch {
      this.error.set('No se pudieron consultar los permisos del dispositivo.');
    }
  }

  protected async create(): Promise<void> {
    const nombre = this.newName().trim();
    if (!nombre || this.busy()) return;
    await this.act(() => firstValueFrom(this.http.post(`${PULSO_API_URL}/groups`, { nombre })));
    this.newName.set('');
  }

  protected async respond(invitation: Invitation, action: 'accept' | 'reject'): Promise<void> {
    await this.act(() => firstValueFrom(
      this.http.patch(`${PULSO_API_URL}/groups/invitations/${invitation.idInvitacion}/${action}`, {}),
    ));
  }

  private async act(operation: () => Promise<unknown>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await operation();
      await this.refresh();
      this.showForm.set(false);
    } catch {
      this.error.set('No se pudo completar la acción.');
    } finally {
      this.busy.set(false);
    }
  }
}
