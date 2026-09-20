export type ContactGroup = 'Familia' | 'Amigos' | 'Emergencias' | 'Equipo';
export type ContactStatus = 'connected' | 'emergency' | 'offline' | 'away';

export interface ContactItem {
  readonly id: number;
  readonly initials: string;
  readonly name: string;
  readonly address: string;
  readonly group: ContactGroup;
  readonly status: ContactStatus;
  readonly lastConnection: string;
  readonly distance: string;
  readonly locationActive: boolean;
  readonly avatarColor: string;
}

export const CONTACTS: readonly ContactItem[] = [
  {
    id: 1,
    initials: 'MG',
    name: 'María García',
    address: 'Calle Mayor 45',
    group: 'Familia',
    status: 'connected',
    lastConnection: 'Ahora',
    distance: '1.2 km',
    locationActive: true,
    avatarColor: '#07543f',
  },
  {
    id: 2,
    initials: 'CR',
    name: 'Carlos Rodríguez',
    address: 'Av. Castellana 180',
    group: 'Familia',
    status: 'emergency',
    lastConnection: 'Hace 3 min',
    distance: '2.8 km',
    locationActive: true,
    avatarColor: '#4d2430',
  },
  {
    id: 3,
    initials: 'AL',
    name: 'Ana López',
    address: 'C. Fuencarral 89',
    group: 'Amigos',
    status: 'offline',
    lastConnection: 'Hace 1 hora',
    distance: '5.1 km',
    locationActive: false,
    avatarColor: '#263147',
  },
  {
    id: 4,
    initials: 'PM',
    name: 'Pedro Martínez',
    address: 'Gran Vía 42',
    group: 'Emergencias',
    status: 'connected',
    lastConnection: 'Hace 2 min',
    distance: '0.8 km',
    locationActive: true,
    avatarColor: '#064c61',
  },
  {
    id: 5,
    initials: 'LS',
    name: 'Laura Sánchez',
    address: 'C. Alcalá 200',
    group: 'Amigos',
    status: 'offline',
    lastConnection: 'Hace 3 horas',
    distance: '7.3 km',
    locationActive: false,
    avatarColor: '#263147',
  },
  {
    id: 6,
    initials: 'DF',
    name: 'Diego Fernández',
    address: 'Paseo del Prado 8',
    group: 'Equipo',
    status: 'away',
    lastConnection: 'Hace 35 min',
    distance: '3.5 km',
    locationActive: true,
    avatarColor: '#4b3b24',
  },
  {
    id: 7,
    initials: 'CT',
    name: 'Carmen Torres',
    address: 'C. Serrano 15',
    group: 'Familia',
    status: 'connected',
    lastConnection: 'Hace 5 min',
    distance: '4.2 km',
    locationActive: true,
    avatarColor: '#322a5f',
  },
  {
    id: 8,
    initials: 'RS',
    name: 'Roberto Silva',
    address: 'C. Princesa 5',
    group: 'Emergencias',
    status: 'connected',
    lastConnection: 'Ahora',
    distance: '1.9 km',
    locationActive: true,
    avatarColor: '#084d3b',
  },
];

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  connected: 'Conectado',
  emergency: 'Emergencia',
  offline: 'Sin conexión',
  away: 'Ausente',
};
