import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { buttonByText, readableText, requireElement, typeInto } from '@testing/dom';
import { channelSetup, linkCode } from '@testing/notification-fixtures';
import { LINK_POLL_INTERVAL_MS } from '../channels/channels-panel';
import { ChannelSetup, ChannelType } from '../data-access/notifications.models';
import { BotWizardDialog } from './bot-wizard-dialog';

describe('BotWizardDialog', () => {
  let fixture: ComponentFixture<BotWizardDialog>;
  let backend: HttpTestingController;
  let changed: ChannelSetup[];

  async function open(setup: ChannelSetup | null, channel: ChannelType = setup?.channel ?? 'TELEGRAM'): Promise<void> {
    TestBed.configureTestingModule({
      imports: [BotWizardDialog],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BotWizardDialog);
    changed = [];
    fixture.componentInstance.changed.subscribe((saved) => changed.push(saved));
    fixture.componentRef.setInput('channel', channel);
    fixture.componentRef.setInput('setup', setup);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function text(): string {
    return readableText(document.body);
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    vi.useRealTimers();
  });

  it('walks the teacher through a new Telegram bot', async () => {
    const configured = channelSetup({ configured: true, botName: '@school_bot' });
    await open(channelSetup());
    expect(text()).toContain('Подключение Telegram');
    expect(text()).toContain('/newbot');

    buttonByText(document.body, 'Бот создан, дальше').click();
    await settle();
    typeInto(requireElement(document.body, '#bot-token', HTMLInputElement), ' 123:ABC ');
    await settle();
    buttonByText(document.body, 'Проверить и сохранить').click();
    const save = backend.expectOne('/api/teacher/notifications/channels/TELEGRAM');
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({ token: '123:ABC', groupId: null });
    save.flush(configured);
    await settle();

    expect(text()).toContain('Бот @school_bot работает');
    expect(changed).toEqual([configured]);

    vi.useFakeTimers();
    buttonByText(document.body, 'Подключить мой аккаунт').click();
    backend.expectOne('/api/me/channels/TELEGRAM/link-code').flush(linkCode());
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    expect(text()).toContain('ABCD-2345');

    await vi.advanceTimersByTimeAsync(LINK_POLL_INTERVAL_MS);
    backend.expectOne('/api/teacher/notifications/channels').flush([configured]);
    await vi.advanceTimersByTimeAsync(LINK_POLL_INTERVAL_MS);
    backend.expectOne('/api/teacher/notifications/channels').flush([{ ...configured, teacherLinked: true }]);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(LINK_POLL_INTERVAL_MS);
    backend.expectNone('/api/teacher/notifications/channels');
    vi.useRealTimers();
    await settle();

    expect(text()).toContain('Отправим вам тестовое сообщение');
    buttonByText(document.body, 'Отправить тестовое сообщение').click();
    backend.expectOne('/api/teacher/notifications/channels/TELEGRAM/test').flush(null);
    await settle();
    expect(text()).toContain('Тестовое сообщение отправлено');

    buttonByText(document.body, 'Готово').click();
    await settle();
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('shows why the messenger rejected the token', async () => {
    await open(channelSetup());
    fixture.componentInstance.go(2);
    await settle();

    fixture.componentInstance.form.setValue({ token: 'wrong', groupId: null });
    fixture.componentInstance.saveToken();
    fixture.componentInstance.saveToken();
    backend
      .expectOne('/api/teacher/notifications/channels/TELEGRAM')
      .flush(
        { status: 422, code: 'notifications.channel-check-failed', detail: 'Telegram 401: Unauthorized' },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    await settle();

    expect(text()).toContain('Мессенджер не принял токен. Проверьте его и попробуйте снова. Ответ мессенджера: Telegram 401: Unauthorized');
    fixture.componentInstance.go(3);
    await settle();
    expect(text()).toContain('Проверить и сохранить');
  });

  it('asks for the community number of a VK bot', async () => {
    await open(channelSetup({ channel: 'VK' }));
    expect(text()).toContain('Long Poll API');
    fixture.componentInstance.go(2);
    await settle();
    expect(text()).toContain('Ключ доступа сообщества');

    fixture.componentInstance.form.controls.token.setValue('vk-key');
    expect(fixture.componentInstance.form.invalid).toBe(true);
    fixture.componentInstance.form.controls.groupId.setValue(42);
    fixture.componentInstance.saveToken();
    const save = backend.expectOne('/api/teacher/notifications/channels/VK');
    expect(save.request.body).toEqual({ token: 'vk-key', groupId: 42 });
    save.flush(channelSetup({ channel: 'VK', configured: true, botName: 'Школа', teacherLinked: true }));
    await settle();

    expect(text()).toContain('Отправим вам тестовое сообщение');
  });

  it('explains MAX bots', async () => {
    await open(null, 'MAX');

    expect(text()).toContain('dev.max.ru');
  });

  it('continues a configured bot from connecting the account and can be skipped', async () => {
    await open(channelSetup({ channel: 'MAX', configured: true, fromEnvironment: true }));
    expect(text()).toContain('Чтобы уведомления приходили и вам');

    fixture.componentInstance.go(4);
    await settle();
    expect(text()).toContain('Чтобы уведомления приходили и вам');
    fixture.componentInstance.go(2);
    await settle();
    expect(text()).toContain('задан в переменных окружения сервера');

    fixture.componentInstance.go(3);
    await settle();
    buttonByText(document.body, 'Пропустить').click();
    await settle();
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('stops waiting for the account when closed', async () => {
    await open(channelSetup({ configured: true, botName: '@school_bot' }));
    vi.useFakeTimers();

    fixture.componentInstance.connect();
    backend.expectOne('/api/me/channels/TELEGRAM/link-code').flush(linkCode());
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(LINK_POLL_INTERVAL_MS * 2);

    backend.expectNone('/api/teacher/notifications/channels');
  });

  it('survives a failed link code request', async () => {
    await open(channelSetup({ configured: true }));

    fixture.componentInstance.connect();
    backend.expectOne('/api/me/channels/TELEGRAM/link-code').flush(null, { status: 500, statusText: 'Error' });
    await settle();

    expect(text()).toContain('Подключить мой аккаунт');
  });

  it('reports a failed test message with the messenger answer', async () => {
    await open(channelSetup({ configured: true, teacherLinked: true, botName: '@school_bot' }));
    expect(text()).toContain('Отправим вам тестовое сообщение');
    fixture.componentInstance.go(3);
    await settle();
    expect(text()).toContain('Ваш аккаунт Telegram уже подключён');
    buttonByText(document.body, 'Дальше').click();
    await settle();

    fixture.componentInstance.sendTest();
    fixture.componentInstance.sendTest();
    backend
      .expectOne('/api/teacher/notifications/channels/TELEGRAM/test')
      .flush(
        { status: 422, code: 'notifications.test-failed', detail: 'Forbidden: bot was blocked by the user' },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    await settle();

    expect(text()).toContain('Не удалось отправить тестовое сообщение. Ответ мессенджера: Forbidden: bot was blocked');
  });

  it('does not repeat other errors details', async () => {
    await open(channelSetup({ configured: true, teacherLinked: true }));

    fixture.componentInstance.sendTest();
    backend
      .expectOne('/api/teacher/notifications/channels/TELEGRAM/test')
      .flush(
        { status: 404, code: 'notifications.channel-not-linked', detail: 'Messenger TELEGRAM is not connected' },
        { status: 404, statusText: 'Not Found' },
      );
    await settle();

    expect(text()).toContain('Мессенджер не подключён');
    expect(text()).not.toContain('is not connected');
  });
});
