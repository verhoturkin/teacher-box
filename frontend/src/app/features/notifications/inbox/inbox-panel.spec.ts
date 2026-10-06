import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { notification, notificationPage } from '@testing/notification-fixtures';
import { NotificationPage } from '../data-access/notifications.models';
import { InboxPanel, PAGE_SIZE } from './inbox-panel';
import { testProviders } from '@testing/setup';

const SIZE = String(PAGE_SIZE);

function url(page: number, read: boolean): string {
  return `/api/me/notifications?page=${String(page)}&size=${SIZE}&read=${String(read)}`;
}

describe('InboxPanel', () => {
  let fixture: ComponentFixture<InboxPanel>;
  let backend: HttpTestingController;

  async function render(page: NotificationPage): Promise<void> {
    TestBed.configureTestingModule({
      imports: [InboxPanel],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InboxPanel);
    fixture.detectChanges();
    backend.expectOne(url(0, false)).flush(page);
    await fixture.whenStable();
  }

  function host(): HTMLElement {
    return hostElement(fixture);
  }

  function text(): string {
    return readableText(host());
  }

  function list(label: string): string[] {
    return Array.from(host().querySelectorAll(`ul[aria-label="${label}"] > li`)).map((row) =>
      readableText(row),
    );
  }

  /** Opens «Прочитанные» and answers its first page. */
  async function openRead(page: NotificationPage): Promise<void> {
    buttonByText(host(), 'Прочитанные').click();
    backend.expectOne(url(0, true)).flush(page);
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('lists the unread notifications and keeps the read ones folded', async () => {
    await render(notificationPage([notification()]));

    expect(text()).toContain('Непрочитанных: 1');
    expect(list('Непрочитанные')).toEqual([
      expect.stringContaining('Новое задание: «Дроби» Срок сдачи: 25.09.2026 18:30'),
    ]);
    expect(TestBed.inject(UnreadNotifications).count()).toBe(1);
    const toggle = buttonByText(host(), 'Прочитанные');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(list('Прочитанные уведомления')).toEqual([]);
  });

  it('loads the read ones when «Прочитанные» is opened, once', async () => {
    await render(notificationPage([]));
    expect(text()).toContain('Новых уведомлений нет');

    await openRead(
      notificationPage([notification({ id: 'n-2', title: 'Перенос', link: null, read: true })]),
    );

    expect(buttonByText(host(), 'Прочитанные').getAttribute('aria-expanded')).toBe('true');
    expect(list('Прочитанные уведомления')).toEqual([expect.stringContaining('Перенос')]);
    expect(() => buttonByText(host(), 'Отметить прочитанным')).toThrow();

    buttonByText(host(), 'Прочитанные').click();
    await fixture.whenStable();
    buttonByText(host(), 'Прочитанные').click();
    await fixture.whenStable();
    expect(list('Прочитанные уведомления')).toHaveLength(1);
  });

  it('says when nothing has been read yet', async () => {
    await render(notificationPage([]));
    await openRead(notificationPage([]));

    expect(text()).toContain('Прочитанных уведомлений нет');
  });

  it('moves a notification marked read into «Прочитанные»', async () => {
    await render(
      notificationPage([
        notification({ id: 'n-new', createdAt: '2026-09-24T12:00:00Z' }),
        notification({ id: 'n-mid', title: 'Среднее', createdAt: '2026-09-24T11:00:00Z' }),
      ]),
    );
    await openRead(
      notificationPage([
        notification({
          id: 'n-old',
          title: 'Старое',
          createdAt: '2026-09-24T09:00:00Z',
          read: true,
        }),
      ]),
    );

    buttonByText(host(), 'Отметить прочитанным').click();
    backend.expectOne('/api/me/notifications/n-new/read').flush(null);
    await fixture.whenStable();
    const [mid] = host().querySelectorAll<HTMLButtonElement>(
      'ul[aria-label="Непрочитанные"] button[aria-label="Отметить прочитанным"]',
    );
    mid?.click();
    backend.expectOne('/api/me/notifications/n-mid/read').flush(null);
    await fixture.whenStable();

    expect(text()).toContain('Новых уведомлений нет');
    expect(list('Прочитанные уведомления')).toEqual([
      expect.stringContaining('Дроби'),
      expect.stringContaining('Среднее'),
      expect.stringContaining('Старое'),
    ]);
    expect(TestBed.inject(UnreadNotifications).count()).toBe(0);
  });

  it('opens a notification and marks it read', async () => {
    await render(notificationPage([notification()]));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    buttonByText(host(), 'Открыть').click();
    backend.expectOne('/api/me/notifications/n-1/read').flush(null);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/cabinet/homework/t-1');
    expect(TestBed.inject(UnreadNotifications).count()).toBe(0);
    expect(list('Непрочитанные')).toEqual([]);
  });

  it('opens an already read notification without requests', async () => {
    await render(notificationPage([]));
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    fixture.componentInstance.open(notification({ read: true }));
    fixture.componentInstance.open(notification({ read: true, link: null }));

    backend.expectNone('/api/me/notifications/n-1/read');
  });

  it('marks all as read and loads «Прочитанные» again', async () => {
    await render(notificationPage([notification(), notification({ id: 'n-2' })]));
    await openRead(notificationPage([]));

    buttonByText(host(), 'Прочитать все').click();
    backend.expectOne('/api/me/notifications/read-all').flush(null);
    backend
      .expectOne(url(0, true))
      .flush(
        notificationPage([notification({ read: true }), notification({ id: 'n-2', read: true })]),
      );
    await fixture.whenStable();

    expect(TestBed.inject(UnreadNotifications).count()).toBe(0);
    expect(() => buttonByText(host(), 'Прочитать все')).toThrow();
    expect(list('Прочитанные уведомления')).toHaveLength(2);
  });

  it('marks all as read while «Прочитанные» is folded', async () => {
    await render(notificationPage([notification()]));

    buttonByText(host(), 'Прочитать все').click();
    backend.expectOne('/api/me/notifications/read-all').flush(null);
    await fixture.whenStable();

    await openRead(notificationPage([notification({ read: true })]));
    expect(list('Прочитанные уведомления')).toHaveLength(1);
  });

  it('loads more pages of both parts', async () => {
    const unread = Array.from({ length: PAGE_SIZE }, (_, index) =>
      notification({ id: `n-${String(index)}`, title: `Уведомление ${String(index)}` }),
    );
    await render(notificationPage(unread, PAGE_SIZE + 1));

    buttonByText(host(), 'Показать ещё').click();
    backend
      .expectOne(url(1, false))
      .flush(
        notificationPage([notification({ id: 'n-last', title: 'Самое старое' })], PAGE_SIZE + 1),
      );
    await fixture.whenStable();
    expect(list('Непрочитанные')).toHaveLength(PAGE_SIZE + 1);
    expect(() => buttonByText(host(), 'Показать ещё')).toThrow();

    const read = unread.map((item) => ({ ...item, id: `r-${item.id}`, read: true }));
    await openRead(notificationPage(read, PAGE_SIZE + 1));
    buttonByText(host(), 'Показать ещё').click();
    backend
      .expectOne(url(1, true))
      .flush(notificationPage([notification({ id: 'r-last', read: true })], PAGE_SIZE + 1));
    await fixture.whenStable();
    expect(list('Прочитанные уведомления')).toHaveLength(PAGE_SIZE + 1);
  });

  it('survives a failed page load', async () => {
    await render(notificationPage([notification()], 30));
    const add = vi.spyOn(TestBed.inject(MessageService), 'add');

    fixture.componentInstance.loadMore();
    backend.expectOne(url(0, false)).flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(text()).toContain('Дроби');
    expect(add).toHaveBeenCalled();
  });

  it('retries a failed load of «Прочитанные»', async () => {
    await render(notificationPage([]));
    buttonByText(host(), 'Прочитанные').click();
    backend.expectOne(url(0, true)).flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(text()).toContain('Не удалось загрузить прочитанные уведомления');

    buttonByText(host(), 'Повторить').click();
    backend.expectOne(url(0, true)).flush(notificationPage([notification({ read: true })]));
    await fixture.whenStable();

    expect(list('Прочитанные уведомления')).toHaveLength(1);
  });

  it('retries a failed first load', async () => {
    TestBed.configureTestingModule({ imports: [InboxPanel], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InboxPanel);
    fixture.detectChanges();
    backend.expectOne(url(0, false)).flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(text()).toContain('Не удалось загрузить уведомления');

    buttonByText(host(), 'Повторить').click();
    backend.expectOne(url(0, false)).flush(notificationPage([notification()]));
    await fixture.whenStable();

    expect(list('Непрочитанные')).toHaveLength(1);
  });
});
