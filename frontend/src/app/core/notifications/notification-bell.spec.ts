import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { apiErrorInterceptor } from '@core/http/api-error.interceptor';
import { buttonByText, hostElement } from '@testing/dom';
import { NotificationBell, UNREAD_POLL_INTERVAL_MS } from './notification-bell';
import { UnreadNotifications } from './unread-notifications';

describe('NotificationBell', () => {
  let fixture: ComponentFixture<NotificationBell>;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [NotificationBell],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        providePrimeNG(),
        MessageService,
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationBell);
    fixture.componentRef.setInput('link', '/cabinet/notifications');
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    vi.useRealTimers();
  });

  async function tick(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }

  it('shows the unread counter and refreshes it periodically', async () => {
    await tick(0);
    backend.expectOne('/api/me/notifications/unread-count').flush({ count: 3 });
    await tick(0);

    expect(buttonByText(hostElement(fixture), 'Уведомления, непрочитанных: 3').textContent).toContain('3');

    await tick(UNREAD_POLL_INTERVAL_MS);
    backend.expectOne('/api/me/notifications/unread-count').flush({ count: 150 });
    await tick(0);
    expect(hostElement(fixture).textContent).toContain('99+');

    await tick(UNREAD_POLL_INTERVAL_MS);
    backend.expectOne('/api/me/notifications/unread-count').flush({ count: 0 });
    await tick(0);
    expect(buttonByText(hostElement(fixture), 'Уведомления').textContent.trim()).toBe('');
  });

  it('keeps the last value quietly when the request fails', async () => {
    const messages = vi.spyOn(TestBed.inject(MessageService), 'add');
    TestBed.inject(UnreadNotifications).set(2);
    await tick(0);
    backend
      .expectOne('/api/me/notifications/unread-count')
      .flush(null, { status: 503, statusText: 'Unavailable' });
    await tick(0);

    expect(TestBed.inject(UnreadNotifications).count()).toBe(2);
    expect(messages).not.toHaveBeenCalled();
  });

  it('opens the notifications page', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await tick(0);
    backend.expectOne('/api/me/notifications/unread-count').flush({ count: 0 });

    buttonByText(hostElement(fixture), 'Уведомления').click();

    expect(navigate).toHaveBeenCalledWith('/cabinet/notifications');
  });

  it('never shows a negative counter', () => {
    const unread = TestBed.inject(UnreadNotifications);

    unread.set(-1);

    expect(unread.count()).toBe(0);
    backend.match('/api/me/notifications/unread-count');
  });
});
