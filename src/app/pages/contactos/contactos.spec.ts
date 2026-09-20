import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Contactos } from './contactos';

describe('Contactos', () => {
  let fixture: ComponentFixture<Contactos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Contactos],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Contactos);
    fixture.detectChanges();
  });

  it('renders all contacts by default', () => {
    expect(fixture.nativeElement.querySelectorAll('.contact-row')).toHaveLength(8);
  });

  it('filters contacts by search term', () => {
    const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'Carlos';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.contact-row')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.contact-identity strong').textContent).toContain(
      'Carlos',
    );
  });

  it('changes to grid view', () => {
    const gridButton = fixture.nativeElement.querySelectorAll(
      '.view-switcher button',
    )[1] as HTMLButtonElement;
    gridButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.contacts-table').classList).toContain('is-grid');
    expect(gridButton.getAttribute('aria-pressed')).toBe('true');
  });
});
