import { DatePipe } from '@angular/common';
import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterLink, provideRouter } from '@angular/router';
import { SessionStore } from '../../core/auth/session-store';
import { LocationsStore } from '../../core/locations/locations-store';
import { OverviewStore } from '../../core/overview/overview-store';
import { Dashboard } from './dashboard';

@Component({ selector: 'app-live-map', template: '' })
class MapStub {
  readonly overlayLayout = input(false);
}

@Component({ selector: 'app-emergency-controls', template: '' })
class EmergencyControlsStub {}

@Component({ selector: 'app-public-emergency-lookup', template: '' })
class PublicEmergencyLookupStub {}

describe('Dashboard layout', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps emergency controls on mobile only while the desktop map and summaries remain visible', async () => {
    let onViewportChange: ((event: MediaQueryListEvent) => void) | undefined;
    const removeListener = vi.fn();
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        onViewportChange = listener;
      },
      removeEventListener: removeListener,
    })));
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        { provide: SessionStore, useValue: { isAuthenticated: signal(true) } },
        { provide: LocationsStore, useValue: { connected: signal(false), locations: signal([]) } },
        { provide: OverviewStore, useValue: {
          contacts: signal([]), notifications: signal([]), emergencies: signal([]), unreadCount: signal(0),
        } },
      ],
    }).overrideComponent(Dashboard, {
      set: { imports: [RouterLink, DatePipe, MapStub, EmergencyControlsStub, PublicEmergencyLookupStub] },
    }).compileComponents();

    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 960px)');
    expect(fixture.nativeElement.querySelector('.stage .map app-live-map')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.map-foot .expand-map')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.map-foot a.expand-map')).toBeNull();
    expect(fixture.nativeElement.querySelector('.stage .float-panels app-emergency-controls')).toBeNull();
    expect(fixture.nativeElement.querySelector('.float-panels').getAttribute('aria-label')).toBe('Paneles de resumen');
    expect(fixture.nativeElement.querySelector('.kpi-alert')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-public-emergency-lookup')).toBeTruthy();

    onViewportChange?.({ matches: true } as MediaQueryListEvent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.stage .float-panels app-emergency-controls')).toBeTruthy();

    onViewportChange?.({ matches: false } as MediaQueryListEvent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.stage .float-panels app-emergency-controls')).toBeNull();
    fixture.destroy();
    expect(removeListener).toHaveBeenCalledWith('change', onViewportChange);
  });

  it('allows visitors to consult a public code without displaying emergency management controls', async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        { provide: SessionStore, useValue: { isAuthenticated: signal(false) } },
        { provide: LocationsStore, useValue: { connected: signal(false), locations: signal([]) } },
        { provide: OverviewStore, useValue: {
          contacts: signal([]), notifications: signal([]), emergencies: signal([]), unreadCount: signal(0),
        } },
      ],
    }).overrideComponent(Dashboard, {
      set: { imports: [RouterLink, DatePipe, MapStub, EmergencyControlsStub, PublicEmergencyLookupStub] },
    }).compileComponents();
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.stage .map app-live-map')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-public-emergency-lookup')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-emergency-controls')).toBeNull();
    fixture.destroy();
  });
});
