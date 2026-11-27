import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { EmergenciesApi, PublicEmergencyResponse } from '../../core/emergencies/emergencies-api';
import { PublicEmergencyLookup } from './public-emergency-lookup';

describe('PublicEmergencyLookup', () => {
  let fixture: ComponentFixture<PublicEmergencyLookup>;
  const api = {
    findPublicByCode: vi.fn<(_code: string) => Observable<PublicEmergencyResponse>>(),
  };
  const base: PublicEmergencyResponse = {
    clavePublica: 'EME-1234ABCD',
    codigoPublico: 'EME-1234ABCD',
    estado: 'ACTIVA',
    ubicacion: null,
    fechaUltimaUbicacion: null,
  };

  beforeEach(async () => {
    api.findPublicByCode.mockReset();
    await TestBed.configureTestingModule({
      imports: [PublicEmergencyLookup],
      providers: [{ provide: EmergenciesApi, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(PublicEmergencyLookup);
    fixture.detectChanges();
  });

  function search(value: string): void {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('validates the public code before requesting it', () => {
    search('not-a-code');
    expect(api.findPublicByCode).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#public-emergency-validation')).toBeTruthy();
  });

  it('shows a location, its age and an external map link for a valid code', async () => {
    api.findPublicByCode.mockReturnValue(of({
      ...base,
      ubicacion: {
        latitud: 40.12345, longitud: -3.12345, isApproximate: true, isLive: false,
        fechaHoraDispositivo: '2026-01-01T12:00:00Z', fechaHoraServidor: '2026-01-01T12:01:00Z',
      },
      fechaUltimaUbicacion: '2026-01-01T12:00:00Z',
    }));
    search('eme-1234abcd');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.findPublicByCode).toHaveBeenCalledWith('EME-1234ABCD');
    const result = fixture.nativeElement.querySelector('.lookup-result') as HTMLElement;
    expect(result.textContent).toContain('Ubicación aproximada');
    expect(result.textContent).toContain('puede no ser la posición actual');
    const link = result.querySelector('a') as HTMLAnchorElement;
    expect(link.href).toContain('query=40.12345,-3.12345');
    expect(link.rel).toContain('noopener');
  });

  it('handles an active emergency without a location', async () => {
    api.findPublicByCode.mockReturnValue(of(base));
    search('EME-1234ABCD');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.lookup-result').textContent).toContain('Aún no hay una ubicación');
    expect(fixture.nativeElement.querySelector('.lookup-result a')).toBeNull();
  });

  it('distinguishes a code with no active emergency from a connection failure', async () => {
    api.findPublicByCode.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    search('EME-1234ABCD');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('No hay una emergencia activa');

    api.findPublicByCode.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    search('EME-1234ABCD');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('Comprueba la conexión');
  });

  it('discards an old response if the code changes while the request is in flight', async () => {
    const pending = new Subject<PublicEmergencyResponse>();
    api.findPublicByCode.mockReturnValue(pending);
    search('EME-1234ABCD');
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'EME-FFFFFFFF';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    pending.next(base);
    pending.complete();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.lookup-result')).toBeNull();
  });
});
