import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ZonasSeguras } from './zonas-seguras';

describe('ZonasSeguras', () => {
  let fixture: ComponentFixture<ZonasSeguras>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ZonasSeguras] }).compileComponents();
    fixture = TestBed.createComponent(ZonasSeguras);
    fixture.detectChanges();
  });

  it('shows active zones on the map', () => {
    expect(fixture.nativeElement.querySelectorAll('.map-zone')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('.intro').textContent).toContain('3 zonas activas');
  });

  it('updates the details when a zone is selected', () => {
    const selectors = fixture.nativeElement.querySelectorAll(
      '.zone-select',
    ) as NodeListOf<HTMLButtonElement>;
    selectors[3].click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.zone-details h2').textContent).toContain(
      'Hospital de Referencia',
    );
    expect(fixture.nativeElement.querySelector('.zone-details strong').textContent).toContain(
      '80 m',
    );
  });

  it('hides a zone from the map when it is disabled', () => {
    const switches = fixture.nativeElement.querySelectorAll(
      '.switch',
    ) as NodeListOf<HTMLButtonElement>;
    switches[0].click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.map-zone')).toHaveLength(2);
    expect(switches[0].getAttribute('aria-checked')).toBe('false');
  });
});
