import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GroupSharingApi } from './group-sharing-api';
import { GroupsApi } from './groups-api';

describe('Groups API', () => {
  let groups: GroupsApi;
  let sharing: GroupSharingApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    groups = TestBed.inject(GroupsApi);
    sharing = TestBed.inject(GroupSharingApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('updates a group and removes a member with the documented endpoints', () => {
    groups.update(2, { nombre: 'Familia', descripcion: 'Cercanos' }).subscribe();
    const update = http.expectOne((request) => request.url.endsWith('/groups/2'));
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ nombre: 'Familia', descripcion: 'Cercanos' });
    update.flush({});

    groups.removeMember(2, 7).subscribe();
    const remove = http.expectOne((request) => request.url.endsWith('/groups/2/members/7'));
    expect(remove.request.method).toBe('DELETE');
    remove.flush({});
  });

  it('cancels a pending invitation by its server ID', () => {
    groups.respond(19, 'cancel').subscribe();
    const cancel = http.expectOne((request) => request.url.endsWith('/groups/invitations/19/cancel'));
    expect(cancel.request.method).toBe('PATCH');
    cancel.flush({});
  });

  it('uses per-assignment member exclusions with the correct permitted flag', () => {
    sharing.allowMember(4, 2, 7, false).subscribe();
    const exclude = http.expectOne((request) => request.url.endsWith('/user-devices/4/groups/2/members/7/sharing'));
    expect(exclude.request.method).toBe('PATCH');
    expect(exclude.request.body).toEqual({ permitido: false });
    exclude.flush({});

    sharing.allowMember(4, 2, 7, true).subscribe();
    const restore = http.expectOne((request) => request.url.endsWith('/user-devices/4/groups/2/members/7/sharing'));
    expect(restore.request.body).toEqual({ permitido: true });
    restore.flush({});
  });
});
