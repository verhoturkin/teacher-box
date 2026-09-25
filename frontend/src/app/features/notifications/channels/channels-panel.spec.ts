import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { channel, linkCode } from '@testing/notification-fixtures';
import { bodyText, buttonByText, hostElement, readableText } from '@testing/dom';
import { ChannelState } from '../data-access/notifications.models';
import { ChannelsPanel, LINK_POLL_INTERVAL_MS } from './channels-panel';

describe('ChannelsPanel', () => {
  let fixture: ComponentFixture<ChannelsPanel>;
  let backend: HttpTestingController;
  let messages: MessageService;

  async function render(channels: ChannelState[], teacher = false): Promise<void> {
    TestBed.configureTestingModule({
      imports: [ChannelsPanel],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG(), MessageService],
    });
    backend = TestBed.inject(HttpTestingController);
    messages = TestBed.inject(MessageService);
    vi.spyOn(messages, 'add');
    fixture = TestBed.createComponent(ChannelsPanel);
    fixture.componentRef.setInput('teacher', teacher);
    fixture.detectChanges();
    backend.expectOne('/api/me/channels').flush(channels);
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    vi.useRealTimers();
  });

  it('explains to a student that messengers are not configured', async () => {
    await render([]);

    expect(readableText(hostElement(fixture))).toContain('Мессенджеры пока не подключены учителем');
  });

  it('tells the teacher how to configure bots', async () => {
    await render([], true);

    expect(readableText(hostElement(fixture))).toContain('TEACHERBOX_NOTIFICATIONS_');
  });

  it('shows connected and available messengers', async () => {
    await render([
      channel({ linked: true, enabled: true, displayName: '@maria', linkedAt: '2026-09-20T10:00:00Z' }),
      channel({ channel: 'VK' }),
    ]);

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Telegram @maria, с 20.09.2026');
    expect(text).toContain('ВКонтакте не подключён');
  });

  it('connects a messenger with a deep link and waits for the bot', async () => {
    await render([channel()]);
    vi.useFakeTimers();

    buttonByText(hostElement(fixture), 'Подключить').click();
    backend.expectOne('/api/me/channels/TELEGRAM/link-code').flush(linkCode());
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);

    expect(bodyText()).toContain('ABCD-2345');
    expect(bodyText()).toContain('Открыть Telegram');
    const open = Array.from(document.body.querySelectorAll('a')).find((a) => a.textContent.includes('Открыть'));
    expect(open?.getAttribute('href')).toBe('https://t.me/teacher_bot?start=ABCD2345');

    await vi.advanceTimersByTimeAsync(LINK_POLL_INTERVAL_MS);
    backend.expectOne('/api/me/channels').flush([channel()]);
    await vi.advanceTimersByTimeAsync(LINK_POLL_INTERVAL_MS);
    backend.expectOne('/api/me/channels').flush([channel({ linked: true, enabled: true, displayName: '@maria' })]);
    fixture.detectChanges();

    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Telegram подключён' }));
    await vi.advanceTimersByTimeAsync(LINK_POLL_INTERVAL_MS);
    backend.expectNone('/api/me/channels');
    expect(readableText(hostElement(fixture))).toContain('@maria');
  });

  it('asks to send the code manually when the messenger has no start links', async () => {
    await render([channel({ channel: 'VK' })]);

    buttonByText(hostElement(fixture), 'Подключить').click();
    backend
      .expectOne('/api/me/channels/VK/link-code')
      .flush(linkCode({ channel: 'VK', url: 'https://vk.me/club1', code: 'EFGH-6789' }));
    fixture.detectChanges();
    await fixture.whenStable();

    const text = readableText(document.body);
    expect(text).toContain('Отправьте этот код боту ВКонтакте в личные сообщения');
    expect(text).toContain('EFGH-6789');

    fixture.componentInstance.closeLink();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(bodyText()).not.toContain('EFGH-6789');
  });

  it('shows the code without a link when the bot address is unknown', async () => {
    await render([channel({ channel: 'MAX' })]);

    fixture.componentInstance.connect('MAX');
    backend.expectOne('/api/me/channels/MAX/link-code').flush(linkCode({ channel: 'MAX', url: null }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(readableText(document.body)).toContain('Отправьте этот код боту MAX в личные сообщения');
    fixture.componentInstance.onLinkVisibleChange(true);
    expect(bodyText()).toContain('ABCD-2345');
    fixture.componentInstance.onLinkVisibleChange(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(bodyText()).not.toContain('ABCD-2345');
  });

  it('pauses and disconnects a messenger', async () => {
    await render([channel({ linked: true, enabled: true, displayName: '@maria' }), channel({ channel: 'MAX' })]);

    fixture.componentInstance.setEnabled('TELEGRAM', false);
    const toggle = backend.expectOne('/api/me/channels/TELEGRAM');
    expect(toggle.request.body).toEqual({ enabled: false });
    toggle.flush(channel({ linked: true, enabled: false, displayName: '@maria' }));
    await fixture.whenStable();

    buttonByText(hostElement(fixture), 'Отключить Telegram').click();
    backend.expectOne({ method: 'DELETE', url: '/api/me/channels/TELEGRAM' }).flush(null);
    backend.expectOne('/api/me/channels').flush([channel(), channel({ channel: 'MAX' })]);
    await fixture.whenStable();

    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Telegram отключён' }));
    expect(readableText(hostElement(fixture))).toContain('Telegram не подключён');
  });
});
