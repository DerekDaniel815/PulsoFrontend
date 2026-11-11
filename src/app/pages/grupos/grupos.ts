import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PULSO_API_URL } from '../../core/auth/auth.config';
import { SessionStore } from '../../core/auth/session-store';
import { ContactsApi, PublicUser } from '../../core/contacts/contacts-api';
import { GroupSharing, GroupSharingApi } from '../../core/groups/group-sharing-api';
import { Group, GroupMember, GroupsApi, Invitation } from '../../core/groups/groups-api';
import { LocationsStore } from '../../core/locations/locations-store';

interface Assignment {
  idUsuarioDispositivo: number;
  alias: string | null;
  visibilidadPreferida: 'SOLO_YO' | 'GRUPO' | 'PUBLICO';
  ubicacionActiva: boolean;
}

@Component({
  selector: 'app-grupos',
  templateUrl: './grupos.html',
  styleUrl: './grupos.scss',
})
export class Grupos {
  private readonly http = inject(HttpClient);
  private readonly groupsApi = inject(GroupsApi);
  private readonly sharingApi = inject(GroupSharingApi);
  private readonly contactsApi = inject(ContactsApi);
  protected readonly session = inject(SessionStore);
  private readonly locations = inject(LocationsStore);
  private refreshGeneration = 0;
  private memberRequestGeneration = 0;
  protected readonly groups = signal<Group[]>([]);
  protected readonly assignments = signal<Assignment[]>([]);
  protected readonly selectedAssignmentId = signal<number | null>(null);
  protected readonly selectedAssignment = computed(() =>
    this.assignments().find((item) => item.idUsuarioDispositivo === this.selectedAssignmentId()) ?? null,
  );
  protected readonly sharing = signal<GroupSharing[]>([]);
  protected readonly permissionSummary = computed(() => {
    const device = this.selectedAssignment();
    const sharing = this.sharing();
    return this.groups().map((group) => {
      const permission = sharing.find((item) => item.idGrupo === group.idGrupo);
      const active = !!device && !!permission?.compartiendo && group.estado &&
        device.visibilidadPreferida === 'GRUPO' && device.ubicacionActiva;
      const status = !device ? 'Sin dispositivo' : !permission ? 'Sin datos' :
        !group.estado ? 'Grupo inactivo' : device.visibilidadPreferida !== 'GRUPO' ? 'Sin efecto' :
          !device.ubicacionActiva ? 'Pausado' : active ? 'Activo' : 'Sin acceso';
      return { group, active, status, excluded: permission?.miembrosExcluidos?.length ?? 0 };
    });
  });
  protected readonly activePermissions = computed(() => this.permissionSummary().filter((item) => item.active).length);
  protected readonly invitations = signal<Invitation[]>([]);
  // El backend no lista las invitaciones enviadas: solo podemos cancelar las creadas en esta sesión.
  protected readonly sentInvitations = signal<Invitation[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly loading = signal(true);
  protected readonly showForm = signal(false);
  protected readonly newName = signal('');
  protected readonly newDescription = signal('');
  protected readonly editingGroupId = signal<number | null>(null);
  protected readonly editName = signal('');
  protected readonly editDescription = signal('');
  protected readonly inviteGroupId = signal<number | null>(null);
  protected readonly searchTerm = signal('');
  protected readonly searchResults = signal<PublicUser[]>([]);
  protected readonly notice = signal<string | null>(null);
  protected readonly expandedGroupId = signal<number | null>(null);
  protected readonly members = signal<GroupMember[]>([]);
  protected readonly membersLoading = signal(false);
  protected readonly membersError = signal(false);

  constructor() {
    void this.refresh();
    effect(() => {
      if (this.locations.notificationVersion() > 0) void this.refresh();
    });
  }

  protected async refresh(): Promise<void> {
    const generation = ++this.refreshGeneration;
    this.loading.set(true);
    try {
      const [groups, invitations, assignments] = await Promise.all([
        firstValueFrom(this.groupsApi.list()),
        firstValueFrom(this.groupsApi.invitations()),
        firstValueFrom(this.http.get<Assignment[]>(`${PULSO_API_URL}/user-devices/me`)),
      ]);
      if (generation !== this.refreshGeneration) return;
      this.groups.set(groups);
      this.invitations.set(invitations);
      this.assignments.set(assignments);
      this.sentInvitations.update((items) => items.filter((item) => groups.some((group) => group.idGrupo === item.idGrupo)));
      const expanded = groups.find((group) => group.idGrupo === this.expandedGroupId());
      if (expanded) {
        this.members.set(expanded.miembros ?? []);
        void this.loadMembers(expanded.idGrupo);
      } else {
        this.expandedGroupId.set(null);
        this.members.set([]);
      }
      if (!assignments.some((item) => item.idUsuarioDispositivo === this.selectedAssignmentId())) {
        this.selectedAssignmentId.set(assignments[0]?.idUsuarioDispositivo ?? null);
      }
      this.error.set(null);
      await this.loadSharing();
    } catch {
      if (generation === this.refreshGeneration) this.error.set('No se pudieron cargar los grupos.');
    } finally {
      if (generation === this.refreshGeneration) this.loading.set(false);
    }
  }

  protected toggleMembers(group: Group): void {
    if (this.expandedGroupId() === group.idGrupo) {
      this.expandedGroupId.set(null);
      this.editingGroupId.set(null);
      this.inviteGroupId.set(null);
      this.memberRequestGeneration++;
      return;
    }
    this.expandedGroupId.set(group.idGrupo);
    this.editingGroupId.set(null);
    this.inviteGroupId.set(null);
    this.members.set(group.miembros ?? []);
    this.membersError.set(false);
    void this.loadMembers(group.idGrupo);
  }

  protected updateName(event: Event): void {
    this.newName.set((event.target as HTMLInputElement).value);
  }

  protected updateDescription(event: Event): void {
    this.newDescription.set((event.target as HTMLInputElement).value);
  }

  protected updateEditName(event: Event): void {
    this.editName.set((event.target as HTMLInputElement).value);
  }

  protected updateEditDescription(event: Event): void {
    this.editDescription.set((event.target as HTMLInputElement).value);
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected async loadMembers(groupId: number): Promise<void> {
    const generation = ++this.memberRequestGeneration;
    this.membersLoading.set(true);
    this.membersError.set(false);
    try {
      const members = await firstValueFrom(this.groupsApi.members(groupId));
      if (generation === this.memberRequestGeneration && this.expandedGroupId() === groupId) {
        this.members.set(members);
        this.groups.update((groups) => groups.map((group) =>
          group.idGrupo === groupId ? { ...group, miembros: members } : group,
        ));
      }
    } catch {
      if (generation === this.memberRequestGeneration && this.expandedGroupId() === groupId) {
        this.membersError.set(true);
      }
    } finally {
      if (generation === this.memberRequestGeneration) this.membersLoading.set(false);
    }
  }

  protected canAdmin(group: Group): boolean {
    const userId = this.session.user()?.idUsuario;
    return userId !== undefined && (group.idCreador === userId ||
      (group.miembros?.some((member) => member.usuario.idUsuario === userId && member.rol === 'ADMIN') ?? false));
  }

  protected startEdit(group: Group): void {
    this.editingGroupId.set(group.idGrupo);
    this.editName.set(group.nombre);
    this.editDescription.set(group.descripcion ?? '');
  }

  protected async saveGroup(group: Group): Promise<void> {
    const nombre = this.editName().trim();
    const descripcion = this.editDescription().trim();
    if (!nombre || nombre.length > 100 || descripcion.length > 500 || !this.canAdmin(group)) return;
    if (await this.act(() => firstValueFrom(this.groupsApi.update(group.idGrupo, { nombre, descripcion })))) {
      this.editingGroupId.set(null);
      this.notice.set('Grupo actualizado.');
    }
  }

  protected async toggleGroup(group: Group): Promise<void> {
    if (!this.canAdmin(group) || !globalThis.confirm(
      `¿${group.estado ? 'Desactivar' : 'Activar'} el grupo ${group.nombre}? Esto puede cambiar quién ve las ubicaciones compartidas.`,
    )) return;
    if (await this.act(() => firstValueFrom(this.groupsApi.update(group.idGrupo, { estado: !group.estado })))) {
      this.notice.set(`Grupo ${group.estado ? 'desactivado' : 'activado'}.`);
      void this.locations.refresh();
    }
  }

  protected async removeMember(group: Group, member: GroupMember): Promise<void> {
    const userId = this.session.user()?.idUsuario;
    const isSelf = member.usuario.idUsuario === userId;
    if ((!isSelf && !this.canAdmin(group)) || !globalThis.confirm(isSelf
      ? `¿Salir del grupo ${group.nombre}? Perderás el acceso a sus ubicaciones compartidas.`
      : `¿Retirar a ${member.usuario.nombres} ${member.usuario.apellidos} del grupo ${group.nombre}?`)) return;
    if (await this.act(() => firstValueFrom(this.groupsApi.removeMember(group.idGrupo, member.usuario.idUsuario)))) {
      this.notice.set(isSelf ? 'Saliste del grupo.' : 'Miembro retirado.');
      void this.locations.refresh();
    }
  }

  protected startInvite(groupId: number): void {
    this.inviteGroupId.set(this.inviteGroupId() === groupId ? null : groupId);
    this.searchResults.set([]);
    this.searchTerm.set('');
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
      const invitation = await firstValueFrom(this.groupsApi.invite(groupId, user.idUsuario));
      if (typeof invitation?.idInvitacion === 'number') {
        this.sentInvitations.update((items) => [...items, invitation]);
      }
      this.notice.set(`Invitación enviada a ${user.nombres} ${user.apellidos}. Aparecerá como miembro cuando la acepte.`);
      this.inviteGroupId.set(null);
      this.error.set(null);
    } catch {
      this.error.set('No se pudo enviar la invitación.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async cancelInvitation(invitation: Invitation): Promise<void> {
    if (!globalThis.confirm(`¿Cancelar la invitación a ${invitation.invitado.nombres} ${invitation.invitado.apellidos}?`)) return;
    if (await this.act(() => firstValueFrom(this.groupsApi.respond(invitation.idInvitacion, 'cancel')))) {
      this.sentInvitations.update((items) => items.filter((item) => item.idInvitacion !== invitation.idInvitacion));
      this.notice.set('Invitación cancelada.');
    }
  }

  protected selectAssignment(event: Event): void {
    this.selectedAssignmentId.set(Number((event.target as HTMLSelectElement).value));
    this.sharing.set([]);
    void this.loadSharing();
  }

  protected async activateLocation(): Promise<void> {
    const device = this.selectedAssignment();
    if (!device || device.ubicacionActiva || this.busy()) return;
    if (!globalThis.confirm(
      `¿Activar la ubicación de ${device.alias || 'dispositivo ' + device.idUsuarioDispositivo}? Podrá compartirse según su visibilidad y los permisos configurados.`,
    )) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const updated = await firstValueFrom(this.http.patch<Assignment>(
        `${PULSO_API_URL}/user-devices/${device.idUsuarioDispositivo}`, { ubicacionActiva: true },
      ));
      if (!updated.ubicacionActiva) throw new Error('El dispositivo sigue pausado.');
      this.assignments.update((items) => items.map((item) => item.idUsuarioDispositivo === device.idUsuarioDispositivo
        ? { ...item, ubicacionActiva: updated.ubicacionActiva } : item));
      this.notice.set('Ubicación activada. El acceso depende de la visibilidad y los permisos de cada grupo.');
      void this.locations.refresh();
    } catch {
      this.error.set('No se pudo activar la ubicación del dispositivo.');
    } finally {
      this.busy.set(false);
    }
  }

  protected groupSharing(groupId: number): GroupSharing | undefined {
    return this.sharing().find((item) => item.idGrupo === groupId);
  }

  protected permissionFor(groupId: number) {
    return this.permissionSummary().find((item) => item.group.idGrupo === groupId);
  }

  protected isSharing(groupId: number): boolean {
    return this.groupSharing(groupId)?.compartiendo ?? false;
  }

  protected isExcluded(groupId: number, userId: number): boolean {
    return this.groupSharing(groupId)?.miembrosExcluidos?.some((member) => member.idUsuario === userId) ?? false;
  }

  protected async toggleSharing(groupId: number): Promise<void> {
    const id = this.selectedAssignmentId();
    if (id === null || this.busy() || !this.groupSharing(groupId)) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.sharingApi.share(id, groupId, !this.isSharing(groupId)));
      await this.loadSharing();
      this.error.set(null);
      void this.locations.refresh();
    } catch {
      this.error.set('No se pudo actualizar el permiso del grupo.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async toggleMemberSharing(groupId: number, member: GroupMember): Promise<void> {
    const id = this.selectedAssignmentId();
    const userId = member.usuario.idUsuario;
    if (id === null || this.busy() || userId === this.session.user()?.idUsuario ||
      !this.isSharing(groupId) || this.selectedAssignment()?.visibilidadPreferida !== 'GRUPO') return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.sharingApi.allowMember(id, groupId, userId, this.isExcluded(groupId, userId)));
      await this.loadSharing();
      this.error.set(null);
      void this.locations.refresh();
    } catch {
      this.error.set('No se pudo actualizar el acceso del miembro.');
    } finally {
      this.busy.set(false);
    }
  }

