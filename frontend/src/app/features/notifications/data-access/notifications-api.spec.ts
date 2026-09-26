import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import { NotificationsApi } from './notifications-api';

describe('NotificationsApi', () => {
  let api: NotificationsApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(NotificationsApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('calls the notification endpoints', () => {
    api.page(2, 20).subscribe();
    api.markRead('n-1').subscribe();
    api.markAllRead().subscribe();

    expect(backend.expectOne('/api/me/notifications?page=2&size=20').request.method).toBe('GET');
    expect(backend.expectOne('/api/me/notifications/n-1/read').request.method).toBe('POST');
    expect(backend.expectOne('/api/me/notifications/read-all').request.method).toBe('POST');
  });

  it('calls the channel endpoints', () => {
    api.channels().subscribe();
    api.createLinkCode('MAX').subscribe();
    api.setChannelEnabled('VK', false).subscribe();
    api.unlink('TELEGRAM').subscribe();

    expect(backend.expectOne('/api/me/channels').request.method).toBe('GET');
    expect(backend.expectOne('/api/me/channels/MAX/link-code').request.method).toBe('POST');
    const toggle = backend.expectOne('/api/me/channels/VK');
    expect(toggle.request.method).toBe('PUT');
    expect(toggle.request.body).toEqual({ enabled: false });
    expect(backend.expectOne('/api/me/channels/TELEGRAM').request.method).toBe('DELETE');
  });

  it('broadcasts and returns the number of recipients', () => {
    let recipients = 0;
    api.broadcast({ title: 'Привет', body: null, studentIds: [] }).subscribe((value) => {
      recipients = value;
    });

    const request = backend.expectOne('/api/teacher/notifications/broadcast');
    expect(request.request.body).toEqual({ title: 'Привет', body: null, studentIds: [] });
    request.flush({ recipients: 4 });

    expect(recipients).toBe(4);
  });

  it('calls the preference endpoints', () => {
    api.preferences().subscribe();
    api.savePreferences({ mutedTopics: ['BILLING'], quietFrom: '22:00', quietTo: '08:00' }).subscribe();

    expect(backend.expectOne({ method: 'GET', url: '/api/me/notifications/preferences' })).toBeTruthy();
    const save = backend.expectOne({ method: 'PUT', url: '/api/me/notifications/preferences' });
    expect(save.request.body).toEqual({ mutedTopics: ['BILLING'], quietFrom: '22:00', quietTo: '08:00' });
  });

  it('calls the teacher endpoints of bots, students and messages', () => {
    let recipients = 0;
    api.bots().subscribe();
    api.saveBot('VK', { token: 't', groupId: 7 }).subscribe();
    api.removeBot('MAX').subscribe();
    api.testBot('TELEGRAM').subscribe();
    api.studentMessengers().subscribe();
    api.summary().subscribe();
    api.broadcasts().subscribe();
    api.remindToConnect(['s-1']).subscribe((count) => (recipients = count));

    expect(backend.expectOne({ method: 'GET', url: '/api/teacher/notifications/channels' })).toBeTruthy();
    const save = backend.expectOne({ method: 'PUT', url: '/api/teacher/notifications/channels/VK' });
    expect(save.request.body).toEqual({ token: 't', groupId: 7 });
    expect(save.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/notifications/channels/MAX' });
    const test = backend.expectOne({ method: 'POST', url: '/api/teacher/notifications/channels/TELEGRAM/test' });
    expect(test.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    backend.expectOne({ method: 'GET', url: '/api/teacher/notifications/students' });
    backend.expectOne({ method: 'GET', url: '/api/teacher/notifications/summary' });
    backend.expectOne({ method: 'GET', url: '/api/teacher/notifications/broadcasts' });
    const remind = backend.expectOne({ method: 'POST', url: '/api/teacher/notifications/remind-connect' });
    expect(remind.request.body).toEqual({ studentIds: ['s-1'] });
    remind.flush({ recipients: 4 });
    expect(recipients).toBe(4);
  });
});
