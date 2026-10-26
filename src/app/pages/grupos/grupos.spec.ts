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
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    notificationVersion.set(0);
    http.get.mockImplementation((url: string): Observable<unknown> => of(url.endsWith('/groups')
      ? [{ idGrupo: 1, nombre: 'Familia', idCreador: 1, estado: true, miembros: [member] }]
      : url.endsWith('/groups/1/members') ? [member] : []));
    await TestBed.configureTestingModule({
      imports: [Grupos], providers: [
        { provide: HttpClient, useValue: http },
        { provide: SessionStore, useValue: { user: signal({ idUsuario: 1 }) } },
        { provide: LocationsStore, useValue: { notificationVersion } },
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
      if (url.endsWith('/user-devices/me')) return of([{ idUsuarioDispositivo: 9, alias: 'GPS' }]);
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
});
