import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ContactsApi } from '../../core/contacts/contacts-api';
import { LocationsStore } from '../../core/locations/locations-store';
import { Contactos } from './contactos';

describe('Contactos', () => {
  let fixture: ComponentFixture<Contactos>;
  const api = {
    list: vi.fn(() => of([{
      idUsuarioContacto: 7,
      contacto: { idUsuario: 12, nombres: 'Carlos', apellidos: 'Pérez' },
      estado: 'ACEPTADO',
      yoCompartoUbicacion: false,
      contactoComparteUbicacion: true,
      soySolicitante: false,
      fechaSolicitud: '',
    }])),
    requests: vi.fn(() => of([])),
    search: vi.fn(() => of([])),
    share: vi.fn(() => of({})),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Contactos],
      providers: [
        provideRouter([]),
        { provide: ContactsApi, useValue: api },
        { provide: LocationsStore, useValue: { refresh: vi.fn(), notificationVersion: signal(0) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Contactos);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads accepted contacts from the API', () => {
    expect(api.list).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('.contact-row')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Carlos Pérez');
  });

  it('filters contacts by name', () => {
    const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'Nadie';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.contact-row')).toHaveLength(0);
  });
});
