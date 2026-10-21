import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ZonasSeguras } from './zonas-seguras';

describe('ZonasSeguras', () => {
  let fixture: ComponentFixture<ZonasSeguras>;

  beforeEach(async () => {
    localStorage.removeItem('pulso.zonas-locales.anonimo');
    await TestBed.configureTestingModule({ imports: [ZonasSeguras] }).compileComponents();
    fixture = TestBed.createComponent(ZonasSeguras);
    fixture.detectChanges();
  });

  afterEach(() => localStorage.removeItem('pulso.zonas-locales.anonimo'));

  it('makes it clear there are no server-synced zones', () => {
    expect(fixture.nativeElement.textContent).toContain('no generan alertas');
    expect(fixture.nativeElement.querySelectorAll('.map-zone')).toHaveLength(0);
  });

  it('creates and persists a local zone', () => {
    (fixture.nativeElement.querySelector('.new-zone') as HTMLButtonElement).click();
    fixture.detectChanges();
    const fields = fixture.nativeElement.querySelectorAll('.zone-form input') as NodeListOf<HTMLInputElement>;
    fields[0].value = 'Casa';
    fields[0].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.zone-form button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.map-zone')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('pulso.zonas-locales.anonimo') ?? '[]')).toHaveLength(1);
  });

  it('hides a saved zone from the schematic map', () => {
    localStorage.setItem('pulso.zonas-locales.anonimo', JSON.stringify([{
      id: 1, name: 'Casa', radius: 100, active: true, icon: '⌖', address: '',
      tone: 'success', nearbyContacts: 0, mapX: 50, mapY: 50, mapSize: 25,
    }]));
    fixture.destroy();
    fixture = TestBed.createComponent(ZonasSeguras);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.switch') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.map-zone')).toHaveLength(0);
  });
});
