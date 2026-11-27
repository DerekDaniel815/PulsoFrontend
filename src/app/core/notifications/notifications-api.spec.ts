import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NotificationsApi } from './notifications-api';

describe('NotificationsApi', () => {
  let api: NotificationsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), NotificationsApi] });
    api = TestBed.inject(NotificationsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests a page of all notifications', () => {
    api.list(20, 40).subscribe();
    const request = http.expectOne((item) => item.url.endsWith('/notifications'));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('limit')).toBe('20');
    expect(request.request.params.get('offset')).toBe('40');
    request.flush([]);
  });

  it('requests a page of unread notifications from its own endpoint', () => {
    api.unread(20, 20).subscribe();
    const request = http.expectOne((item) => item.url.endsWith('/notifications/unread'));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('limit')).toBe('20');
    expect(request.request.params.get('offset')).toBe('20');
    request.flush([]);
  });

  it('marks the notification ID as read, not the recipient-row ID', () => {
    api.read('106').subscribe();
    const request = http.expectOne((item) => item.url.endsWith('/notifications/106/read'));
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});
    request.flush({ idNotificacion: '106', idNotificacionUsuario: '6', leida: true });
  });
});
