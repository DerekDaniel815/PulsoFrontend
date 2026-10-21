import { HttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Historial } from './historial';

describe('Historial', () => {
  let fixture: ComponentFixture<Historial>;
  const http = {
    get: vi.fn((url: string) => of(url.endsWith('/user-devices/me')
      ? [{ idUsuarioDispositivo: 1, alias: 'GPS propio' }]
      : [{ idUbicacion: 'one', latitud: -12, longitud: -77, precisionGps: 5, fechaHoraDispositivo: '2026-10-20T09:00:00Z' }])),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Historial], providers: [{ provide: HttpClient, useValue: http }],
    }).compileComponents();
    fixture = TestBed.createComponent(Historial);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads assignments and real history', () => {
    expect(fixture.nativeElement.textContent).toContain('GPS propio');
    expect(fixture.nativeElement.querySelectorAll('.timeline-panel li')).toHaveLength(1);
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/history'), expect.anything());
  });

  it('fetches a new period when selected', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.period-filters button');
    const previousCalls = http.get.mock.calls.length;
    buttons[1].click();
    fixture.detectChanges();
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(http.get).toHaveBeenCalledTimes(previousCalls + 1);
  });
});
