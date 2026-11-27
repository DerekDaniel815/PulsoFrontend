import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UserDevicesApi } from './user-devices-api';

describe('UserDevicesApi', () => {
  let api: UserDevicesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), UserDevicesApi],
    });
    api = TestBed.inject(UserDevicesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists own assignments including historical records', () => {
    api.list().subscribe();
    const request = http.expectOne((item) => item.url.endsWith('/user-devices/me'));
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('links using the public code and not the firmware token', () => {
    api.link({ codigoDispositivo: 'PUL-ABC123', alias: 'Casa' }).subscribe();
    const request = http.expectOne((item) => item.url.endsWith('/user-devices'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ codigoDispositivo: 'PUL-ABC123', alias: 'Casa' });
    request.flush({});
  });

  it('edits an assignment and unlinks with the documented POST endpoint', () => {
    api.update(9, { alias: 'Nuevo' }).subscribe();
    const update = http.expectOne((item) => item.url.endsWith('/user-devices/9'));
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ alias: 'Nuevo' });
    update.flush({});

    api.unlink(9).subscribe();
    const unlink = http.expectOne((item) => item.url.endsWith('/user-devices/9/unlink'));
    expect(unlink.request.method).toBe('POST');
    unlink.flush({});
  });
});
