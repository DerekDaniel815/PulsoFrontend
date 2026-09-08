export type NavIcon =
  | 'dashboard'
  | 'contacts'
  | 'groups'
  | 'alerts'
  | 'history'
  | 'zones'
  | 'settings';

export interface NavItem {
  path: string;
  label: string;
  icon: NavIcon;
  badge?: number;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/contactos', label: 'Contactos', icon: 'contacts' },
  { path: '/grupos', label: 'Grupos', icon: 'groups' },
  { path: '/alertas', label: 'Alertas', icon: 'alerts', badge: 3 },
  { path: '/historial', label: 'Historial', icon: 'history' },
  { path: '/zonas-seguras', label: 'Zonas Seguras', icon: 'zones' },
  { path: '/configuracion', label: 'Configuración', icon: 'settings' },
];
