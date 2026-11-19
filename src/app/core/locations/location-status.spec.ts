import { isApproximateLocation, locationStatus } from './location-status';

describe('locationStatus', () => {
  const received = Date.parse('2026-11-19T12:00:00Z');
  const location = {
    fechaHoraDispositivo: '2026-11-19T11:59:00Z',
    fechaHoraServidor: '2026-11-19T12:00:00Z',
    liveExpiresAt: '2026-11-19T12:05:00Z',
    isLive: true,
  };

  it('only calls a position recent while its server TTL and capture time are valid', () => {
    expect(locationStatus(location, received + 60_000)).toBe('recent');
    expect(locationStatus(location, received + 5 * 60_000)).toBe('old');
    expect(locationStatus({ ...location, fechaHoraDispositivo: '2026-11-19T11:00:00Z' }, received)).toBe('old');
  });

  it('never presents an offline or previously expired position as current', () => {
    expect(locationStatus({ ...location, fueSincronizadaOffline: true }, received)).toBe('old');
    expect(locationStatus({ ...location, isLive: false }, received)).toBe('old');
  });

  it('does not infer freshness from a missing timestamp or TTL', () => {
    expect(locationStatus({ ...location, liveExpiresAt: null }, received)).toBe('unknown');
    expect(locationStatus({ ...location, fechaHoraServidor: undefined }, received)).toBe('unknown');
  });

  it('labels cellular and network coordinates as approximate', () => {
    expect(isApproximateLocation({ locationSource: 'NETWORK' })).toBe(true);
    expect(isApproximateLocation({ locationSource: 'CELL' })).toBe(true);
    expect(isApproximateLocation({ locationSource: 'GNSS', isApproximate: false })).toBe(false);
  });
});
