import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EmergenciesApi } from './emergencies-api';

describe('EmergenciesApi', () => {
  let api: EmergenciesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), EmergenciesApi],
    });
    api = TestBed.inject(EmergenciesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('activates an emergency from WEB without changing GPS visibility', () => {
    api.activate(9, 'Necesito ayuda').subscribe();
    const request = http.expectOne((item) => item.url.endsWith('/emergencies'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      idUsuarioDispositivo: 9, activadaDesde: 'WEB', descripcion: 'Necesito ayuda',
    });
    request.flush({});
  });

  it('uses the decimal string returned for the BigInt identifier when finishing', () => {
    api.finish('123').subscribe();
    const request = http.expectOne((item) => item.url.endsWith('/emergencies/123/finish'));
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});
    request.flush({});
  });

  it('consults a public emergency by code without requiring an ID or a request body', () => {
    api.findPublicByCode('EME-1234ABCD').subscribe();
    const request = http.expectOne((item) => item.url.endsWith('/emergencies/public/EME-1234ABCD'));
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    request.flush({ codigoPublico: 'EME-1234ABCD', estado: 'ACTIVA', ubicacion: null });
  });
});
