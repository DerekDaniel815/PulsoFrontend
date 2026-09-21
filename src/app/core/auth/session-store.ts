import { Service, computed, signal } from '@angular/core';
import { AuthResponse, PulsoUser } from './auth.models';

const TOKEN_KEY = 'pulso.access-token';

@Service()
export class SessionStore {
  private readonly tokenState = signal(this.readStoredToken());
  private readonly userState = signal<PulsoUser | null>(null);

  readonly token = this.tokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.tokenState() && this.userState()));

  establish(response: AuthResponse): void {
    this.tokenState.set(response.accessToken);
    this.userState.set(response.user);
    this.storage?.setItem(TOKEN_KEY, response.accessToken);
  }

  setUser(user: PulsoUser): void {
    this.userState.set(user);
  }

  clear(): void {
    this.tokenState.set(null);
    this.userState.set(null);
    this.storage?.removeItem(TOKEN_KEY);
  }

  private get storage(): Storage | null {
    try {
      return globalThis.sessionStorage ?? null;
    } catch {
      return null;
    }
  }

  private readStoredToken(): string | null {
    return this.storage?.getItem(TOKEN_KEY) ?? null;
  }
}
