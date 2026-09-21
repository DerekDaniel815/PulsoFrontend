import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from './auth-api';
import { LoginRequest, RegisterRequest } from './auth.models';
import { SessionStore } from './session-store';

@Service()
export class AuthSession {
  private readonly api = inject(AuthApi);
  private readonly store = inject(SessionStore);

  async initialize(): Promise<void> {
    if (!this.store.token()) {
      return;
    }

    try {
      this.store.setUser(await firstValueFrom(this.api.getCurrentUser()));
    } catch {
      this.store.clear();
    }
  }

  async login(credentials: LoginRequest): Promise<void> {
    this.store.establish(await firstValueFrom(this.api.login(credentials)));
  }

  async register(data: RegisterRequest): Promise<void> {
    this.store.establish(await firstValueFrom(this.api.register(data)));
  }

  logout(): void {
    this.store.clear();
  }
}
