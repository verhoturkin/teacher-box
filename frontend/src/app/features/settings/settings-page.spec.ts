import { HttpTestingController } from '@angular/common/http/testing';
import { Provider, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthService } from '@core/auth/auth.service';
import { PageDetail } from '@core/routing/page-detail';
import { UnsavedChanges } from '@core/routing/unsaved-changes';
import { hostElement, readableText, requireElement, typeInto } from '@testing/dom';
import { aiStatus, systemPrompt, usageReport } from '@testing/ai-fixtures';
import { overview } from '@testing/billing-fixtures';
import { portalSettings } from '@testing/portal-fixtures';
import { channelSetup, studentMessengers } from '@testing/notification-fixtures';
import { calendarFeed, scheduleSettings } from '@testing/schedule-fixtures';
import { screenWidth, testProviders } from '@testing/setup';
import { BackupInfo, NotificationsStatus } from './data-access/settings.models';
import { SettingsPage } from './settings-page';
import { SettingsCategory } from './settings-categories';

const BACKUP: BackupInfo = {
  name: 'teacherbox-20260925-033000-000.zip',
  size: 2_621_440,
  createdAt: '2026-09-25T00:30:00Z',
  kind: 'SCHEDULED',
  version: '1.3.0',
};

const STATUS: NotificationsStatus = {
  channels: [
    { channel: 'TELEGRAM', connection: 'OK', error: null, checkedAt: '2026-09-26T10:00:00Z' },
    { channel: 'MAX', connection: 'PENDING', error: null, checkedAt: null },
  ],
  failedDeliveries: [
    {
      recipientId: 's-1',
      recipientName: 'Мария',
      channel: 'TELEGRAM',
      attempts: 1,
      error: 'Telegram 403: Forbidden: bot was blocked by the user',
      text: 'Новое задание',
      createdAt: '2026-09-24T10:00:00Z',
    },
    {
      recipientId: 't-1',
      recipientName: null,
      channel: 'MAX',
      attempts: 8,
      error: null,
      text: 'Работа на проверку',
      createdAt: '2026-09-24T09:00:00Z',
    },
  ],
};

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let backend: HttpTestingController;

  /** Answers what the panels of a category ask for. */
  function flushCategory(category: SettingsCategory): void {
    switch (category) {
      case 'account':
        backend.expectOne('/api/me');
        break;
      case 'portal':
        backend.expectOne('/api/teacher/portal').flush(portalSettings());
        break;
      case 'lessons':
        backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
        backend.expectOne('/api/me/schedule/feed').flush(calendarFeed());
        backend.expectOne('/api/teacher/billing/overview').flush(overview([]));
        backend.expectOne('/api/teacher/schedule/google').flush({
          clientConfigured: false,
          clientFromEnvironment: false,
          clientId: null,
          status: 'NOT_CONNECTED',
          busyEnabled: false,
          lastError: null,
          lastSyncAt: null,
          connectedAt: null,
          callbackPath: '/api/public/schedule/google/callback',
        });
        backend.expectOne('/api/teacher/meetings/calls').flush({ status: 'OFF', rooms: [] });
        break;
      case 'messengers':
        backend.expectOne('/api/teacher/notifications/channels').flush([channelSetup()]);
        backend
          .expectOne('/api/teacher/notifications/bot')
          .flush({ teacherActions: true, teacherMenu: [], studentMenu: [] });
        backend.expectOne('/api/teacher/notifications/students').flush([studentMessengers()]);
        break;
      case 'ai':
        backend.expectOne('/api/teacher/ai/usage').flush(usageReport());
        break;
      case 'data':
        backend.expectOne('/api/teacher/backups/google').flush({
          clientConfigured: false,
          clientFromEnvironment: false,
          clientId: null,
          connected: false,
          account: null,
          connectedAt: null,
          lastUploadAt: null,
          lastUploadName: null,
          lastError: null,
          running: null,
          callbackPath: '/api/public/backups/google/callback',
        });
        break;
    }
  }

  /** The page at `width` px; `shown` — the category whose panels are on the screen, if any. */
  async function render(
    width: number,
    category: SettingsCategory | undefined,
    shown: SettingsCategory | null = category ?? null,
    status = STATUS,
    providers: Provider[] = [],
  ): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [...testProviders(), screenWidth(width), ...providers],
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(SettingsPage);
    if (category !== undefined) {
      fixture.componentRef.setInput('category', category);
    }
    fixture.detectChanges();
    backend.expectOne('/api/teacher/notifications/status').flush(status);
    // the states of the list; the panels of «ИИ-помощник» and «Данные» ask the same
    for (const request of backend.match('/api/teacher/ai/status')) {
      request.flush(aiStatus());
    }
    for (const request of backend.match('/api/teacher/backups')) {
      request.flush([BACKUP]);
    }
    await fixture.whenStable();
    if (shown !== null) {
      flushCategory(shown);
    }
    await fixture.whenStable();
    return hostElement(fixture);
  }

  function panes(host: HTMLElement): HTMLElement[] {
    return Array.from(host.querySelectorAll<HTMLElement>('tb-pane'));
  }

  function current(host: HTMLElement): string | undefined {
    return host.querySelector('[aria-current="page"] .tb-settings__title')?.textContent.trim();
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('lists the six categories with their states, the failed deliveries counted', async () => {
    const host = await render(1200, undefined, 'account');

    const list = readableText(requireElement(host, 'nav', HTMLElement));
    expect(list).toContain('Мой аккаунт Профиль, уведомления, вход');
    expect(list).toContain('Портал Название, логотип, цвет');
    expect(list).toContain('Занятия Пояс, цена, календарь, звонки');
    expect(list).toContain('Мессенджеры Telegram работает 2');
    expect(list).toContain('ИИ-помощник Подключён · 0 % лимита');
    expect(list).toContain('Данные Копия 25 сентября');
    expect(host.querySelector('nav p-tag')?.textContent.trim()).toBe('2');
    const links = Array.from(host.querySelectorAll('nav a')).map((link) =>
      link.getAttribute('href'),
    );
    expect(links).toEqual([
      '/teacher/settings/account',
      '/teacher/settings/portal',
      '/teacher/settings/lessons',
      '/teacher/settings/messengers',
      '/teacher/settings/ai',
      '/teacher/settings/data',
    ]);
  });

  it('keeps the list and the account in one pane of /teacher/settings from expanded', async () => {
    const host = await render(1200, undefined, 'account');

    expect(panes(host)).toHaveLength(1);
    expect(host.querySelector('h1')?.textContent).toContain('Настройки');
    expect(readableText(host)).toContain('Изменения сохраняются сразу');
    expect(host.querySelector('tb-account-panel')).not.toBeNull();
    expect(current(host)).toBe('Мой аккаунт');
    expect(TestBed.inject(PageDetail).value()).toBe('Мой аккаунт');
  });

  it('does not promise saving at once in the portal: it has its own «Сохранить»', async () => {
    const host = await render(1200, 'portal');

    expect(readableText(host)).not.toContain('Изменения сохраняются сразу');
    expect(host.querySelector('#portal')).not.toBeNull();
  });

  it.each([600, 839])('shows one-line categories beside the chosen one at %i px', async (width) => {
    const host = await render(width, 'lessons');

    expect(panes(host)).toHaveLength(1);
    const nav = requireElement(host, 'nav', HTMLElement);
    expect(nav.classList).toContain('tb-settings__nav--medium');
    expect(nav.querySelector('.tb-settings__summary')).toBeNull();
    expect(readableText(host)).not.toContain('Изменения сохраняются сразу');
    expect(readableText(nav)).toContain('Мессенджеры 2');
    expect(host.querySelector('#time-zone')).not.toBeNull();
    expect(current(host)).toBe('Занятия');
    expect(host.querySelector('.tb-page-header__back')).toBeNull();
  });

  it('leads the list with the account at 599 px, the portal’s categories follow', async () => {
    const user = signal({ displayName: 'Елена Викторовна', avatar: null });
    const host = await render(599, undefined, null, STATUS, [
      { provide: AuthService, useValue: { user } },
    ]);

    expect(panes(host)).toHaveLength(1);
    const lists = host.querySelectorAll<HTMLElement>('nav ul');
    expect(lists).toHaveLength(2);
    expect(readableText(lists[0] ?? host)).toBe(
      'ЕВ Елена Викторовна Мой аккаунт · уведомления, вход, тема',
    );
    expect(host.querySelector('nav h2')?.textContent).toContain('Портал');
    const portal = readableText(lists[1] ?? host);
    expect(portal).toContain('Оформление портала Название, логотип, цвет');
    expect(portal).toContain('Мессенджеры 2 не доставлено 2');
    expect(portal).not.toContain('Мой аккаунт');
    expect(host.querySelectorAll('nav .tb-i-chevron_right')).toHaveLength(6);
    expect(current(host)).toBeUndefined();
    expect(host.querySelector('tb-account-panel')).toBeNull();
    expect(TestBed.inject(PageDetail).value()).toBeNull();
  });

  it('shows the state of the messengers at 599 px when every notification was delivered', async () => {
    const host = await render(599, undefined, null, {
      channels: STATUS.channels,
      failedDeliveries: [],
    });

    expect(readableText(requireElement(host, 'nav', HTMLElement))).toContain(
      'Мессенджеры Telegram работает',
    );
    expect(host.querySelector('nav p-tag')).toBeNull();
  });

  it('shows only the category at 599 px, «back» leads to the list', async () => {
    const host = await render(599, 'data');

    expect(panes(host)).toHaveLength(1);
    expect(host.querySelector('nav')).toBeNull();
    expect(host.querySelector('h1')?.textContent).toContain('Данные');
    const back = requireElement(host, '.tb-page-header__back', HTMLElement);
    expect(back.getAttribute('href')).toBe('/teacher/settings');
    expect(back.getAttribute('aria-label')).toBe('Все настройки');
    expect(host.querySelector('#backups')).not.toBeNull();
    expect(host.querySelector('#drive')).not.toBeNull();
    expect(host.querySelector('#reset')).not.toBeNull();
  });

  it('shows the time zone, the price, the calendars and the calls in the lessons', async () => {
    const host = await render(1200, 'lessons');

    expect(host.querySelector('#time-zone')).not.toBeNull();
    expect(host.querySelector('#default-price')).not.toBeNull();
    expect(host.querySelector('#google')).not.toBeNull();
    expect(host.querySelector('tb-calendar-feed-panel')).not.toBeNull();
    expect(host.querySelector('#meetings')).not.toBeNull();
    expect(current(host)).toBe('Занятия');
    expect(TestBed.inject(PageDetail).value()).toBe('Занятия');
  });

  it('shows the model, the usage and the prompts in the AI assistant', async () => {
    const host = await render(1200, 'ai');
    for (const request of backend.match('/api/teacher/ai/prompts')) {
      request.flush([]);
    }
    for (const request of backend.match('/api/teacher/ai/system-prompts')) {
      request.flush([systemPrompt()]);
    }
    await fixture.whenStable();

    const text = readableText(host);
    expect(text).toContain('Модель');
    expect(host.querySelector('#prompt-library')).not.toBeNull();
    expect(host.querySelector('#system-prompts')).not.toBeNull();
    expect(host.querySelector('tb-ai-settings-panel tb-page-header')).toBeNull();
    expect(current(host)).toBe('ИИ-помощник');
  });

  it('shows the failed deliveries first in the messengers, then the bots and the students', async () => {
    const host = await render(1200, 'messengers');

    const text = readableText(host);
    expect(text).toContain('Неудачные доставки');
    expect(text).toContain('Мария Telegram Telegram 403: Forbidden: bot was blocked by the user');
    expect(text).toContain('Вы MAX —');
    expect(text.indexOf('Неудачные доставки')).toBeLessThan(text.indexOf('Что умеет бот'));
    expect(text).toContain('Подключили мессенджер');
    // own messengers, devices and what to send are in «Мой аккаунт»
    expect(text).not.toContain('Что присылать');
    expect(current(host)).toBe('Мессенджеры');
  });

  it('says last when every notification was delivered, without a badge', async () => {
    const host = await render(1200, 'messengers', 'messengers', {
      channels: [],
      failedDeliveries: [],
    });

    const text = readableText(host);
    expect(text).toContain('Все уведомления доставлены');
    expect(text.indexOf('Все уведомления доставлены')).toBeGreaterThan(
      text.indexOf('Подключили мессенджер'),
    );
    expect(text).toContain('Мессенджеры Боты не подключены');
    expect(host.querySelector('p-tag')).toBeNull();
  });

  describe('leaving a form not saved', () => {
    /** The answers of «Отменить изменения?», one per question. */
    function answer(...answers: boolean[]): void {
      const confirmation = fixture.debugElement.injector.get(ConfirmationService);
      vi.spyOn(confirmation, 'confirm').mockImplementation((request) => {
        if (answers.shift() === true) {
          request.accept?.();
        } else {
          request.reject?.();
        }
        return confirmation;
      });
    }

    it('leaves a clean category without a question', async () => {
      await render(1200, 'portal');

      expect(fixture.componentInstance.canLeave()).toBe(true);
    });

    it('leaves a category other than the portal without a question: it saves on change', async () => {
      await render(1200, 'lessons');
      vi.spyOn(TestBed.inject(UnsavedChanges), 'dirty').mockReturnValue(true);

      expect(fixture.componentInstance.canLeave()).toBe(true);
    });

    it('asks «Отменить изменения?» about a typed form and obeys the answer', async () => {
      const host = await render(1200, 'portal');
      answer(false, true);

      typeInto(requireElement(host, '#portal-name', HTMLInputElement), 'Школа Анны');

      await expect(fixture.componentInstance.canLeave()).resolves.toBe(false);
      await expect(fixture.componentInstance.canLeave()).resolves.toBe(true);
    });

    it('stops a reload with the browser prompt only while the form is changed', async () => {
      const host = await render(1200, 'portal');
      const reload = (): boolean => {
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      };

      expect(reload()).toBe(false);
      typeInto(requireElement(host, '#portal-name', HTMLInputElement), 'Школа Анны');
      expect(reload()).toBe(true);

      fixture.destroy();
      expect(reload()).toBe(false);
    });
  });
});
