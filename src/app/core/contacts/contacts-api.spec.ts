import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ContactsApi } from './contacts-api';

describe('ContactsApi', () => {
  let api: ContactsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ContactsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads accepted contacts and pending requests separately', () => {
    api.list().subscribe();
    api.requests().subscribe();
    http.expectOne((request) => request.url.endsWith('/contacts') && request.method === 'GET').flush([]);
    http.expectOne((request) => request.url.endsWith('/contacts/requests') && request.method === 'GET').flush([]);
  });

  it('sends directional sharing with the documented body', () => {
    api.share(5, true).subscribe();
    const request = http.expectOne((item) => item.url.endsWith('/contacts/5/location-sharing'));
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ comparteUbicacion: true });
    request.flush({});
  });
});
