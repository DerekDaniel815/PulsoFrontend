import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Historial } from './historial';

describe('Historial', () => {
  let fixture: ComponentFixture<Historial>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Historial] }).compileComponents();
    fixture = TestBed.createComponent(Historial);
    fixture.detectChanges();
  });

  it('shows today history by default', () => {
    expect(fixture.nativeElement.querySelectorAll('.timeline-panel li')).toHaveLength(7);
    expect(fixture.nativeElement.querySelector('.period-filters .is-active').textContent).toContain(
      'Hoy',
    );
  });

  it('updates the route when a period is selected', () => {
    const buttons = fixture.nativeElement.querySelectorAll(
      '.period-filters button',
    ) as NodeListOf<HTMLButtonElement>;

    buttons[1].click();
    fixture.detectChanges();

    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('.timeline-panel li')).toHaveLength(5);
    expect(fixture.nativeElement.querySelector('.metrics strong').textContent).toContain('6.9 km');
  });
});
