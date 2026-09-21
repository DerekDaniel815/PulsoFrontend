import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthApi } from './auth-api';
import { PULSO_API_URL } from './auth.config';
import { AuthResponse, PulsoUser } from './auth.models';

const USER: PulsoUser = {
  idUsuario: 7,
  nombres: 'Ana',
  apellidos: 'Pérez',
  correo: 'ana@example.com',
  telefono: null,
  rol: 'USUARIO',
  estado: true,
  fechaRegistro: '2026-09-20T10:00:00.000Z',
  fechaActualizacion: '2026-09-20T10:00:00.000Z',
};

const AUTH_RESPONSE: AuthResponse = { accessToken: 'jwt-token', user: USER };

describe('AuthApi', () => {
  let api: AuthApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AuthApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses the auth login endpoint', () => {
    const credentials = { correo: USER.correo, password: 'password123' };
    api.login(credentials).subscribe((response) => expect(response).toEqual(AUTH_RESPONSE));

    const request = http.expectOne(`${PULSO_API_URL}/auth/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(credentials);
    request.flush(AUTH_RESPONSE);
  });

  it('uses the auth register endpoint', () => {
    const registration = {
      nombres: USER.nombres,
      apellidos: USER.apellidos,
      correo: USER.correo,
      password: 'password123',
    };
    api.register(registration).subscribe((response) => expect(response).toEqual(AUTH_RESPONSE));

    const request = http.expectOne(`${PULSO_API_URL}/auth/register`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(registration);
    request.flush(AUTH_RESPONSE);
  });

  it('loads the current profile from users', () => {
    api.getCurrentUser().subscribe((response) => expect(response).toEqual(USER));

    const request = http.expectOne(`${PULSO_API_URL}/users/me`);
    expect(request.request.method).toBe('GET');
    request.flush(USER);
  });
});
