import { HttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { Grupos } from './grupos';

describe('Grupos', () => {
  let fixture: ComponentFixture<Grupos>;
  const http = {
    get: vi.fn((url: string): Observable<unknown> => of(url.endsWith('/groups')
      ? [{ idGrupo: 1, nombre: 'Familia', estado: true, miembros: [] }]
      : [])),
    post: vi.fn(() => of({})),
    patch: vi.fn(() => of({})),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Grupos], providers: [{ provide: HttpClient, useValue: http }],
    }).compileComponents();
    fixture = TestBed.createComponent(Grupos);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows groups loaded from the backend', () => {
    expect(fixture.nativeElement.querySelectorAll('.group-card')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Familia');
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
