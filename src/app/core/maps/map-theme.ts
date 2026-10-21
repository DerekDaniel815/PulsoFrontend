export const MAP_CENTER: google.maps.LatLngLiteral = {
  lat: 40.4588,
  lng: -3.6904,
};

// Mantener estos tonos sincronizados con los tokens del mapa en styles/_tokens.scss.
export const MAP_BACKGROUND = '#0c1426';

export const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: MAP_BACKGROUND }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: MAP_BACKGROUND }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a8c8' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2a47' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#090d18' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#94a8c8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#263a5c' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1a30' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#94a8c8' }] },
];

export interface MapPoint {
  id: string;
  title: string;
  initials: string;
  status: 'conectado' | 'ausente' | 'sin-conexion' | 'emergencia' | 'yo';
  position: google.maps.LatLngLiteral;
}

export const MAP_POINTS: MapPoint[] = [
  { id: 'tu', title: 'Tú', initials: 'TÚ', status: 'yo', position: { lat: 40.4588, lng: -3.6904 } },
  { id: 'mg', title: 'María García', initials: 'MG', status: 'conectado', position: { lat: 40.4602, lng: -3.693 } },
  { id: 'cr', title: 'Carlos Rodríguez', initials: 'CR', status: 'emergencia', position: { lat: 40.457, lng: -3.6875 } },
  { id: 'al', title: 'Ana López', initials: 'AL', status: 'ausente', position: { lat: 40.4555, lng: -3.686 } },
  { id: 'jp', title: 'Javier Pérez', initials: 'JP', status: 'sin-conexion', position: { lat: 40.4538, lng: -3.692 } },
  { id: 'lm', title: 'Laura Méndez', initials: 'LM', status: 'conectado', position: { lat: 40.461, lng: -3.6888 } },
];

const STATUS_COLOR: Record<MapPoint['status'], string> = {
  yo: '#00d1ff',
  conectado: '#23dc73',
  emergencia: '#ff5966',
  ausente: '#ffc044',
  'sin-conexion': '#8195b7',
};

export function markerOptions(point: MapPoint): google.maps.MarkerOptions {
  const color = STATUS_COLOR[point.status];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
    <circle cx="18" cy="18" r="14" fill="#141d35" stroke="${color}" stroke-width="3"/>
    <text x="18" y="22" text-anchor="middle" fill="#f4f7ff" font-size="10" font-family="Arial,sans-serif" font-weight="700">${point.initials}</text>
  </svg>`;

  return {
    title: point.title,
    icon: {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(36, 36),
      anchor: new google.maps.Point(18, 18),
    },
  };
}
