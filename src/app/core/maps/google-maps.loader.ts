import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoader {
  private loading?: Promise<void>;

  load(): Promise<void> {
    if (this.loading) {
      return this.loading;
    }

    this.loading = this.loadScript();
    return this.loading;
  }

  private async loadScript(): Promise<void> {
    if (globalThis.google?.maps) {
      return;
    }

    const apiKey = await this.readApiKey();
    if (!apiKey) {
      throw new Error('Falta la API key de Google Maps');
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar Google Maps'));
      document.head.appendChild(script);
    });
  }

  private async readApiKey(): Promise<string> {
    const response = await fetch('/maps-config.json');
    if (!response.ok) {
      return '';
    }

    const config = (await response.json()) as { googleMapsApiKey?: string };
    return config.googleMapsApiKey?.trim() ?? '';
  }
}
