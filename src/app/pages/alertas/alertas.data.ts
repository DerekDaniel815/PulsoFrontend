export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertItem {
  readonly id: number;
  readonly severity: AlertSeverity;
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly person: string;
  readonly location: string;
  readonly time: string;
  readonly dateTime: string;
  readonly read: boolean;
}

export const ALERTS: readonly AlertItem[] = [
  {
    id: 1,
    severity: 'critical',
    category: 'Emergencia SOS',
    title: 'Carlos Rodríguez necesita ayuda',
    description: 'Se activó una alerta de emergencia desde su dispositivo móvil.',
    person: 'Carlos Rodríguez',
    location: 'Av. Castellana 180, Madrid',
    time: 'Hace 3 min',
    dateTime: '2026-09-19T14:27:00+02:00',
    read: false,
  },
  {
    id: 2,
    severity: 'warning',
    category: 'Zona segura',
    title: 'María salió de la zona Universidad',
    description: 'El contacto abandonó el perímetro configurado como zona segura.',
    person: 'María González',
    location: 'Ciudad Universitaria, Madrid',
    time: 'Hace 12 min',
    dateTime: '2026-09-19T14:18:00+02:00',
    read: false,
  },
  {
    id: 3,
    severity: 'info',
    category: 'Dispositivo',
    title: 'Batería baja en un contacto',
    description: 'El dispositivo tiene menos de 15 % de batería disponible.',
    person: 'Lucía Fernández',
    location: 'Barrio de Salamanca, Madrid',
    time: 'Hace 28 min',
    dateTime: '2026-09-19T14:02:00+02:00',
    read: false,
  },
  {
    id: 4,
    severity: 'critical',
    category: 'Emergencia SOS',
    title: 'Alerta de emergencia finalizada',
    description: 'La persona confirmó que se encuentra a salvo y cerró la alerta.',
    person: 'Ana Martínez',
    location: 'Calle de Alcalá 94, Madrid',
    time: 'Hace 1 h',
    dateTime: '2026-09-19T13:22:00+02:00',
    read: true,
  },
  {
    id: 5,
    severity: 'warning',
    category: 'Conexión',
    title: 'Ubicación no disponible',
    description: 'No se reciben actualizaciones de ubicación desde hace 20 minutos.',
    person: 'Pedro Sánchez',
    location: 'Última ubicación: Retiro, Madrid',
    time: 'Hace 2 h',
    dateTime: '2026-09-19T12:11:00+02:00',
    read: true,
  },
  {
    id: 6,
    severity: 'info',
    category: 'Grupo',
    title: 'Nuevo contacto en Familia',
    description: 'Un nuevo miembro aceptó la invitación y ya comparte su ubicación.',
    person: 'Sofía López',
    location: 'Grupo Familia',
    time: 'Ayer, 19:42',
    dateTime: '2026-09-18T19:42:00+02:00',
    read: true,
  },
];
