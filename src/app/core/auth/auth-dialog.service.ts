import { Service, signal } from '@angular/core';

export type AuthDialogMode = 'login' | 'register';

@Service()
export class AuthDialogService {
  private readonly openState = signal(false);
  private readonly modeState = signal<AuthDialogMode>('login');
  private readonly returnUrlState = signal('/dashboard');

  readonly isOpen = this.openState.asReadonly();
  readonly mode = this.modeState.asReadonly();
  readonly returnUrl = this.returnUrlState.asReadonly();

  open(mode: AuthDialogMode = 'login', returnUrl = '/dashboard'): void {
    this.modeState.set(mode);
    this.returnUrlState.set(this.safeReturnUrl(returnUrl));
    this.openState.set(true);
  }

  setMode(mode: AuthDialogMode): void {
    this.modeState.set(mode);
  }

  close(): void {
    this.openState.set(false);
  }

  private safeReturnUrl(returnUrl: string): string {
    return returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/dashboard';
  }
}
