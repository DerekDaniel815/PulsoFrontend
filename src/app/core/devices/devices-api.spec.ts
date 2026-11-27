import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PULSO_API_URL } from '../auth/auth.config';
import { DevicesApi, InventoryDevice } from './devices-api';

const DEVICE: InventoryDevice = {
  idDispositivo: 7, codigoDispositivo: 'PUL-12345678', imei: null,
  modelo: 'GPS', numeroSerie: null, estado: 'FABRICADO',
  ultimaConexion: null, fechaFabricacion: null, fechaRegistro: '2026-11-22T10:00:00Z',
};

describe('DevicesApi', () => {
  let api: DevicesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(DevicesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists and fetches inventory without a device token', () => {
    api.list().subscribe((items) => expect(items).toEqual([DEVICE]));
    http.expectOne(`${PULSO_API_URL}/devices`).flush([DEVICE]);
    api.get(7).subscribe((item) => expect(item).toEqual(DEVICE));
    http.expectOne(`${PULSO_API_URL}/devices/7`).flush(DEVICE);
  });

  it('creates without a code and receives the one-time firmware token', () => {
    api.create({ modelo: 'GPS' }).subscribe((item) =>
      expect(item.deviceToken).toBe('pul_secret'));
    const request = http.expectOne(`${PULSO_API_URL}/devices`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ modelo: 'GPS' });
    request.flush({ ...DEVICE, deviceToken: 'pul_secret' });
  });

  it('updates status and regenerates the token through separate routes', () => {
    api.update(7, { estado: 'DISPONIBLE' }).subscribe();
    const update = http.expectOne(`${PULSO_API_URL}/devices/7`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ estado: 'DISPONIBLE' });
    update.flush({ ...DEVICE, estado: 'DISPONIBLE' });

    api.regenerateToken(7).subscribe((item) => expect(item.deviceToken).toBe('pul_new'));
    const regenerate = http.expectOne(`${PULSO_API_URL}/devices/7/token`);
    expect(regenerate.request.method).toBe('POST');
    expect(regenerate.request.body).toBeNull();
    regenerate.flush({ ...DEVICE, deviceToken: 'pul_new' }, { status: 201, statusText: 'Created' });
  });
});
