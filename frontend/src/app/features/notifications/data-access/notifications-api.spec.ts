import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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
});
