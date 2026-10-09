import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { notification, notificationPage } from '@testing/notification-fixtures';
import { NotificationItem } from '../data-access/notifications.models';
import { LATEST_COUNT, LatestNotificationsWidget } from './latest-notifications-widget';
import { testProviders } from '@testing/setup';

const URL = `/api/me/notifications?page=0&size=${String(LATEST_COUNT)}&read=false`;

describe('LatestNotificationsWidget', () => {
  let fixture: ComponentFixture<LatestNotificationsWidget>;
  let backend: HttpTestingController;

  function create(): void {
    TestBed.configureTestingModule({
      imports: [LatestNotificationsWidget],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LatestNotificationsWidget);
    fixture.componentRef.setInput('link', '/cabinet/notifications');
    fixture.detectChanges();
  }

  async function render(items: NotificationItem[], total = items.length): Promise<void> {
    create();
    backend.expectOne(URL).flush({ ...notificationPage(items, total), unread: total });
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function markReadButton(title: string): HTMLButtonElement {
    const button = hostElement(fixture).querySelector<HTMLButtonElement>(
      `button[aria-label="Отметить прочитанным: ${title}"]`,
    );
    if (button === null) {
      throw new Error(`no «Отметить прочитанным» for ${title}`);
    }
    return button;
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('shows a failed load with «Повторить», not «nothing»', async () => {
    create();
    backend.expectOne(URL).flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Не удалось загрузить уведомления');
    expect(readableText(hostElement(fixture))).not.toContain('Новых уведомлений нет');

    buttonByText(hostElement(fixture), 'Повторить').click();
    backend.expectOne(URL).flush(notificationPage([]));
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Новых уведомлений нет');
  });

  it('says when there is nothing new, without «Прочитать все»', async () => {
    await render([]);

    expect(readableText(hostElement(fixture))).toContain('Новых уведомлений нет');
    expect(readableText(hostElement(fixture))).not.toContain('Прочитать все');
    expect(hostElement(fixture).querySelector('a')?.getAttribute('href')).toBe(
      '/cabinet/notifications',
    );
  });

  it('opens a notification and marks it read', async () => {
    await render([notification(), notification({ id: 'n-2', title: 'Без ссылки', link: null })]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    expect(readableText(hostElement(fixture))).toContain('Непрочитанных: 2');
    expect(buttonByText(hostElement(fixture), 'Без ссылки').disabled).toBe(true);

    buttonByText(hostElement(fixture), 'Новое задание').click();
    backend.expectOne('/api/me/notifications/n-1/read').flush(null);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/cabinet/homework/t-1');
    expect(TestBed.inject(UnreadNotifications).count()).toBe(1);
    expect(readableText(hostElement(fixture))).not.toContain('Новое задание');
    expect(readableText(hostElement(fixture))).toContain('Без ссылки');
  });

  it('marks one read and fills its place with the next unread one', async () => {
    await render([notification(), notification({ id: 'n-2', title: 'Второе' })], 3);

    markReadButton('Новое задание: «Дроби»').click();
    backend.expectOne('/api/me/notifications/n-1/read').flush(null);
    backend
      .expectOne(URL)
      .flush(
        notificationPage([
          notification({ id: 'n-2', title: 'Второе' }),
          notification({ id: 'n-3', title: 'Третье' }),
        ]),
      );
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).not.toContain('Новое задание');
    expect(text).toContain('Третье');
    expect(TestBed.inject(UnreadNotifications).count()).toBe(2);
  });

  it('reads all at once', async () => {
    await render([notification(), notification({ id: 'n-2', title: 'Второе' })]);

    buttonByText(hostElement(fixture), 'Прочитать все').click();
    backend.expectOne('/api/me/notifications/read-all').flush(null);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Новых уведомлений нет');
    expect(readableText(hostElement(fixture))).not.toContain('Непрочитанных');
    expect(TestBed.inject(UnreadNotifications).count()).toBe(0);
  });
});
