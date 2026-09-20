export type GroupTone = 'primary' | 'success' | 'emergency' | 'warning';

export interface GroupMember {
  readonly initials: string;
  readonly name: string;
  readonly color: string;
  readonly online: boolean;
}

export interface LocationGroup {
  readonly id: number;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly accessLabel: string;
  readonly tone: GroupTone;
  readonly members: readonly GroupMember[];
  readonly active: boolean;
}

export const GROUPS: readonly LocationGroup[] = [
  {
    id: 1,
    name: 'Familia',
    icon: '⌂',
    description: 'Familia directa',
    accessLabel: 'Acceso completo a ubicación',
    tone: 'primary',
    active: true,
    members: [
      { initials: 'MG', name: 'María González', color: '#00a978', online: true },
      { initials: 'CR', name: 'Carlos Rodríguez', color: '#cf455c', online: true },
      { initials: 'CT', name: 'Carmen Torres', color: '#6556c9', online: true },
    ],
  },
  {
    id: 2,
    name: 'Amigos',
    icon: '♟',
    description: 'Amigos cercanos',
    accessLabel: 'Ubicación compartida',
    tone: 'success',
    active: true,
    members: [
      { initials: 'AL', name: 'Álex López', color: '#344057', online: false },
      { initials: 'LS', name: 'Laura Sánchez', color: '#283248', online: false },
    ],
  },
  {
    id: 3,
    name: 'Emergencias',
    icon: '!',
    description: 'Contactos de emergencia',
    accessLabel: 'Siempre activo',
    tone: 'emergency',
    active: true,
    members: [
      { initials: 'PM', name: 'Pedro Martín', color: '#00788f', online: true },
      { initials: 'RS', name: 'Rosa Silva', color: '#007d55', online: true },
    ],
  },
  {
    id: 4,
    name: 'Equipo',
    icon: '▣',
    description: 'Compañeros de trabajo',
    accessLabel: 'Sin acceso a ubicación',
    tone: 'warning',
    active: false,
    members: [{ initials: 'DF', name: 'David Fernández', color: '#58442c', online: true }],
  },
];
