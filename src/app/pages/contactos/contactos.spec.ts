import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ContactRecord, ContactsApi, PublicUser } from '../../core/contacts/contacts-api';
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
    requests: vi.fn(() => of([] as ContactRecord[])),
    search: vi.fn(() => of([] as PublicUser[])),
    request: vi.fn(() => of({})),
    share: vi.fn(() => of({})),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
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
    expect((fixture.nativeElement.querySelector('.contact-row a') as HTMLAnchorElement).getAttribute('href'))
      .toBe('/mapa?usuario=12');
  });

  it('keeps status labels available on narrow screens and identifies the destructive action', () => {
    const row = fixture.nativeElement.querySelector('.contact-row') as HTMLElement;
    expect([...row.querySelectorAll('.mobile-cell-label')].map((label) => label.textContent?.trim()))
      .toEqual(['Compartes tu ubicación', 'Comparte contigo']);
    expect(row.querySelector('.actions .delete-contact')?.textContent).toContain('Eliminar');
  });

  it('expands compact actions from the arrow and closes them with Escape', () => {
    const row = fixture.nativeElement.querySelector('.contact-row') as HTMLElement;
    const toggle = row.querySelector('.actions-toggle') as HTMLButtonElement;
    const secondary = row.querySelector('.secondary-actions') as HTMLElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(secondary.id);
    expect(toggle.getAttribute('aria-label')).toContain('Carlos Pérez');
    expect(secondary.classList.contains('is-open')).toBe(false);

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(secondary.classList.contains('is-open')).toBe(true);
    expect(secondary.querySelector('a')?.textContent).toContain('Ver ubicación');
    expect(secondary.querySelector('.delete-contact')?.textContent).toContain('Eliminar');

    secondary.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(secondary.classList.contains('is-open')).toBe(false);
    expect(document.activeElement).toBe(toggle);
  });

  it('filters contacts by name', () => {
    const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'Nadie';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.contact-row')).toHaveLength(0);
  });

  it('keeps refresh and opens the add contact panel with focus on search', async () => {
    const buttons = [...fixture.nativeElement.querySelectorAll('.page-heading button')] as HTMLButtonElement[];
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Actualizar', 'Agregar contacto']);
    buttons[0].click();
    await fixture.whenStable();
    expect(api.list).toHaveBeenCalledTimes(2);
    buttons[1].click();
    await fixture.whenStable();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#user-search') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(document.activeElement).toBe(input);
    (fixture.nativeElement.querySelector('.close-add') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(buttons[1]);
    expect(fixture.nativeElement.querySelector('#user-search')).toBeNull();
  });

  it('searches the API and sends a contact request only once', async () => {
    api.request.mockImplementationOnce(() => {
      api.requests.mockReturnValueOnce(of([{
        idUsuarioContacto: 22,
        contacto: { idUsuario: 21, nombres: 'Ana', apellidos: 'Ruiz' },
        estado: 'PENDIENTE',
        yoCompartoUbicacion: false,
        contactoComparteUbicacion: false,
        soySolicitante: true,
        fechaSolicitud: '',
      }]));
      return of({});
    });
    api.search.mockReturnValueOnce(of([
      { idUsuario: 21, nombres: 'Ana', apellidos: 'Ruiz', correo: 'ana@example.com' },
      { idUsuario: 12, nombres: 'Carlos', apellidos: 'Pérez' },
    ]));
    (fixture.nativeElement.querySelector('.add-contact') as HTMLButtonElement).click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#user-search') as HTMLInputElement;
    input.value = 'Ana';
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.search).toHaveBeenCalledWith('Ana');
    const sendButton = fixture.nativeElement.querySelector('.add-panel .request-row button') as HTMLButtonElement;
    expect(sendButton.textContent).toContain('Enviar solicitud');
    sendButton.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.request).toHaveBeenCalledExactlyOnceWith(21);
    expect(fixture.nativeElement.textContent).toContain('Solicitud enviada a Ana Ruiz.');
    expect(fixture.nativeElement.textContent).toContain('Contacto o solicitud existente');
    expect(fixture.nativeElement.querySelector('.add-panel .request-row button')).toBeNull();
    expect(fixture.nativeElement.querySelector('#sent-title')?.parentElement?.textContent).toContain('Ana Ruiz');
  });
});
