import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthDialogService } from '../core/auth/auth-dialog.service';
import { AuthDialog } from '../core/auth/auth-dialog';
import { AuthSession } from '../core/auth/auth-session';
import { SessionStore } from '../core/auth/session-store';
import { LocationsStore } from '../core/locations/locations-store';
import { OverviewStore } from '../core/overview/overview-store';
import { LayoutMode } from './layout-mode';
import { NAV_ITEMS } from './nav';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AuthDialog],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: { '(document:keydown.escape)': 'closeMobileNavigation()' },
})
export class Shell {
  private loggingOut = false;
  private focusAfterNavigation = false;
  private readonly mainContent = viewChild<ElementRef<HTMLElement>>('mainContent');
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSession);
  private readonly authDialog = inject(AuthDialogService);
  protected readonly session = inject(SessionStore);
  protected readonly overview = inject(OverviewStore);
  protected readonly locations = inject(LocationsStore);
  protected readonly layout = inject(LayoutMode);
  protected readonly mobileNavOpen = signal(false);

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
    inject(LocationsStore);
    effect(() => {
      const currentUrl = this.url();
      if (this.focusAfterNavigation) {
        this.focusAfterNavigation = false;
        queueMicrotask(() => this.mainContent()?.nativeElement.focus());
      }
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

  protected toggleMobileNavigation(): void {
    this.mobileNavOpen.update((open) => !open);
  }

  protected closeMobileNavigation(): void {
    this.mobileNavOpen.set(false);
  }

  protected onNavigate(path: string): void {
    if (this.mobileNavOpen()) {
      if (this.router.url === path) queueMicrotask(() => this.mainContent()?.nativeElement.focus());
      else this.focusAfterNavigation = true;
    }
    this.mobileNavOpen.set(false);
  }

  protected logout(): void {
    this.mobileNavOpen.set(false);
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
    if (target.closest('a.nav-link, button')) {
      return;
    }
    this.layout.toggleOverlayNav();
  }
}
