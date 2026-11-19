export interface LocationFreshness {
  fechaHoraDispositivo: string;
  fechaHoraServidor?: string;
  isLive?: boolean;
  liveExpiresAt?: string | null;
  fueSincronizadaOffline?: boolean;
}

export function locationStatus(location: LocationFreshness, now: number): 'recent' | 'old' | 'unknown' {
  if (location.fueSincronizadaOffline || location.isLive === false) return 'old';
  const capturedAt = Date.parse(location.fechaHoraDispositivo);
  const receivedAt = Date.parse(location.fechaHoraServidor ?? '');
  const expiresAt = Date.parse(location.liveExpiresAt ?? '');

  if (!Number.isFinite(capturedAt) || !Number.isFinite(receivedAt)) return 'unknown';
  // El TTL del servidor mide recepción, no garantiza que una coordenada obtenida
  // mucho antes de enviarse describa la posición actual de la persona.
  if (location.isLive !== true || !Number.isFinite(expiresAt) || expiresAt <= receivedAt) return 'unknown';
  if (expiresAt <= now || capturedAt > now || receivedAt - capturedAt > expiresAt - receivedAt) return 'old';
  return 'recent';
}

export function isApproximateLocation(location: { isApproximate?: boolean; locationSource?: string }): boolean {
  return location.isApproximate === true || location.locationSource === 'CELL' || location.locationSource === 'NETWORK';
}
