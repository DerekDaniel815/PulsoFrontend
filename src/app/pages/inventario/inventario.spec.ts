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
  const inventory = Array.from({ length: 23 }, (_, index) => ({
    ...DEVICE,
    idDispositivo: index + 1,
    codigoDispositivo: `PUL-${String(index + 1).padStart(8, '0')}`,
    ultimaConexion: index === 0 ? '2026-11-22T10:00:00Z' : null,
  }));
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
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
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
    expect(fixture.nativeElement.querySelector('.inventory-layout > .inventory-list .table-scroll')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.inventory-layout > .inventory-tools .create-device')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.inventory-tools').getAttribute('aria-label'))
      .toBe('Registro y detalles de equipos');
    expect(fixture.nativeElement.textContent).toContain('PUL-12345678');
    expect(fixture.nativeElement.textContent).toContain('Sin conexión registrada');
    expect(fixture.nativeElement.textContent).not.toContain('deviceToken');
    (fixture.nativeElement.querySelector('tbody button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(devicesApi.get).toHaveBeenCalledWith(7);
    expect(fixture.nativeElement.querySelector('.device-details').textContent).toContain('Fabricado');
    expect(fixture.nativeElement.querySelector('.inventory-tools .device-details')).not.toBeNull();
  });

  it('paginates consistently formatted devices without requesting another list', async () => {
    devicesApi.list.mockReturnValueOnce(of(inventory));
    await fixture.componentInstance['loadDevices']();
    fixture.detectChanges();
    const rows = () => fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>;
    const buttons = () => fixture.nativeElement.querySelectorAll('.pagination-actions button') as NodeListOf<HTMLButtonElement>;
    const listCalls = devicesApi.list.mock.calls.length;

    expect(rows()).toHaveLength(10);
    expect(rows()[0].textContent).toContain('PUL-00000001');
    expect(rows()[0].querySelector('time')?.textContent).toMatch(/\d{2}\/\d{2}\/2026, \d{2}:\d{2}/);
    expect(rows()[0].querySelector('time')?.getAttribute('datetime')).toBe('2026-11-22T10:00:00Z');
    expect(fixture.nativeElement.querySelector('.page-summary').textContent).toContain('Mostrando 1–10 de 23');
    const pagination = fixture.nativeElement.querySelector('.inventory-pagination') as HTMLElement;
    expect(getComputedStyle(pagination).display).toBe('grid');
    expect(pagination.firstElementChild?.classList.contains('page-summary')).toBe(true);
    expect(pagination.lastElementChild?.classList.contains('pagination-actions')).toBe(true);
    expect(buttons()[0].getAttribute('aria-disabled')).toBe('true');
    buttons()[0].click();
    fixture.detectChanges();
    expect(rows()[0].textContent).toContain('PUL-00000001');

    buttons()[1].click();
    fixture.detectChanges();
    expect(rows()).toHaveLength(10);
    expect(rows()[0].textContent).toContain('PUL-00000011');
    expect(fixture.nativeElement.querySelector('.page-summary').textContent).toContain('Página 2 de 3');

    buttons()[1].click();
    fixture.detectChanges();
    expect(rows()).toHaveLength(3);
    expect(rows()[0].textContent).toContain('PUL-00000021');
    expect(buttons()[1].getAttribute('aria-disabled')).toBe('true');
    buttons()[1].click();
    fixture.detectChanges();
    expect(rows()).toHaveLength(3);
    expect(devicesApi.list).toHaveBeenCalledTimes(listCalls);
  });

  it('fits as many rows as possible and keeps the current item visible on resize', async () => {
    devicesApi.list.mockReturnValueOnce(of(inventory));
    await fixture.componentInstance['loadDevices']();
    fixture.detectChanges();
    const viewport = fixture.nativeElement.querySelector('.table-scroll') as HTMLElement;
    const header = viewport.querySelector('thead') as HTMLElement;
    let height = 36 + 42 * 15 + 1;
    vi.spyOn(viewport, 'clientHeight', 'get').mockImplementation(() => height);
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({ height: 36 } as DOMRect);
    const listCalls = devicesApi.list.mock.calls.length;

    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(15);
    expect(fixture.nativeElement.querySelector('.page-summary').textContent).toContain('Mostrando 1–15 de 23');
    fixture.componentInstance['goToPage'](2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('tbody tr').textContent).toContain('PUL-00000016');

    height = 36 + 42 * 7 + 1;
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(fixture.componentInstance['pageSize']()).toBe(7);
    expect(fixture.componentInstance['currentPage']()).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(7);
    expect(fixture.nativeElement.querySelectorAll('tbody tr')[1].textContent).toContain('PUL-00000016');

    height = 36 + 42 * 30 + 1;
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(23);
    expect(fixture.nativeElement.querySelector('.pagination-actions')).toBeNull();
    expect(devicesApi.list).toHaveBeenCalledTimes(listCalls);
  });

  it('adapts the number of rows on narrower layouts without a ten-row cap', async () => {
    devicesApi.list.mockReturnValueOnce(of(inventory));
    await fixture.componentInstance['loadDevices']();
    fixture.detectChanges();
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
    vi.stubGlobal('innerHeight', 1100);
    const viewport = fixture.nativeElement.querySelector('.table-scroll') as HTMLElement;
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ top: 200 } as DOMRect);

    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(14);
    expect(fixture.nativeElement.querySelector('.page-summary').textContent).toContain('Mostrando 1–14 de 23');
  });

  it('clamps the page after refresh and returns to the first page when a device is created', async () => {
    devicesApi.list.mockReturnValueOnce(of(inventory));
    await fixture.componentInstance['loadDevices']();
    fixture.componentInstance['goToPage'](3);
    fixture.detectChanges();
    expect(fixture.componentInstance['visibleDevices']()).toHaveLength(3);

    devicesApi.list.mockReturnValueOnce(of(inventory.slice(0, 12)));
    await fixture.componentInstance['loadDevices']();
    fixture.detectChanges();
    expect(fixture.componentInstance['currentPage']()).toBe(2);
    expect(fixture.componentInstance['visibleDevices']()).toHaveLength(2);

    (fixture.nativeElement.querySelector('.create-device button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance['currentPage']()).toBe(1);
    expect(fixture.nativeElement.querySelector('tbody tr').textContent).toContain('PUL-87654321');
    expect(fixture.nativeElement.querySelector('.inventory-list').textContent).not.toContain('pul_one_time');
    expect(fixture.nativeElement.querySelector('.inventory-tools .credential-receipt').textContent)
      .toContain('pul_one_time');
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
