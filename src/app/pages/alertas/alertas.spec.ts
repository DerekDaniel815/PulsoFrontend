import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Alertas } from './alertas';

describe('Alertas', () => {
  let fixture: ComponentFixture<Alertas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Alertas] }).compileComponents();
    fixture = TestBed.createComponent(Alertas);
    fixture.detectChanges();
  });

  it('shows unread alerts by default', () => {
    const items = fixture.nativeElement.querySelectorAll('.alert-item');
    const activeFilter = fixture.nativeElement.querySelector('.filter-card[aria-pressed="true"]');

    expect(items).toHaveLength(3);
    expect(activeFilter.textContent).toContain('Sin leer');
  });

  it('filters alerts by severity when a filter is clicked', () => {
    const criticalFilter = fixture.nativeElement.querySelector(
      '.filter-card.critical',
    ) as HTMLButtonElement;

    criticalFilter.click();
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.alert-item');
    const heading = fixture.nativeElement.querySelector('#filtered-alerts-title');

    expect(items).toHaveLength(2);
    expect(heading.textContent).toContain('Críticas');
    expect(criticalFilter.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the complete list when Ver todas is clicked', () => {
    const showAll = fixture.nativeElement.querySelector('.show-all') as HTMLButtonElement;

    showAll.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.alert-item')).toHaveLength(6);
    expect(fixture.nativeElement.querySelector('#filtered-alerts-title').textContent).toContain(
      'Todas las alertas',
    );
  });
});
