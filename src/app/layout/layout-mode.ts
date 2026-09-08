import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutMode {
  readonly mapExpanded = signal(false);
  readonly overlayNavOpen = signal(true);

  toggleOverlayNav(): void {
    if (!this.mapExpanded()) {
      return;
    }
    this.overlayNavOpen.update((open) => !open);
  }

  setMapExpanded(open: boolean): void {
    this.mapExpanded.set(open);
    if (!open) {
      this.overlayNavOpen.set(true);
    }
  }
}
