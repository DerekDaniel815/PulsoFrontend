import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable, of, Subject, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { SessionStore } from '../../core/auth/session-store';
import { LocationsStore } from '../../core/locations/locations-store';
import { NotificationRecord, NotificationsApi } from '../../core/notifications/notifications-api';
import { OverviewStore } from '../../core/overview/overview-store';
import { Alertas } from './alertas';

describe('Alertas', () => {
  let fixture: ComponentFixture<Alertas>;
  let notifications: NotificationRecord[];
  const notificationVersion = signal(0);
  const unreadCount = signal(1);
  const user = signal({ idUsuario: 1, rol: 'USUARIO' });
  const token = signal('jwt');
  const isAuthenticated = signal(true);
  const api = {
    list: vi.fn<(_limit: number, _offset: number) => Observable<NotificationRecord[]>>(),
    unread: vi.fn<(_limit: number, _offset: number) => Observable<NotificationRecord[]>>(),
    read: vi.fn<(_id: string) => Observable<object>>(),
    readAll: vi.fn<() => Observable<object>>(),
  };
  const overview = { unreadCount, refresh: vi.fn(() => Promise.resolve()) };
  const items = (count: number): NotificationRecord[] => Array.from({ length: count }, (_, i) => ({
    idNotificacionUsuario: String(i + 1), idNotificacion: String(i + 101),
    tipo: i === 5 ? 'SOS' : 'CONTACTO',
    titulo: `Notificación ${i + 1}`, mensaje: null, leida: i > 0,
    fechaCreacion: '2026-10-20T00:00:00Z',
  }));
  const rows = () => fixture.nativeElement.querySelectorAll('.alert-item') as NodeListOf<HTMLLIElement>;
  const actions = () => fixture.nativeElement.querySelectorAll('.page-actions button') as NodeListOf<HTMLButtonElement>;

  beforeEach(async () => {
    vi.clearAllMocks();
    notifications = items(2);
    notificationVersion.set(0);
    unreadCount.set(1);
    user.set({ idUsuario: 1, rol: 'USUARIO' });
    token.set('jwt');
    isAuthenticated.set(true);
    api.list.mockImplementation((limit, offset) => of(notifications.slice(offset, offset + limit)));
    api.unread.mockImplementation((limit, offset) => of(notifications.filter((item) => !item.leida).slice(offset, offset + limit)));
    api.read.mockImplementation((id) => {
      notifications = notifications.map((item) => item.idNotificacion === id ? { ...item, leida: true } : item);
      unreadCount.set(notifications.filter((item) => !item.leida).length);
      return of({});
    });
    api.readAll.mockImplementation(() => {
      notifications = notifications.map((item) => ({ ...item, leida: true }));
      unreadCount.set(0);
      return of({});
    });
    await TestBed.configureTestingModule({
      imports: [Alertas],
      providers: [
        provideRouter([]),
        { provide: NotificationsApi, useValue: api },
        { provide: LocationsStore, useValue: { notificationVersion } },
        { provide: OverviewStore, useValue: overview },
        { provide: SessionStore, useValue: { user, token, isAuthenticated } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Alertas);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads the first page and shows the global unread count separately', () => {
    expect(api.list).toHaveBeenCalledWith(5, 0);
    expect(rows()).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('.intro').textContent).toContain('1 sin leer en total');
    expect(actions()[1].disabled).toBe(true);
  });

  it('paginates through all results without requesting the whole history', async () => {
    notifications = items(12);
    await fixture.componentInstance['refresh']();
    fixture.detectChanges();
    expect(rows()).toHaveLength(5);
    expect(actions()[0].disabled).toBe(true);
    actions()[1].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith(5, 5);
    expect(rows()[0].textContent).toContain('Notificación 6');
    expect(fixture.nativeElement.querySelector('.page-summary').textContent).toContain('Mostrando 6–10');
    actions()[1].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith(5, 10);
    expect(rows()).toHaveLength(2);
    expect(actions()[1].disabled).toBe(true);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.page-summary'));
    actions()[0].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rows()).toHaveLength(5);
  });

  it('keeps the last nonempty page if the total is an exact multiple of five', async () => {
    notifications = items(5);
    await fixture.componentInstance['refresh']();
    fixture.detectChanges();
    actions()[1].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith(5, 5);
    expect(rows()).toHaveLength(5);
    expect(fixture.nativeElement.querySelector('.page-summary').textContent).toContain('Página 1');
    expect(actions()[1].disabled).toBe(true);
  });

  it('retries the requested page when its request fails', async () => {
    notifications = items(8);
    await fixture.componentInstance['refresh']();
    fixture.detectChanges();
    api.list.mockReturnValueOnce(throwError(() => new Error('sin conexión')));
    actions()[1].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('No se pudieron cargar');
    (fixture.nativeElement.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.list).toHaveBeenLastCalledWith(5, 5);
    expect(rows()).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('filters unread notifications on the server, including unread items on later pages', async () => {
    notifications = items(12).map((item) => ({ ...item, leida: false }));
    unreadCount.set(12);
    (fixture.nativeElement.querySelector('.filter-card.unread') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.unread).toHaveBeenCalledWith(5, 0);
    expect(rows()).toHaveLength(5);
    actions()[1].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.unread).toHaveBeenCalledWith(5, 5);
    expect(rows()).toHaveLength(5);
    expect(rows()[0].textContent).toContain('Notificación 6');
  });

  it('labels severity counts as page-only and still allows browsing other pages', async () => {
    notifications = items(6);
    await fixture.componentInstance['refresh']();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.filter-card.critical') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(rows()).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.filter-card.critical').textContent).toContain('0 en esta página');
    expect(actions()[1].disabled).toBe(false);
    actions()[1].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rows()).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.filter-card.critical').textContent).toContain('1 en esta página');
    expect(fixture.nativeElement.querySelector('.filter-scope').textContent).toContain('solo');
  });

  it('returns to page one when a new notification arrives', async () => {
    notifications = items(8);
    await fixture.componentInstance['refresh']();
    fixture.detectChanges();
    actions()[1].click();
    await fixture.whenStable();
    fixture.detectChanges();
    notifications = [{ ...notifications[0], idNotificacionUsuario: 'new', idNotificacion: '999', titulo: 'Nueva' }, ...notifications];
    notificationVersion.set(1);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.list).toHaveBeenLastCalledWith(5, 0);
    expect(fixture.nativeElement.querySelector('.page-summary').textContent).toContain('Página 1');
    expect(rows()[0].textContent).toContain('Nueva');
  });

  it('clamps the unread page when marking its final notification as read', async () => {
    notifications = items(6).map((item) => ({ ...item, leida: false }));
    unreadCount.set(6);
    (fixture.nativeElement.querySelector('.filter-card.unread') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    actions()[1].click();
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.alert-item button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.read).toHaveBeenCalledWith('106');
    expect(api.unread).toHaveBeenCalledWith(5, 5);
    expect(fixture.nativeElement.querySelector('.page-summary').textContent).toContain('Página 1');
    expect(rows()).toHaveLength(5);
    expect(overview.refresh).toHaveBeenCalled();
  });

  it('lets the user mark all as read even if this page has no unread items', async () => {
    notifications = items(6).map((item, i) => ({ ...item, leida: i !== 0 }));
    unreadCount.set(1);
    await fixture.componentInstance['refresh']();
    fixture.detectChanges();
    actions()[1].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rows().length).toBe(1);
    (fixture.nativeElement.querySelector('.show-all') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.readAll).toHaveBeenCalledOnce();
    expect(unreadCount()).toBe(0);
    expect(actions()[0].disabled).toBe(false);
  });

  it('ignores an outdated page response after switching to unread', async () => {
    notifications = items(8);
    await fixture.componentInstance['refresh']();
    fixture.detectChanges();
    const pending = new Subject<NotificationRecord[]>();
    api.list.mockReturnValueOnce(pending);
    actions()[1].click();
    (fixture.nativeElement.querySelector('.filter-card.unread') as HTMLButtonElement).click();
    await fixture.whenStable();
    pending.next(notifications.slice(5));
    pending.complete();
    fixture.detectChanges();
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('Notificación 1');
    expect(fixture.nativeElement.querySelector('.page-summary').textContent).toContain('Página 1');
  });

  it('clears old notifications when switching accounts before a request completes', async () => {
    const pending = new Subject<NotificationRecord[]>();
    api.list.mockReturnValueOnce(pending);
    const oldRequest = fixture.componentInstance['refresh']();
    token.set('second-account-token');
    user.set({ idUsuario: 2, rol: 'USUARIO' });
    notifications = [];
    fixture.detectChanges();
    pending.next(items(1));
    pending.complete();
    await oldRequest;
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rows()).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.page-summary').textContent).toContain('Página 1');
  });
});
