import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { apiErrorInterceptor } from '@core/http/api-error.interceptor';
import { hostElement, requireElement } from '@testing/dom';
import { NotificationBell, UNREAD_POLL_INTERVAL_MS } from './notification-bell';
import { NotificationsSheetState } from './notifications-sheet-state';
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
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    vi.useRealTimers();
  });

  function bell(label: string): Element | null {
    return hostElement(fixture).querySelector(`button[aria-label="${label}"]`);
  }

  async function tick(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }

  it('shows the unread counter and refreshes it periodically', async () => {
    await tick(0);
    backend.expectOne('/api/me/notifications/unread-count').flush({ count: 3 });
    await tick(0);

    expect(bell('Уведомления, непрочитанных: 3')).not.toBeNull();
    expect(hostElement(fixture).querySelector('.p-badge')?.textContent).toContain('3');

    await tick(UNREAD_POLL_INTERVAL_MS);
    backend.expectOne('/api/me/notifications/unread-count').flush({ count: 150 });
    await tick(0);
    expect(hostElement(fixture).textContent).toContain('99+');

    await tick(UNREAD_POLL_INTERVAL_MS);
    backend.expectOne('/api/me/notifications/unread-count').flush({ count: 0 });
    await tick(0);
    expect(bell('Уведомления')).not.toBeNull();
    expect(requireElement(hostElement(fixture), '.p-badge', HTMLElement).style.display).toBe(
      'none',
    );
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

  it('opens and closes the notifications sheet', async () => {
    await tick(0);
    backend.expectOne('/api/me/notifications/unread-count').flush({ count: 0 });
    const sheet = TestBed.inject(NotificationsSheetState);
    const button = requireElement(hostElement(fixture), 'button', HTMLButtonElement);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('tb-notifications-sheet');

    button.click();
    await tick(0);
    expect(sheet.open()).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');

    button.click();
    await tick(0);
    expect(sheet.open()).toBe(false);
  });

  it('never shows a negative counter', () => {
    const unread = TestBed.inject(UnreadNotifications);

    unread.set(-1);

    expect(unread.count()).toBe(0);
    backend.match('/api/me/notifications/unread-count');
  });
});
