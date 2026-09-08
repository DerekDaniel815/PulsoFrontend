export type ContactStatus = 'conectado' | 'ausente' | 'sin-conexion' | 'emergencia';

export interface DashboardContact {
  initials: string;
  name: string;
  relation: string;
  lastSeen: string;
  status: ContactStatus;
}

export interface DashboardActivity {
  title: string;
  time: string;
}

export const DASHBOARD_CONTACTS: DashboardContact[] = [
  { initials: 'MG', name: 'María García', relation: 'Familia', lastSeen: 'Hace 2 min', status: 'conectado' },
  { initials: 'CR', name: 'Carlos Rodríguez', relation: 'Familia', lastSeen: 'Hace 3 min', status: 'emergencia' },
  { initials: 'AL', name: 'Ana López', relation: 'Amigos', lastSeen: 'Hace 18 min', status: 'ausente' },
  { initials: 'JP', name: 'Javier Pérez', relation: 'Trabajo', lastSeen: 'Hace 1 h', status: 'sin-conexion' },
  { initials: 'LM', name: 'Laura Méndez', relation: 'Grupo', lastSeen: 'Hace 4 min', status: 'conectado' },
];

export const DASHBOARD_ACTIVITY: DashboardActivity[] = [
  { title: 'Tu ubicación fue actualizada', time: 'Hace 8 seg' },
  { title: 'Carlos Rodríguez activó emergencia', time: 'Hace 3 min' },
  { title: 'María García compartió ubicación', time: 'Hace 12 min' },
];
