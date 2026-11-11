import { HttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { SessionStore } from '../../core/auth/session-store';
import { LocationsStore } from '../../core/locations/locations-store';
import { Grupos } from './grupos';

describe('Grupos', () => {
  let fixture: ComponentFixture<Grupos>;
  const notificationVersion = signal(0);
  const member = {
    idGrupoUsuario: 3,
    usuario: { idUsuario: 1, nombres: 'Lucía', apellidos: 'García' },
    rol: 'ADMIN',
  };
  const http = {
    get: vi.fn<(url: string) => Observable<unknown>>(),
    post: vi.fn(() => of({})),
    patch: vi.fn(() => of({})),
    delete: vi.fn(() => of({})),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    notificationVersion.set(0);
    http.get.mockImplementation((url: string): Observable<unknown> => of(url.endsWith('/groups')
      ? [{ idGrupo: 1, nombre: 'Familia', idCreador: 1, estado: true, miembros: [member] }]
      : url.endsWith('/groups/1/members') ? [member] : []));
    await TestBed.configureTestingModule({
      imports: [Grupos], providers: [
        { provide: HttpClient, useValue: http },
        { provide: SessionStore, useValue: { user: signal({ idUsuario: 1 }) } },
        { provide: LocationsStore, useValue: { notificationVersion, refresh: vi.fn(() => Promise.resolve()) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Grupos);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows groups loaded from the backend', () => {
    expect(fixture.nativeElement.querySelectorAll('.group-card')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Familia');
  });

  it('shows member names and roles from the group members API', async () => {
    (fixture.nativeElement.querySelector('.members-toggle') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/groups/1/members'));
    expect(fixture.nativeElement.querySelector('.members-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('.member-list').textContent).toContain('Lucía García');
    expect(fixture.nativeElement.querySelector('.member-list').textContent).toContain('Administrador');
  });

  it('refreshes the accepted members when a notification arrives', async () => {
    http.get.mockImplementation((url: string): Observable<unknown> => of(url.endsWith('/groups')
      ? [{ idGrupo: 1, nombre: 'Familia', estado: true, miembros: [member, {
          idGrupoUsuario: 4,
          usuario: { idUsuario: 8, nombres: 'Ana', apellidos: 'Ruiz' },
          rol: 'MIEMBRO',
        }] }]
      : url.endsWith('/groups/1/members') ? [member, {
          idGrupoUsuario: 4,
          usuario: { idUsuario: 8, nombres: 'Ana', apellidos: 'Ruiz' },
          rol: 'MIEMBRO',
        }] : []));
    notificationVersion.set(1);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/groups'));
    (fixture.nativeElement.querySelector('.members-toggle') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.member-list').textContent).toContain('Ana Ruiz');
    expect(fixture.nativeElement.querySelector('.member-list').textContent).toContain('Miembro');
  });

  it('creates a group using the documented endpoint', async () => {
    (fixture.nativeElement.querySelector('.new-group') as HTMLButtonElement).click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'Amigos';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/groups'), { nombre: 'Amigos' });
  });

  it('explains that an invited user appears only after accepting', async () => {
    await fixture.componentInstance['invite'](1, { idUsuario: 8, nombres: 'Ana', apellidos: 'Ruiz' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent)
      .toContain('Aparecerá como miembro cuando la acepte');
    expect(fixture.nativeElement.querySelector('.group-name').textContent).toContain('1 miembro');
  });

  it('updates directional sharing for a selected device and group', async () => {
    http.get.mockImplementation((url: string) => {
      if (url.endsWith('/groups')) return of([{ idGrupo: 1, nombre: 'Familia', estado: true, miembros: [] }]);
      if (url.endsWith('/user-devices/me')) return of([{ idUsuarioDispositivo: 9, alias: 'GPS', visibilidadPreferida: 'GRUPO', ubicacionActiva: true }]);
      if (url.endsWith('/user-devices/9/groups-sharing')) return of([{ idGrupo: 1, nombre: 'Familia', compartiendo: false, miembrosExcluidos: [] }]);
      return of([]);
    });
    fixture.destroy();
    fixture = TestBed.createComponent(Grupos);
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.switch') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(http.patch).toHaveBeenCalledWith(expect.stringContaining('/user-devices/9/groups/1/sharing'), { comparteUbicacion: true });
  });

  afterEach(() => vi.restoreAllMocks());

  it('edits a group name and description as an administrator', async () => {
    (fixture.nativeElement.querySelector('.members-toggle') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.group-admin-actions button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const fields = fixture.nativeElement.querySelectorAll('.members-panel input') as NodeListOf<HTMLInputElement>;
    fields[0].value = 'Familia cercana';
    fields[0].dispatchEvent(new Event('input'));
    fields[1].value = 'Personas de confianza';
    fields[1].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.members-panel button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(http.patch).toHaveBeenCalledWith(expect.stringContaining('/groups/1'), {
      nombre: 'Familia cercana', descripcion: 'Personas de confianza',
    });
  });

  it('confirms before deactivating a group', async () => {
    (fixture.nativeElement.querySelector('.members-toggle') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement.querySelectorAll('.group-admin-actions button')[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(globalThis.confirm).toHaveBeenCalled();
    expect(http.patch).toHaveBeenCalledWith(expect.stringContaining('/groups/1'), { estado: false });
  });

  it('lets a member leave the group after confirmation', async () => {
    (fixture.nativeElement.querySelector('.members-toggle') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.member-row button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(http.delete).toHaveBeenCalledWith(expect.stringContaining('/groups/1/members/1'));
  });

  it('does not remove a member when confirmation is declined', async () => {
    vi.mocked(globalThis.confirm).mockReturnValueOnce(false);
    (fixture.nativeElement.querySelector('.members-toggle') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.member-row button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(http.delete).not.toHaveBeenCalled();
  });

  it('excludes and restores a member for the selected group and device', async () => {
    http.get.mockImplementation((url: string): Observable<unknown> => of(url.endsWith('/groups')
      ? [{ idGrupo: 1, nombre: 'Familia', idCreador: 1, estado: true, miembros: [member, {
          idGrupoUsuario: 4, usuario: { idUsuario: 8, nombres: 'Ana', apellidos: 'Ruiz' }, rol: 'MIEMBRO',
        }] }]
      : url.endsWith('/groups/1/members') ? [member, {
          idGrupoUsuario: 4, usuario: { idUsuario: 8, nombres: 'Ana', apellidos: 'Ruiz' }, rol: 'MIEMBRO',
        }]
      : url.endsWith('/user-devices/me') ? [{ idUsuarioDispositivo: 9, alias: 'GPS', visibilidadPreferida: 'GRUPO', ubicacionActiva: true }]
      : url.endsWith('/user-devices/9/groups-sharing') ? [{ idGrupo: 1, nombre: 'Familia', compartiendo: true, miembrosExcluidos: [] }]
      : []));
    fixture.destroy();
    fixture = TestBed.createComponent(Grupos);
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.members-toggle') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    const button = Array.from(fixture.nativeElement.querySelectorAll('.member-row button') as NodeListOf<HTMLButtonElement>)
      .find((item) => item.textContent?.includes('Excluir de ubicación'))!;
    button.click();
    await fixture.whenStable();
    expect(http.patch).toHaveBeenCalledWith(
      expect.stringContaining('/user-devices/9/groups/1/members/8/sharing'), { permitido: false },
    );
  });

  it('hides administrator actions for non-admin members', async () => {
    http.get.mockImplementation((url: string): Observable<unknown> => of(url.endsWith('/groups')
      ? [{ idGrupo: 1, nombre: 'Familia', idCreador: 8, estado: true, miembros: [{ ...member, rol: 'MIEMBRO' }] }]
      : url.endsWith('/groups/1/members') ? [{ ...member, rol: 'MIEMBRO' }] : []));
    fixture.destroy();
    fixture = TestBed.createComponent(Grupos);
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.members-toggle') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.group-admin-actions')).toBeNull();
    expect(fixture.nativeElement.querySelector('.invite-toggle')).toBeNull();
    expect(fixture.nativeElement.querySelector('.member-row button')?.textContent).toContain('Salir del grupo');
  });

  it('restores an excluded member using permitido true', async () => {
    http.get.mockImplementation((url: string): Observable<unknown> => of(url.endsWith('/groups')
      ? [{ idGrupo: 1, nombre: 'Familia', idCreador: 1, estado: true, miembros: [member, {
          idGrupoUsuario: 4, usuario: { idUsuario: 8, nombres: 'Ana', apellidos: 'Ruiz' }, rol: 'MIEMBRO',
        }] }]
      : url.endsWith('/groups/1/members') ? [member, {
          idGrupoUsuario: 4, usuario: { idUsuario: 8, nombres: 'Ana', apellidos: 'Ruiz' }, rol: 'MIEMBRO',
        }]
      : url.endsWith('/user-devices/me') ? [{ idUsuarioDispositivo: 9, alias: 'GPS', visibilidadPreferida: 'GRUPO', ubicacionActiva: true }]
      : url.endsWith('/user-devices/9/groups-sharing') ? [{ idGrupo: 1, nombre: 'Familia', compartiendo: true,
          miembrosExcluidos: [{ idUsuario: 8, nombres: 'Ana', apellidos: 'Ruiz' }] }]
      : []));
    fixture.destroy();
    fixture = TestBed.createComponent(Grupos);
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.members-toggle') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    const button = Array.from(fixture.nativeElement.querySelectorAll('.member-row button') as NodeListOf<HTMLButtonElement>)
      .find((item) => item.textContent?.includes('Volver a permitir ubicación'))!;
    button.click();
    await fixture.whenStable();
    expect(http.patch).toHaveBeenCalledWith(
      expect.stringContaining('/user-devices/9/groups/1/members/8/sharing'), { permitido: true },
    );
  });

  it('can cancel an invitation sent in the current session', async () => {
    http.post.mockReturnValueOnce(of({ idInvitacion: 25, idGrupo: 1, nombreGrupo: 'Familia',
      invitado: { nombres: 'Ana', apellidos: 'Ruiz' } }));
    await fixture.componentInstance['invite'](1, { idUsuario: 8, nombres: 'Ana', apellidos: 'Ruiz' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Invitaciones enviadas en esta sesión');
    (fixture.nativeElement.querySelector('#sent-invites-title ~ p button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(http.patch).toHaveBeenCalledWith(expect.stringContaining('/groups/invitations/25/cancel'), {});
  });
});
