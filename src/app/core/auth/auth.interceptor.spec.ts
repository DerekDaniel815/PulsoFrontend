import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from './auth.interceptor';
import { PULSO_API_URL } from './auth.config';
import { AuthResponse } from './auth.models';
import { SessionStore } from './session-store';

const SESSION: AuthResponse = {
  accessToken: 'test-token',
  user: {
    idUsuario: 1,
    nombres: 'Test',
    apellidos: 'User',
    correo: 'test@example.com',
    rol: 'USUARIO',
    estado: true,
    fechaRegistro: '2026-09-20T10:00:00.000Z',
    fechaActualizacion: '2026-09-20T10:00:00.000Z',
  },
};

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let store: SessionStore;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SessionStore);
    store.establish(SESSION);
  });

  afterEach(() => http.verify());

  it('adds the bearer token only to Pulso API requests', () => {
    const client = TestBed.inject(HttpClient);

    client.get(`${PULSO_API_URL}/users/me`).subscribe();
    const apiRequest = http.expectOne(`${PULSO_API_URL}/users/me`);
    expect(apiRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    apiRequest.flush(SESSION.user);

    client.get('/maps-config.json').subscribe();
    const mapRequest = http.expectOne('/maps-config.json');
    expect(mapRequest.request.headers.has('Authorization')).toBe(false);
    mapRequest.flush({});
  });

  it('does not add an existing token to public authentication requests', () => {
    const client = TestBed.inject(HttpClient);
    client
      .post(`${PULSO_API_URL}/auth/login`, {
        correo: 'test@example.com',
        password: 'password123',
      })
      .subscribe();

    const request = http.expectOne(`${PULSO_API_URL}/auth/login`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(SESSION);
  });

  it('clears the session after a protected 401 response', () => {
    const client = TestBed.inject(HttpClient);
    client.get(`${PULSO_API_URL}/users/me`).subscribe({ error: () => undefined });

    http
      .expectOne(`${PULSO_API_URL}/users/me`)
      .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(store.token()).toBeNull();
    expect(store.user()).toBeNull();
  });
});
