import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import {
  FormField,
  email,
  form,
  maxLength,
  minLength,
  required,
  submit,
} from '@angular/forms/signals';
import { Router } from '@angular/router';
import { AuthDialogMode, AuthDialogService } from './auth-dialog.service';
import { AuthSession } from './auth-session';

interface LoginFormModel {
  correo: string;
  password: string;
}

interface RegisterFormModel extends LoginFormModel {
  nombres: string;
  apellidos: string;
  telefono: string;
}

@Component({
  selector: 'app-auth-dialog',
  imports: [FormField],
  templateUrl: './auth-dialog.html',
  styleUrl: './auth-dialog.scss',
})
export class AuthDialog {
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  protected readonly dialogState = inject(AuthDialogService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  private readonly loginModel = signal<LoginFormModel>({ correo: '', password: '' });
  private readonly registerModel = signal<RegisterFormModel>({
    nombres: '',
    apellidos: '',
    correo: '',
    telefono: '',
    password: '',
  });

  protected readonly loginForm = form(this.loginModel, (path) => {
    required(path.correo, { message: 'Ingresa tu correo electrónico.' });
    email(path.correo, { message: 'Ingresa un correo electrónico válido.' });
    required(path.password, { message: 'Ingresa tu contraseña.' });
  });

  protected readonly registerForm = form(this.registerModel, (path) => {
    required(path.nombres, { message: 'Ingresa tus nombres.' });
    maxLength(path.nombres, 100, { message: 'Usa como máximo 100 caracteres.' });
    required(path.apellidos, { message: 'Ingresa tus apellidos.' });
    maxLength(path.apellidos, 100, { message: 'Usa como máximo 100 caracteres.' });
    required(path.correo, { message: 'Ingresa tu correo electrónico.' });
    email(path.correo, { message: 'Ingresa un correo electrónico válido.' });
    maxLength(path.telefono, 30, { message: 'Usa como máximo 30 caracteres.' });
    required(path.password, { message: 'Crea una contraseña.' });
    minLength(path.password, 8, { message: 'La contraseña debe tener al menos 8 caracteres.' });
  });

  protected readonly busy = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly showLoginPassword = signal(false);
  protected readonly showRegisterPassword = signal(false);

  constructor() {
    effect(() => {
      const element = this.dialog()?.nativeElement;
      if (!element) {
        return;
      }

      if (this.dialogState.isOpen() && !element.open) {
        element.showModal();
      } else if (!this.dialogState.isOpen() && element.open) {
        element.close();
      }
    });
  }

  protected selectMode(mode: AuthDialogMode): void {
    this.serverError.set(null);
    this.dialogState.setMode(mode);
  }

  protected close(event?: Event): void {
    event?.preventDefault();
    if (!this.busy()) {
      this.resetForms();
      this.dialogState.close();
    }
  }

  protected submitLogin(event: Event): void {
    event.preventDefault();
    this.serverError.set(null);

    void submit(this.loginForm, async () => {
      this.busy.set(true);
      try {
        const value = this.loginModel();
        await this.session.login({ correo: value.correo.trim(), password: value.password });
        await this.finishAuthentication();
        return undefined;
      } catch (error: unknown) {
        this.serverError.set(this.authErrorMessage(error, 'login'));
        return undefined;
      } finally {
        this.busy.set(false);
      }
    });
  }

  protected submitRegister(event: Event): void {
    event.preventDefault();
    this.serverError.set(null);

    void submit(this.registerForm, async () => {
      this.busy.set(true);
      try {
        const value = this.registerModel();
        const telefono = value.telefono.trim();
        await this.session.register({
          nombres: value.nombres.trim(),
          apellidos: value.apellidos.trim(),
          correo: value.correo.trim(),
          password: value.password,
          ...(telefono ? { telefono } : {}),
        });
        await this.finishAuthentication();
        return undefined;
      } catch (error: unknown) {
        this.serverError.set(this.authErrorMessage(error, 'register'));
        return undefined;
      } finally {
        this.busy.set(false);
      }
    });
  }

  protected toggleLoginPassword(): void {
    this.showLoginPassword.update((visible) => !visible);
  }

  protected toggleRegisterPassword(): void {
    this.showRegisterPassword.update((visible) => !visible);
  }

  private async finishAuthentication(): Promise<void> {
    const returnUrl = this.dialogState.returnUrl();
    this.resetForms();
    this.dialogState.close();
    await this.router.navigateByUrl(returnUrl);
  }

  private resetForms(): void {
    this.loginForm().reset({ correo: '', password: '' });
    this.registerForm().reset({
      nombres: '',
      apellidos: '',
      correo: '',
      telefono: '',
      password: '',
    });
    this.serverError.set(null);
    this.showLoginPassword.set(false);
    this.showRegisterPassword.set(false);
  }

  private authErrorMessage(error: unknown, mode: AuthDialogMode): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'No se pudo conectar con el servicio. Inténtalo nuevamente.';
    }

    if (error.status === 0) {
      return 'No se pudo conectar con el servicio. Revisa tu conexión e inténtalo nuevamente.';
    }

    if (error.status === 401 && mode === 'login') {
      return 'El correo o la contraseña son incorrectos.';
    }

    if (error.status === 409 && mode === 'register') {
      return 'Ya existe una cuenta registrada con este correo.';
    }

    return mode === 'login'
      ? 'No se pudo iniciar sesión. Inténtalo nuevamente.'
      : 'No se pudo crear la cuenta. Inténtalo nuevamente.';
  }
}
