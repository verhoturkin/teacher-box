import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@core/auth/auth.models';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { authResponse } from '@testing/auth';
import { bodyText, buttonByText, hostElement, readableText } from '@testing/dom';
import { notification, notificationPage } from '@testing/notification-fixtures';
import { NotificationPage } from './data-access/notifications.models';
import { NotificationsPage, PAGE_SIZE } from './notifications-page';

describe('NotificationsPage', () => {
  let fixture: ComponentFixture<NotificationsPage>;
  let backend: HttpTestingController;

  async function render(page: NotificationPage, role: Role = 'STUDENT'): Promise<void> {
    TestBed.configureTestingModule({
      imports: [NotificationsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        providePrimeNG(),
        MessageService,
      ],
    });
    TestBed.inject(AuthService).acceptSession(authResponse(role));
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();
    backend.expectOne(`/api/me/notifications?page=0&size=${String(PAGE_SIZE)}`).flush(page);
    backend.expectOne('/api/me/channels').flush([]);
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
    expect(text).toContain('Новое задание: «Дроби» Срок сдачи: 25.09.2026 18:30');
    expect(text).toContain('Перенос');
    expect(TestBed.inject(UnreadNotifications).count()).toBe(1);
    expect(text).not.toContain('Написать ученикам');
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

  it('lets the teacher write to students', async () => {
    await render(notificationPage([]), 'TEACHER');
    const messages = vi.spyOn(TestBed.inject(MessageService), 'add');

    buttonByText(hostElement(fixture), 'Написать ученикам').click();
    backend.expectOne('/api/teacher/students').flush([
      { id: 's-1', displayName: 'Мария', status: 'ACTIVE' },
      { id: 's-2', displayName: 'Бывший', status: 'DEACTIVATED' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(bodyText()).toContain('Сообщение ученикам');
    fixture.componentInstance.onBroadcast(1);
    expect(messages).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Получателей: 1' }));
  });
});
