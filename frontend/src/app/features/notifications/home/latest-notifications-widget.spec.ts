import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { notification, notificationPage } from '@testing/notification-fixtures';
import { NotificationItem } from '../data-access/notifications.models';
import { LATEST_COUNT, LatestNotificationsWidget } from './latest-notifications-widget';

describe('LatestNotificationsWidget', () => {
  let fixture: ComponentFixture<LatestNotificationsWidget>;
  let backend: HttpTestingController;

  async function render(items: NotificationItem[]): Promise<void> {
    TestBed.configureTestingModule({
      imports: [LatestNotificationsWidget],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LatestNotificationsWidget);
    fixture.componentRef.setInput('link', '/cabinet/notifications');
    fixture.detectChanges();
    backend.expectOne(`/api/me/notifications?page=0&size=${String(LATEST_COUNT)}`).flush(notificationPage(items));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('says when there is nothing', async () => {
    await render([]);

    expect(readableText(hostElement(fixture))).toContain('Уведомлений пока нет');
    expect(hostElement(fixture).querySelector('a')?.getAttribute('href')).toBe('/cabinet/notifications');
  });

  it('opens an unread notification and marks it read', async () => {
    await render([notification(), notification({ id: 'n-2', title: 'Без ссылки', link: null, read: true })]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    expect(readableText(hostElement(fixture))).toContain('Непрочитанных: 1');
    expect(buttonByText(hostElement(fixture), 'Без ссылки').disabled).toBe(true);

    buttonByText(hostElement(fixture), 'Новое задание').click();
    backend.expectOne('/api/me/notifications/n-1/read').flush(null);

    expect(navigate).toHaveBeenCalledWith('/cabinet/homework/t-1');
    expect(TestBed.inject(UnreadNotifications).count()).toBe(0);
    fixture.componentInstance.open(notification({ id: 'n-2', link: null, read: true }));
    backend.expectNone('/api/me/notifications/n-2/read');
  });
});
