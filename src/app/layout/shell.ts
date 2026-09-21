import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthDialogService } from '../core/auth/auth-dialog.service';
import { AuthDialog } from '../core/auth/auth-dialog';
import { AuthSession } from '../core/auth/auth-session';
import { SessionStore } from '../core/auth/session-store';
import { LayoutMode } from './layout-mode';
import { NAV_ITEMS } from './nav';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AuthDialog],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private loggingOut = false;
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSession);
  private readonly authDialog = inject(AuthDialogService);
  protected readonly session = inject(SessionStore);
  protected readonly layout = inject(LayoutMode);

  protected readonly navItems = NAV_ITEMS;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly pageTitle = computed(() => {
    const current = this.url();
    return this.navItems.find((item) => current.startsWith(item.path))?.label ?? 'Dashboard';
  });

  protected readonly userName = computed(() => {
    const user = this.session.user();
    return user ? `${user.nombres} ${user.apellidos}`.trim() : 'Invitado';
  });

  protected readonly userInitials = computed(() => {
    const user = this.session.user();
    if (!user) {
      return 'IN';
    }

    const first = user.nombres.trim().charAt(0);
    const last = user.apellidos.trim().charAt(0);
    return `${first}${last}`.toUpperCase() || user.correo.charAt(0).toUpperCase();
  });

  constructor() {
    effect(() => {
      const currentUrl = this.url();
      if (this.session.isAuthenticated() || this.loggingOut || currentUrl.startsWith('/dashboard')) {
        return;
      }

      this.authDialog.open('login', currentUrl);
      void this.router.navigate(['/dashboard']);
    });
  }

  protected openAuthentication(): void {
    this.authDialog.open('login', this.router.url);
  }

  protected logout(): void {
    this.loggingOut = true;
    this.authSession.logout();
    void this.router.navigate(['/dashboard']).finally(() => {
      this.loggingOut = false;
    });
  }

  protected onSidebarClick(event: Event): void {
    if (!this.layout.mapExpanded()) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('a.nav-link')) {
      return;
    }
    this.layout.toggleOverlayNav();
  }
}
