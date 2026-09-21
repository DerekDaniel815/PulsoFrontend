import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PULSO_API_URL } from './auth.config';
import { AuthResponse, LoginRequest, PulsoUser, RegisterRequest } from './auth.models';

@Service()
export class AuthApi {
  private readonly http = inject(HttpClient);

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${PULSO_API_URL}/auth/login`, credentials);
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${PULSO_API_URL}/auth/register`, data);
  }

  getCurrentUser(): Observable<PulsoUser> {
    return this.http.get<PulsoUser>(`${PULSO_API_URL}/users/me`);
  }
}