  private async loadSharing(): Promise<void> {
    const id = this.selectedAssignmentId();
    if (id === null) {
      this.sharing.set([]);
      return;
    }
    try {
      const items = await firstValueFrom(this.sharingApi.list(id));
      if (id === this.selectedAssignmentId()) this.sharing.set(items);
    } catch {
      if (id === this.selectedAssignmentId()) this.error.set('No se pudieron consultar los permisos del dispositivo.');
    }
  }

  protected async create(): Promise<void> {
    const nombre = this.newName().trim();
    const descripcion = this.newDescription().trim();
    if (!nombre || nombre.length > 100 || descripcion.length > 500) return;
    if (await this.act(() => firstValueFrom(this.groupsApi.create(nombre, descripcion)))) {
      this.newName.set('');
      this.newDescription.set('');
      this.showForm.set(false);
    }
  }

  protected async respond(invitation: Invitation, action: 'accept' | 'reject'): Promise<void> {
    if (await this.act(() => firstValueFrom(this.groupsApi.respond(invitation.idInvitacion, action)))) {
      this.notice.set(action === 'accept' ? 'Invitación aceptada.' : 'Invitación rechazada.');
    }
  }

  private async act(operation: () => Promise<unknown>): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set(null);
    try {
      await operation();
      await this.refresh();
      return true;
    } catch {
      this.error.set('No se pudo completar la acción. Inténtalo de nuevo.');
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
