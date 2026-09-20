export type SafeZoneTone = 'success' | 'warning' | 'primary' | 'shield';

export interface SafeZone {
  readonly id: number;
  readonly name: string;
  readonly icon: string;
  readonly address: string;
  readonly radius: number;
  readonly nearbyContacts: number;
  readonly active: boolean;
  readonly tone: SafeZoneTone;
  readonly mapX: number;
  readonly mapY: number;
  readonly mapSize: number;
}

export const SAFE_ZONES: readonly SafeZone[] = [
  {
    id: 1,
    name: 'Casa',
    icon: '⌂',
    address: 'Calle Mayor 45, Madrid',
    radius: 100,
    nearbyContacts: 2,
    active: true,
    tone: 'success',
    mapX: 51,
    mapY: 50,
    mapSize: 31,
  },
  {
    id: 2,
    name: 'Punto de Encuentro',
    icon: '●',
    address: 'Plaza Mayor, Madrid',
    radius: 150,
    nearbyContacts: 0,
    active: true,
    tone: 'warning',
    mapX: 36,
    mapY: 35,
    mapSize: 48,
  },
  {
    id: 3,
    name: 'Refugio Norte',
    icon: '◈',
    address: 'Parque El Retiro, Madrid',
    radius: 200,
    nearbyContacts: 1,
    active: false,
    tone: 'shield',
    mapX: 30,
    mapY: 66,
    mapSize: 40,
  },
  {
    id: 4,
    name: 'Hospital de Referencia',
    icon: '+',
    address: 'Hospital Gregorio Marañón, Madrid',
    radius: 80,
    nearbyContacts: 0,
    active: true,
    tone: 'primary',
    mapX: 72,
    mapY: 70,
    mapSize: 26,
  },
];
