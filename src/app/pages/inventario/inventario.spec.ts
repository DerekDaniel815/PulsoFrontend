import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PulsoUser } from '../../core/auth/auth.models';
import { SessionStore } from '../../core/auth/session-store';
import { DevicesApi, InventoryDevice } from '../../core/devices/devices-api';
import { Inventario } from './inventario';

const ADMIN: PulsoUser = {
  idUsuario: 1, nombres: 'Ana', apellidos: 'Ruiz',
  correo: 'ana@example.com', rol: 'ADMIN', estado: true,
  fechaRegistro: '', fechaActualizacion: '',
};
const DEVICE: InventoryDevice = {
  idDispositivo: 7, codigoDispositivo: 'PUL-12345678',
  imei: null, modelo: 'GPS', numeroSerie: null, estado: 'FABRICADO',
  ultimaConexion: null, fechaFabricacion: null, fechaRegistro: '2026-11-22T10:00:00Z',
};

describe('Inventario', () => {
  let fixture: ComponentFixture<Inventario>;
  const user = signal<PulsoUser | null>(ADMIN);
  const token = signal<string | null>('jwt');
  const devicesApi = {
    list: vi.fn(() => of([DEVICE])),
    get: vi.fn((_id: number) => of(DEVICE)),
    create: vi.fn((_input: unknown) => of({ ...DEVICE, idDispositivo: 8,
      codigoDispositivo: 'PUL-87654321', deviceToken: 'pul_one_time' })),
    update: vi.fn((_id: number, _change: unknown) => of({ ...DEVICE, estado: 'DISPONIBLE' as const })),
    regenerateToken: vi.fn((_id: number) => of({ ...DEVICE, deviceToken: 'pul_new_secret' })),
  };

  beforeEach(async () => {
    user.set(ADMIN);
    token.set('jwt');
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
    await TestBed.configureTestingModule({
      imports: [Inventario],
      providers: [
        { provide: DevicesApi, useValue: devicesApi },
        { provide: SessionStore, useValue: {
          user, token, isAuthenticated: computed(() => !!user() && !!token()),
        } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Inventario);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows the server inventory without displaying a firmware token', async () => {
    expect(fixture.nativeElement.textContent).toContain('PUL-12345678');
    expect(fixture.nativeElement.textContent).toContain('Sin conexión registrada');
    expect(fixture.nativeElement.textContent).not.toContain('deviceToken');
    (fixture.nativeElement.querySelector('tbody button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(devicesApi.get).toHaveBeenCalledWith(7);
    expect(fixture.nativeElement.querySelector('.device-details').textContent).toContain('Fabricado');
  });

  it('creates a device without supplying its backend-generated code and hides the one-time token', async () => {
    fixture.componentInstance['createForm'].patchValue({ modelo: 'Nuevo GPS', imei: '123' });
    (fixture.nativeElement.querySelector('.create-device button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(devicesApi.create).toHaveBeenCalledWith({ modelo: 'Nuevo GPS', imei: '123' });
    expect(fixture.nativeElement.querySelector('.credential-receipt').textContent)
      .toContain('pul_one_time');
    expect(fixture.nativeElement.querySelector('.inventory-list').textContent).not.toContain('pul_one_time');
    (fixture.nativeElement.querySelector('.credential-receipt button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('pul_one_time');
  });

  it('updates device availability without allowing manual ASIGNADO status', async () => {
    (fixture.nativeElement.querySelector('tbody button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('.edit-device select') as HTMLSelectElement;
    expect((select.querySelector('option[value="ASIGNADO"]') as HTMLOptionElement).disabled).toBe(true);
    fixture.componentInstance['editForm'].patchValue({ estado: 'DISPONIBLE' });
    (fixture.nativeElement.querySelector('.edit-device button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(devicesApi.update).toHaveBeenCalledWith(7, { estado: 'DISPONIBLE' });
    expect(fixture.nativeElement.querySelector('.device-details').textContent).toContain('Disponible');
  });

  it('asks for confirmation before invalidating the old firmware token', async () => {
    (fixture.nativeElement.querySelector('tbody button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    vi.mocked(globalThis.confirm).mockReturnValueOnce(false);
    const regenerate = fixture.nativeElement.querySelector('.token-action button') as HTMLButtonElement;
    regenerate.click();
    expect(devicesApi.regenerateToken).not.toHaveBeenCalled();

    regenerate.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(devicesApi.regenerateToken).toHaveBeenCalledWith(7);
    expect(fixture.nativeElement.querySelector('.credential-receipt').textContent).toContain('pul_new_secret');
  });

  it('reports a conflict without publishing a token or inventing a code', async () => {
    devicesApi.create.mockImplementationOnce(() => throwError(() => new HttpErrorResponse({ status: 409 })));
    (fixture.nativeElement.querySelector('.create-device button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Conflicto');
    expect(fixture.nativeElement.querySelector('.credential-receipt')).toBeNull();
  });

  it('reports a forbidden inventory response without exposing device data', async () => {
    devicesApi.list.mockImplementationOnce(() => throwError(() => new HttpErrorResponse({ status: 403 })));
    await fixture.componentInstance['loadDevices']();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('rol ADMIN');
    expect(fixture.nativeElement.querySelector('.credential-receipt')).toBeNull();
  });

  it('does not request inventory for USUARIO and removes secrets when the role changes', async () => {
    (fixture.nativeElement.querySelector('.create-device button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    user.set({ ...ADMIN, rol: 'USUARIO' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('pul_one_time');
    expect(fixture.nativeElement.querySelector('.inventory-page')).toBeNull();
    expect(fixture.componentInstance['devices']()).toEqual([]);
    const count = devicesApi.list.mock.calls.length;
    await fixture.componentInstance['loadDevices']();
    expect(devicesApi.list).toHaveBeenCalledTimes(count);
  });
});
