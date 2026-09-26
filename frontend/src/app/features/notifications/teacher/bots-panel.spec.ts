import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { channelSetup } from '@testing/notification-fixtures';
import { ChannelSetup } from '../data-access/notifications.models';
import { BotsPanel } from './bots-panel';

describe('BotsPanel', () => {
  let fixture: ComponentFixture<BotsPanel>;
  let backend: HttpTestingController;
  let messages: MessageService;
  let changes: number;

  async function render(bots: ChannelSetup[]): Promise<void> {
    TestBed.configureTestingModule({
      imports: [BotsPanel],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG(), MessageService],
    });
    backend = TestBed.inject(HttpTestingController);
    messages = TestBed.inject(MessageService);
    vi.spyOn(messages, 'add');
    fixture = TestBed.createComponent(BotsPanel);
    changes = 0;
    fixture.componentInstance.changed.subscribe(() => changes++);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/notifications/channels').flush(bots);
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('shows the state of every bot', async () => {
    await render([
      channelSetup({
        configured: true,
        botName: '@school_bot',
        teacherLinked: true,
        connection: { channel: 'TELEGRAM', connection: 'ERROR', error: 'Connection timed out', checkedAt: null },
      }),
      channelSetup({
        channel: 'VK',
        configured: true,
        fromEnvironment: true,
        connection: { channel: 'VK', connection: 'OK', error: null, checkedAt: null },
      }),
      channelSetup({ channel: 'MAX' }),
    ]);

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Telegram @school_bot');
    expect(text).toContain('Нет связи');
    expect(text).toContain('Connection timed out');
    expect(text).toContain('TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY');
    expect(text).toContain('ВКонтакте бот из настроек сервера · ваш аккаунт не подключён');
    expect(text).toContain('Работает');
    expect(text).toContain('MAX не подключён');
    expect(() => buttonByText(hostElement(fixture), 'Отключить бота ВКонтакте')).toThrow();
  });

  it('opens the wizard and keeps its result', async () => {
    await render([channelSetup({ channel: 'MAX' })]);

    buttonByText(hostElement(fixture), 'Подключить').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(readableText(document.body)).toContain('Подключение MAX');

    fixture.componentInstance.onChanged(channelSetup({ channel: 'MAX', configured: true, botName: '@max_bot' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('MAX @max_bot');
    expect(changes).toBe(1);

    fixture.componentInstance.onWizardVisibleChange(false);
    backend
      .expectOne('/api/teacher/notifications/channels')
      .flush([channelSetup({ channel: 'MAX', configured: true, botName: '@max_bot', teacherLinked: true })]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(readableText(hostElement(fixture))).toContain('Проверить');
  });

  it('removes a bot after confirmation', async () => {
    await render([channelSetup({ configured: true, botName: '@school_bot', teacherLinked: true })]);
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    const confirm = vi.spyOn(confirmation, 'confirm');

    buttonByText(hostElement(fixture), 'Отключить бота Telegram').click();
    const options = confirm.mock.calls[0]?.[0];
    options?.accept?.();
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/notifications/channels/TELEGRAM' }).flush(null);
    backend.expectOne('/api/teacher/notifications/channels').flush([channelSetup()]);
    await fixture.whenStable();

    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Бот Telegram отключён' }));
    expect(readableText(hostElement(fixture))).toContain('Telegram не подключён');
    expect(changes).toBe(1);
  });
});
