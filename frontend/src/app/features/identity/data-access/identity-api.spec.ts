import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import { IdentityApi } from './identity-api';

describe('IdentityApi', () => {
  let api: IdentityApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(IdentityApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('calls the student management endpoints', () => {
    const profile = { displayName: 'Иван', email: null, phone: null, note: null };
    api.listStudents().subscribe();
    api.createStudent(profile).subscribe();
    api.updateStudent('id-1', profile, 3).subscribe();
    api.reissueInvite('id-1').subscribe();
    api.deactivate('id-1').subscribe();
    api.reactivate('id-1').subscribe();

    expect(backend.expectOne({ method: 'GET', url: '/api/teacher/students' })).toBeTruthy();
    expect(backend.expectOne({ method: 'POST', url: '/api/teacher/students' }).request.body).toEqual(profile);
    expect(backend.expectOne({ method: 'PUT', url: '/api/teacher/students/id-1' }).request.body).toEqual({
      ...profile,
      version: 3,
    });
    backend.expectOne({ method: 'POST', url: '/api/teacher/students/id-1/invite' });
    backend.expectOne({ method: 'POST', url: '/api/teacher/students/id-1/deactivate' });
    backend.expectOne({ method: 'POST', url: '/api/teacher/students/id-1/reactivate' });
  });

  it('handles invitation errors on the page itself', () => {
    api.describeInvite('a/b').subscribe();
    api.acceptInvite('a/b', 'ivan', 'password').subscribe();
    api.changePassword('old', 'new').subscribe();
    api.account().subscribe();

    const describe = backend.expectOne('/api/auth/invites/a%2Fb');
    expect(describe.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    const accept = backend.expectOne('/api/auth/invites/a%2Fb/accept');
    expect(accept.request.body).toEqual({ login: 'ivan', password: 'password' });
    expect(accept.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    expect(backend.expectOne('/api/me/password').request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    expect(backend.expectOne('/api/me').request.context.get(SKIP_ERROR_TOAST)).toBe(false);
  });
});
