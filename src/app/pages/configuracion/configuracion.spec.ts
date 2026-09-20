import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Configuracion } from './configuracion';

describe('Configuracion', () => {
  let fixture: ComponentFixture<Configuracion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Configuracion] }).compileComponents();
    fixture = TestBed.createComponent(Configuracion);
    fixture.detectChanges();
  });

  it('changes the personal status', () => {
    const statusButtons = fixture.nativeElement.querySelectorAll(
      '.status-options button',
    ) as NodeListOf<HTMLButtonElement>;
    statusButtons[2].click();
    fixture.detectChanges();

    expect(statusButtons[2].getAttribute('aria-checked')).toBe('true');
  });

  it('disables GPS options with the GPS switch', () => {
    const gpsSwitch = fixture.nativeElement.querySelector(
      '.setting-row .switch',
    ) as HTMLButtonElement;
    gpsSwitch.click();
    fixture.detectChanges();

    expect(gpsSwitch.getAttribute('aria-checked')).toBe('false');
    expect(fixture.nativeElement.querySelector('.segment-setting').disabled).toBe(true);
  });

  it('shows feedback after a danger action', () => {
    const action = fixture.nativeElement.querySelector(
      '.danger-action button',
    ) as HTMLButtonElement;
    action.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.action-feedback').textContent).toContain(
      'revocados',
    );
  });
});
