import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { notification, notificationPage } from '@testing/notification-fixtures';
import { NotificationPage } from '../data-access/notifications.models';
import { InboxPanel, PAGE_SIZE } from './inbox-panel';

describe('InboxPanel', () => {
  let fixture: ComponentFixture<InboxPanel>;
  let backend: HttpTestingController;

  async function render(page: NotificationPage): Promise<void> {
    TestBed.configureTestingModule({
      imports: [InboxPanel],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InboxPanel);
    fixture.detectChanges();
    backend.expectOne(`/api/me/notifications?page=0&size=${String(PAGE_SIZE)}`).flush(page);
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('lists notifications and updates the unread counter', async () => {
    await render(
      notificationPage([
        notification(),
        notification({ id: 'n-2', kind: 'MESSAGE', title: 'Перенос', body: null, link: null, read: true }),
      ]),
    );

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Непрочитанных: 1');
    expect(text).toContain('Новое задание: «Дроби» Срок сдачи: 25.09.2026 18:30');
    expect(text).toContain('Перенос');
    expect(TestBed.inject(UnreadNotifications).count()).toBe(1);
  });

  it('says when there is nothing', async () => {
    await render(notificationPage([]));

    expect(readableText(hostElement(fixture))).toContain('Уведомлений пока нет');
  });

  it('opens a notification and marks it read', async () => {
    await render(notificationPage([notification()]));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    buttonByText(hostElement(fixture), 'Открыть').click();
    backend.expectOne('/api/me/notifications/n-1/read').flush(null);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/cabinet/homework/t-1');
    expect(TestBed.inject(UnreadNotifications).count()).toBe(0);
    expect(() => buttonByText(hostElement(fixture), 'Отметить прочитанным')).toThrow();
  });

  it('opens an already read notification without requests', async () => {
    await render(notificationPage([notification({ read: true })]));
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    fixture.componentInstance.open(notification({ read: true }));
    fixture.componentInstance.open(notification({ read: true, link: null }));

    backend.expectNone('/api/me/notifications/n-1/read');
  });

  it('marks all as read', async () => {
    await render(notificationPage([notification(), notification({ id: 'n-2' })]));

    buttonByText(hostElement(fixture), 'Прочитать все').click();
    backend.expectOne('/api/me/notifications/read-all').flush(null);
    await fixture.whenStable();

    expect(TestBed.inject(UnreadNotifications).count()).toBe(0);
    expect(buttonByText(hostElement(fixture), 'Прочитать все').disabled).toBe(true);
  });

  it('loads more pages', async () => {
    const first = Array.from({ length: PAGE_SIZE }, (_, index) =>
      notification({ id: `n-${String(index)}`, title: `Уведомление ${String(index)}`, read: true }),
    );
    await render(notificationPage(first, PAGE_SIZE + 1));

    buttonByText(hostElement(fixture), 'Показать ещё').click();
    backend
      .expectOne(`/api/me/notifications?page=1&size=${String(PAGE_SIZE)}`)
      .flush(notificationPage([notification({ id: 'n-last', title: 'Самое старое' })], PAGE_SIZE + 1));
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Самое старое');
    expect(() => buttonByText(hostElement(fixture), 'Показать ещё')).toThrow();
  });

  it('survives a failed page load', async () => {
    await render(notificationPage([notification()], 30));

    fixture.componentInstance.loadMore();
    backend
      .expectOne(`/api/me/notifications?page=0&size=${String(PAGE_SIZE)}`)
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Дроби');
  });

  it('says when everything is read', async () => {
    await render(notificationPage([notification({ read: true })]));

    expect(readableText(hostElement(fixture))).toContain('Все уведомления прочитаны');
  });
});
