import type { PulsoUser } from '../core/auth/auth.models';

export type NavIcon =
  | 'dashboard'
  | 'map'
  | 'contacts'
  | 'groups'
  | 'alerts'
  | 'history'
  | 'devices'
  | 'settings';

export interface NavItem {
  path: string;
  label: string;
  shortLabel?: string;
  icon: NavIcon;
  badge?: number;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/mapa', label: 'Mapa', icon: 'map' },
  { path: '/contactos', label: 'Contactos', icon: 'contacts' },
  { path: '/grupos', label: 'Grupos', icon: 'groups' },
  { path: '/alertas', label: 'Alertas', icon: 'alerts' },
  { path: '/historial', label: 'Historial', icon: 'history' },
  { path: '/inventario', label: 'Inventario', icon: 'devices', adminOnly: true },
  { path: '/configuracion', label: 'Configuración', shortLabel: 'Ajustes', icon: 'settings' },
];

export function navItemsForRole(role: PulsoUser['rol'] | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => role === 'ADMIN' ? item.adminOnly : !item.adminOnly);
}
