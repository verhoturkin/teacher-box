import { HttpTestingController } from '@angular/common/http/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SwPush } from '@angular/service-worker';
import { BehaviorSubject, of } from 'rxjs';
import { BREAKPOINT_QUERIES, WindowSize } from '@core/layout/mobile';
import { PUSH_DEVICE_KEY, PushDevice } from '@core/push/web-push';
import { Snackbar } from '@core/snackbar/snackbar';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { channel, linkCode, preferences } from '@testing/notification-fixtures';
import { testProviders } from '@testing/setup';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import {
  ChannelState,
  GuardianCategory,
  NotificationPreferences,
} from '../data-access/notifications.models';
import { LINK_POLL_INTERVAL_MS, NotificationsSection, QUIET_TIMES } from './notifications-section';

const THIS_DEVICE: PushDevice = {
  id: 'd1',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537',
  createdAt: '2026-10-28T10:00:00Z',
  lastSuccessAt: null,
  failing: false,
};
const OTHER: PushDevice = { ...THIS_DEVICE, id: 'd2', userAgent: null, failing: true };
const BOT = { teacherActions: true, teacherMenu: [], studentMenu: [], guardianMenu: [] };

interface Setup {
  channels?: ChannelState[];
  devices?: PushDevice[];
  saved?: NotificationPreferences;
  teacher?: boolean;
  /** A parent (ADR-0069) and the categories they switched off. */
  guardian?: GuardianCategory[];
  push?: boolean;
  permission?: string;
  size?: WindowSize;
}

describe('QUIET_TIMES', () => {
  it('lists every half hour of the day', () => {
    expect(QUIET_TIMES).toHaveLength(48);
    expect(QUIET_TIMES[0]).toBe('00:00');
    expect(QUIET_TIMES[47]).toBe('23:30');
  });
});

