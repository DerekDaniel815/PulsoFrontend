import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { LocationsStore } from '../../core/locations/locations-store';
import { NotificationsApi } from '../../core/notifications/notifications-api';
import { OverviewStore } from '../../core/overview/overview-store';
import { Alertas } from './alertas';

describe('Alertas', () => {
  let fixture: ComponentFixture<Alertas>;
  const api = {
    list: vi.fn(() => of([
      { idNotificacionUsuario: 'a', tipo: 'SOS', titulo: 'Alerta', mensaje: 'Ayuda', leida: false, fechaCreacion: '2026-10-20' },
      { idNotificacionUsuario: 'b', tipo: 'CONTACTO', titulo: 'Solicitud', mensaje: null, leida: true, fechaCreacion: '2026-10-20' },
    ])),
    read: vi.fn(() => of({})),
    readAll: vi.fn(() => of({})),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Alertas],
      providers: [
        provideRouter([]),
        { provide: NotificationsApi, useValue: api },
        { provide: LocationsStore, useValue: { notificationVersion: signal(0) } },
        { provide: OverviewStore, useValue: { refresh: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Alertas);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads notifications and their unread count', () => {
    expect(api.list).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('.alert-item')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('1 sin leer');
  });

  it('filters unread notifications', () => {
    (fixture.nativeElement.querySelector('.filter-card.unread') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.alert-item')).toHaveLength(1);
  });
});
