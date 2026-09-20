import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Grupos } from './grupos';

describe('Grupos', () => {
  let fixture: ComponentFixture<Grupos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Grupos] }).compileComponents();
    fixture = TestBed.createComponent(Grupos);
    fixture.detectChanges();
  });

  it('renders the available groups', () => {
    expect(fixture.nativeElement.querySelectorAll('.group-card')).toHaveLength(4);
  });

  it('updates the group access when its switch is clicked', () => {
    const switches = fixture.nativeElement.querySelectorAll(
      '.switch',
    ) as NodeListOf<HTMLButtonElement>;

    expect(switches[3].getAttribute('aria-checked')).toBe('false');
    switches[3].click();
    fixture.detectChanges();

    expect(switches[3].getAttribute('aria-checked')).toBe('true');
    expect(fixture.nativeElement.querySelector('.intro').textContent).toContain(
      '4 con acceso a ubicación',
    );
  });
});
