export type HistoryPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export interface HistoryPoint {
  readonly time: string;
  readonly location: string;
  readonly activity: string;
  readonly accuracy: string;
  readonly mapX: number;
  readonly mapY: number;
}

export interface HistoryData {
  readonly points: readonly HistoryPoint[];
  readonly distance: string;
  readonly activeTime: string;
}

const TODAY_POINTS: readonly HistoryPoint[] = [
  {
    time: '09:42',
    location: 'Gran Vía 42, Madrid',
    activity: 'Parada (18 min)',
    accuracy: '±6 m',
    mapX: 18,
    mapY: 77,
  },
  {
    time: '09:24',
    location: 'C. Fuencarral 89, Madrid',
    activity: 'En tránsito',
    accuracy: '±10 m',
    mapX: 31,
    mapY: 66,
  },
  {
    time: '08:55',
    location: 'Calle Mayor 45, Madrid',
    activity: 'Parada (35 min)',
    accuracy: '±5 m',
    mapX: 45,
    mapY: 56,
  },
  {
    time: '08:20',
    location: 'Estación de Atocha, Madrid',
    activity: 'En tránsito',
    accuracy: '±15 m',
    mapX: 58,
    mapY: 44,
  },
  {
    time: '07:50',
    location: 'C. Alcalá 200, Madrid',
    activity: 'Inicio del día',
    accuracy: '±8 m',
    mapX: 73,
    mapY: 35,
  },
  {
    time: '07:28',
    location: 'Parque del Retiro, Madrid',
    activity: 'En tránsito',
    accuracy: '±7 m',
    mapX: 84,
    mapY: 48,
  },
  {
    time: '07:10',
    location: 'Av. Menéndez Pelayo, Madrid',
    activity: 'Primera ubicación',
    accuracy: '±9 m',
    mapX: 92,
    mapY: 63,
  },
];

const shiftPoints = (minutes: number, xOffset: number): readonly HistoryPoint[] =>
  TODAY_POINTS.slice(0, 5).map((point, index) => ({
    ...point,
    time: `${String(Math.max(6, 9 - index)).padStart(2, '0')}:${String((42 + minutes + index * 7) % 60).padStart(2, '0')}`,
    mapX: Math.min(94, point.mapX + xOffset),
  }));

export const HISTORY_BY_PERIOD: Record<HistoryPeriod, HistoryData> = {
  today: { points: TODAY_POINTS, distance: '8.4 km', activeTime: '2 h 15 min' },
  yesterday: { points: shiftPoints(9, 2), distance: '6.9 km', activeTime: '1 h 48 min' },
  week: { points: TODAY_POINTS.slice(0, 6), distance: '42.7 km', activeTime: '12 h 30 min' },
  month: { points: TODAY_POINTS, distance: '168 km', activeTime: '51 h 20 min' },
  custom: { points: TODAY_POINTS.slice(1, 6), distance: '5.6 km', activeTime: '1 h 32 min' },
};