describe('NotificationsSection', () => {
  const subscription = new BehaviorSubject<unknown>(null);
  const requestSubscription = vi.fn();
  let fixture: ComponentFixture<NotificationsSection>;
  let backend: HttpTestingController;

  async function render(setup: Setup = {}): Promise<void> {
    vi.stubGlobal('PushManager', () => undefined);
    vi.stubGlobal('Notification', { permission: setup.permission ?? 'default' });
    TestBed.configureTestingModule({
      imports: [NotificationsSection],
      providers: testProviders(
        {
          provide: BreakpointObserver,
          useValue: {
            observe: (query: string) =>
              of({
                matches: query === BREAKPOINT_QUERIES[setup.size ?? 'expanded'],
                breakpoints: {},
              }),
          },
        },
        {
          provide: SwPush,
          useValue: {
            isEnabled: setup.push ?? true,
            subscription,
            requestSubscription,
            unsubscribe: () => Promise.resolve(),
          },
        },
      ),
    });
    if (setup.guardian !== undefined) {
      TestBed.inject(AuthService).acceptSession(authResponse('GUARDIAN'));
    }
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationsSection);
    fixture.componentRef.setInput('teacher', setup.teacher ?? false);
    fixture.detectChanges();
    backend.expectOne('/api/me/channels').flush(setup.channels ?? []);
    backend.expectOne('/api/me/push/subscriptions').flush(setup.devices ?? []);
    backend.match('/api/me/push/key').forEach((request) => {
      request.flush({ key: 'KEY' });
    });
    backend.expectOne('/api/me/notifications/preferences').flush(setup.saved ?? preferences());
    if (setup.teacher === true) {
      backend.expectOne('/api/teacher/notifications/bot').flush(BOT);
    }
    if (setup.guardian !== undefined) {
      backend
        .expectOne('/api/guardian/notifications/preferences')
        .flush({ disabledCategories: setup.guardian });
    }
    await fixture.whenStable();
  }

  function text(): string {
    return readableText(hostElement(fixture));
  }

  function toggle(id: string): HTMLInputElement {
    return requireElement(hostElement(fixture), `#${id}`, HTMLInputElement);
  }

  async function click(id: string): Promise<void> {
    toggle(id).click();
    await fixture.whenStable();
  }

  beforeEach(() => {
    subscription.next(null);
    requestSubscription.mockReset();
    requestSubscription.mockResolvedValue({
      toJSON: () => ({ endpoint: 'https://push/1', keys: { p256dh: 'p', auth: 'a' } }),
    });
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true });
    vi.restoreAllMocks();
  });

  describe('where to send', () => {
    it('is two cards on a wide window and one below', async () => {
      await render();
      const titles = (): string[] =>
        Array.from(hostElement(fixture).querySelectorAll('.p-card-title'), (title) =>
          title.textContent.trim(),
        );
      expect(titles()).toEqual(['Куда присылать уведомления', 'Что присылать']);
      fixture.destroy();
      TestBed.resetTestingModule();
      await render({ size: 'medium' });
      expect(titles()).toEqual(['Уведомления']);
    });

    it('lists the messengers and the devices in one list', async () => {
      localStorage.setItem(PUSH_DEVICE_KEY, 'd1');
      subscription.next({});
      await render({
        channels: [
          channel({
            linked: true,
            enabled: false,
            displayName: '@maria',
            linkedAt: '2026-09-20T10:00:00Z',
          }),
          channel({ channel: 'VK' }),
        ],
        devices: [THIS_DEVICE, OTHER],
      });

      expect(text()).toContain('Telegram @maria, с 20.09.2026 · на паузе');
      expect(text()).toContain('ВКонтакте Не подключён');
      expect(text()).toContain('Это устройство Chrome · Windows');
      expect(text()).toContain('Устройство Включено 28.10.2026 · уведомления не доходят');
      expect(toggle('notify-channel-TELEGRAM').checked).toBe(false);
      expect(toggle('notify-this-device').checked).toBe(true);
      // a student who connected a messenger is not asked again
      expect(text()).not.toContain('Подключите мессенджер');
    });

    it('connects a messenger from the alert of a student and waits for the bot', async () => {
      await render({ channels: [channel(), channel({ channel: 'VK' })] });
      const success = vi.spyOn(TestBed.inject(Snackbar), 'success');
      vi.useFakeTimers();

      expect(text()).toContain('Подключите мессенджер');
      buttonByText(hostElement(fixture), 'Подключить Telegram').click();
      backend.expectOne('/api/me/channels/TELEGRAM/link-code').flush(linkCode());
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      expect(requireElement(document.body, 'tb-copy-field input', HTMLInputElement).value).toBe(
        'ABCD-2345',
      );

      await vi.advanceTimersByTimeAsync(LINK_POLL_INTERVAL_MS);
      backend.expectOne('/api/me/channels').flush([channel(), channel({ channel: 'VK' })]);
      await vi.advanceTimersByTimeAsync(LINK_POLL_INTERVAL_MS);
      backend
        .expectOne('/api/me/channels')
        .flush([channel({ linked: true, enabled: true, displayName: '@maria' })]);
      fixture.detectChanges();

      expect(success).toHaveBeenCalledWith('Telegram подключён');
      await vi.advanceTimersByTimeAsync(LINK_POLL_INTERVAL_MS);
      backend.expectNone('/api/me/channels');
      expect(text()).not.toContain('Подключите мессенджер');
    });

    it('connects a messenger from its row and closes the code', async () => {
      await render({ channels: [channel({ channel: 'VK' })], teacher: true });

      // the teacher gets no alert
      expect(text()).not.toContain('Подключите мессенджер');
      buttonByText(hostElement(fixture), 'Подключить').click();
      backend
        .expectOne('/api/me/channels/VK/link-code')
        .flush(linkCode({ channel: 'VK', code: 'EFGH-6789' }));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(requireElement(document.body, 'tb-copy-field input', HTMLInputElement).value).toBe(
        'EFGH-6789',
      );

      fixture.componentInstance.onLinkVisibleChange(true);
      fixture.componentInstance.onLinkVisibleChange(false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.body.querySelector('tb-copy-field')).toBeNull();
    });

    it('pauses and disconnects a messenger', async () => {
      const linked = channel({ linked: true, enabled: true, displayName: '@maria' });
      await render({ channels: [linked] });
      const info = vi.spyOn(TestBed.inject(Snackbar), 'info');

      await click('notify-channel-TELEGRAM');
      const pause = backend.expectOne('/api/me/channels/TELEGRAM');
      expect(pause.request.body).toEqual({ enabled: false });
      pause.flush({ ...linked, enabled: false });
      await fixture.whenStable();
      expect(text()).toContain('на паузе');

      await click('notify-channel-TELEGRAM');
      backend.expectOne('/api/me/channels/TELEGRAM').flush(null, {
        status: 500,
        statusText: 'Error',
      });
      await fixture.whenStable();
      expect(toggle('notify-channel-TELEGRAM').checked).toBe(false);

      buttonByText(hostElement(fixture), 'Отключить Telegram').click();
      backend.expectOne({ method: 'DELETE', url: '/api/me/channels/TELEGRAM' }).flush(null);
      backend.expectOne('/api/me/channels').flush([channel()]);
      await fixture.whenStable();
      expect(info).toHaveBeenCalledWith('Telegram отключён');
      expect(text()).toContain('Telegram Не подключён');
    });

    it('turns notifications on for this device', async () => {
      await render();
      const success = vi.spyOn(TestBed.inject(Snackbar), 'success');

      buttonByText(hostElement(fixture), 'Подключить').click();
      const request = await vi.waitFor(() => backend.expectOne('/api/me/push/subscriptions'));
      request.flush(THIS_DEVICE);
      subscription.next({});
      await fixture.whenStable();

      expect(requestSubscription).toHaveBeenCalledWith({ serverPublicKey: 'KEY' });
      expect(success).toHaveBeenCalledWith('Уведомления на этом устройстве включены');
      expect(toggle('notify-this-device').checked).toBe(true);
    });

    it('says why this device could not be turned on', async () => {
      await render();
      const error = vi.spyOn(TestBed.inject(Snackbar), 'error');
      requestSubscription.mockRejectedValueOnce(new Error('push service error'));

      buttonByText(hostElement(fixture), 'Подключить').click();
      await vi.waitFor(() => {
        expect(error).toHaveBeenCalledWith('Не удалось включить уведомления');
      });

      requestSubscription.mockRejectedValueOnce(new Error('NotAllowedError'));
      vi.stubGlobal('Notification', { permission: 'denied' });
      buttonByText(hostElement(fixture), 'Подключить').click();
      await vi.waitFor(() => {
        expect(error.mock.calls[1]?.[0]).toContain('Браузер запретил уведомления');
      });
      fixture.detectChanges();
      expect(text()).toContain('Браузер запретил уведомления');
    });

    it('turns a device off; a failure keeps it on', async () => {
      await render({ devices: [OTHER] });
      const info = vi.spyOn(TestBed.inject(Snackbar), 'info');

      await click('notify-device-d2');
      (await vi.waitFor(() => backend.expectOne('/api/me/push/subscriptions/d2'))).flush(null, {
        status: 500,
        statusText: 'Error',
      });
      await fixture.whenStable();
      expect(toggle('notify-device-d2').checked).toBe(true);

      await click('notify-device-d2');
      (await vi.waitFor(() => backend.expectOne('/api/me/push/subscriptions/d2'))).flush(null);
      await fixture.whenStable();
      expect(info).toHaveBeenCalledWith('Устройство отключено');
      expect(hostElement(fixture).querySelector('#notify-device-d2')).toBeNull();
    });

    it('explains a browser without notifications', async () => {
      await render({ push: false });

      expect(text()).toContain('не поддерживает уведомления');
      expect(text()).not.toContain('Подключить');
    });

    it('asks an iPhone tab to add the portal to the Home Screen', async () => {
      Object.defineProperty(navigator, 'standalone', { value: false, configurable: true });
      await render();

      expect(text()).toContain('Добавьте на экран Домой');
    });
  });

  describe('what to send', () => {
    it('gives a student the student topics and the teacher the teacher ones', async () => {
      await render();
      expect(text()).toContain('Домашние задания');
      expect(text()).not.toContain('Ученики, календарь и копии');
      expect(text()).toContain('Сообщения учителя Приходят всегда');
      expect(text()).toContain('Тихие часы Не присылать ночью');
      expect(text()).not.toContain('Действия учителя в боте');
    });

    it('gives a parent the four categories of the children’s notices instead of the topics', async () => {
      await render({ guardian: ['PAYMENTS'], channels: [channel()] });
      expect(text()).toContain('Оплаты и долги');
      expect(text()).toContain('Занятия');
      expect(text()).toContain('Сроки заданий');
      expect(text()).toContain('Проверенные работы');
      expect(text()).not.toContain('Домашние задания');
      expect(text()).not.toContain('Сообщения учителя');
      expect(text()).toContain('Тихие часы');
      expect(text()).toContain('оплате и проверенной работе ребёнка');
      expect(toggle('notify-topic-PAYMENTS').checked).toBe(false);
      expect(toggle('notify-topic-LESSONS').checked).toBe(true);
      const success = vi.spyOn(TestBed.inject(Snackbar), 'success');

      await click('notify-topic-PAYMENTS');
      const on = backend.expectOne({
        method: 'PUT',
        url: '/api/guardian/notifications/preferences',
      });
      expect(on.request.body).toEqual({ disabledCategories: [] });
      on.flush({ disabledCategories: [] });
      await fixture.whenStable();
      expect(success).toHaveBeenCalledWith('Настройки уведомлений сохранены');
      expect(toggle('notify-topic-PAYMENTS').checked).toBe(true);

      await click('notify-topic-REVIEWED_WORK');
      const off = backend.expectOne('/api/guardian/notifications/preferences');
      expect(off.request.body).toEqual({ disabledCategories: ['REVIEWED_WORK'] });
      off.flush({ disabledCategories: ['REVIEWED_WORK'] });
      await fixture.whenStable();
      expect(toggle('notify-topic-REVIEWED_WORK').checked).toBe(false);
    });

    it('puts a parent’s category back when it is not saved', async () => {
      await render({ guardian: [] });
      const error = vi.spyOn(TestBed.inject(Snackbar), 'error');

      await click('notify-topic-LESSONS');
      backend
        .expectOne('/api/guardian/notifications/preferences')
        .flush(null, { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();

      expect(error).toHaveBeenCalled();
      expect(toggle('notify-topic-LESSONS').checked).toBe(true);
    });

    it('shows a parent’s categories as chips on medium', async () => {
      await render({ size: 'medium', guardian: ['LESSONS'] });
      const chips = [
        ...hostElement(fixture).querySelectorAll<HTMLButtonElement>('.tb-notify__chip'),
      ];
      expect(chips.map((chip) => chip.getAttribute('aria-pressed'))).toEqual([
        'true',
        'false',
        'true',
        'true',
      ]);
      expect(text()).not.toContain('Сообщения учителя');

      chips[1]?.click();
      await fixture.whenStable();
      backend
        .expectOne('/api/guardian/notifications/preferences')
        .flush({ disabledCategories: [] });
      await fixture.whenStable();
      expect(chips[1]?.getAttribute('aria-pressed')).toBe('true');
    });

    it('mutes a topic at once', async () => {
      await render({ teacher: true });
      expect(text()).toContain('Ученики, календарь и копии');
      const success = vi.spyOn(TestBed.inject(Snackbar), 'success');

      await click('notify-topic-BILLING');
      const request = backend.expectOne({
        method: 'PUT',
        url: '/api/me/notifications/preferences',
      });
      expect(request.request.body).toEqual(preferences({ mutedTopics: ['BILLING'] }));
      request.flush(preferences({ mutedTopics: ['BILLING'] }));
      await fixture.whenStable();

      expect(success).toHaveBeenCalledWith('Настройки уведомлений сохранены');
      expect(toggle('notify-topic-BILLING').checked).toBe(false);

      await click('notify-topic-BILLING');
      backend
        .expectOne('/api/me/notifications/preferences')
        .flush(preferences({ mutedTopics: [] }));
      await fixture.whenStable();
      expect(toggle('notify-topic-BILLING').checked).toBe(true);
    });

    it('turns quiet hours on, moves them and turns them off', async () => {
      await render();

      await click('notify-quiet');
      const on = backend.expectOne('/api/me/notifications/preferences');
      expect(on.request.body).toEqual(preferences({ quietFrom: '22:00', quietTo: '08:00' }));
      on.flush(preferences({ quietFrom: '22:00:00', quietTo: '08:00:00' }));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(text()).toContain('С 22:00 до 08:00');

      fixture.debugElement
        .query(By.css('p-select[inputId="quiet-from"]'))
        .triggerEventHandler('onChange', { value: '23:00' });
      backend
        .expectOne('/api/me/notifications/preferences')
        .flush(preferences({ quietFrom: '23:00:00', quietTo: '08:00:00' }));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(text()).toContain('С 23:00 до 08:00');

      await click('notify-quiet');
      const off = backend.expectOne('/api/me/notifications/preferences');
      expect(off.request.body).toEqual(preferences());
      off.flush(preferences());
      await fixture.whenStable();
      expect(text()).toContain('Не присылать ночью');
    });

    it('puts the switch back and explains a rejected setting', async () => {
      await render();
      const error = vi.spyOn(TestBed.inject(Snackbar), 'error');

      await click('notify-topic-HOMEWORK');
      backend
        .expectOne('/api/me/notifications/preferences')
        .flush(
          { status: 422, code: 'notification.quiet-hours-invalid' },
          { status: 422, statusText: 'Unprocessable Content' },
        );
      await fixture.whenStable();

      expect(error).toHaveBeenCalledWith(expect.stringContaining('тихих часов'));
      expect(toggle('notify-topic-HOMEWORK').checked).toBe(true);
    });

    it('lets the teacher turn actions in the bot off', async () => {
      await render({ teacher: true });
      expect(toggle('notify-teacher-actions').checked).toBe(true);

      await click('notify-teacher-actions');
      const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/notifications/bot' });
      expect(request.request.body).toEqual({ teacherActions: false });
      request.flush({ ...BOT, teacherActions: false });
      await fixture.whenStable();
      expect(toggle('notify-teacher-actions').checked).toBe(false);

      await click('notify-teacher-actions');
      backend
        .expectOne({ method: 'PUT', url: '/api/teacher/notifications/bot' })
        .flush(null, { status: 500, statusText: 'Error' });
      await fixture.whenStable();
      expect(toggle('notify-teacher-actions').checked).toBe(false);
    });
  });

  describe('by window size', () => {
    it('shows the topics as filter chips on medium and mutes one on a click', async () => {
      await render({ size: 'medium', channels: [channel({ channel: 'VK', linked: false })] });
      const chips = [
        ...hostElement(fixture).querySelectorAll<HTMLButtonElement>('.tb-notify__chip'),
      ];
      expect(chips.map((chip) => chip.getAttribute('aria-pressed'))).toEqual(
        chips.map(() => 'true'),
      );
      expect(text()).toContain('Сообщения учителя приходят всегда.');

      chips[0]?.click();
      await fixture.whenStable();
      const request = backend.expectOne({
        method: 'PUT',
        url: '/api/me/notifications/preferences',
      });
      expect(request.request.body).toEqual(preferences({ mutedTopics: ['SCHEDULE'] }));
      request.flush(preferences({ mutedTopics: ['SCHEDULE'] }));
      await fixture.whenStable();
      expect(chips[0]?.getAttribute('aria-pressed')).toBe('false');
    });

    it('offers «Ещё мессенджер» for the messengers not connected yet on medium', async () => {
      await render({ size: 'medium', channels: [channel({ channel: 'VK', linked: false })] });
      expect(text()).toContain('Ещё мессенджер');
      expect(text()).not.toContain('Не подключён');
    });

    it('opens «Тихие часы» as its own screen on a phone', async () => {
      await render({ size: 'compact' });
      expect(hostElement(fixture).querySelector('#notify-quiet')).toBeNull();
      buttonByText(hostElement(fixture), 'Тихие часы').click();
      await fixture.whenStable();
      expect(document.body.textContent).toContain('Не присылать ночью');
      expect(document.body.querySelector('#notify-quiet')).not.toBeNull();
    });
  });
});
