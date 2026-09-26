import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { channel } from '@testing/notification-fixtures';
import { ChannelState } from '../data-access/notifications.models';
import { CONNECT_DISMISSED_KEY, ConnectMessengerCard } from './connect-messenger-card';

describe('ConnectMessengerCard', () => {
  let fixture: ComponentFixture<ConnectMessengerCard>;
  let backend: HttpTestingController;

  function create(): void {
    TestBed.configureTestingModule({
      imports: [ConnectMessengerCard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ConnectMessengerCard);
    fixture.detectChanges();
  }

  async function render(channels: ChannelState[]): Promise<void> {
    create();
    backend.expectOne('/api/me/channels').flush(channels);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function text(): string {
    return readableText(hostElement(fixture));
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('invites to connect one of the messengers', async () => {
    await render([channel(), channel({ channel: 'VK' }), channel({ channel: 'MAX' })]);

    expect(text()).toContain('Подключите Telegram, ВКонтакте или MAX');
    const link = hostElement(fixture).querySelector('a');
    expect(link?.getAttribute('href')).toBe('/cabinet/notifications');
  });

  it('names the only messenger', async () => {
    await render([channel({ channel: 'MAX' })]);

    expect(text()).toContain('Подключите MAX —');
  });

  it('stays hidden when a messenger is connected or none is configured', async () => {
    await render([channel({ linked: true }), channel({ channel: 'VK' })]);
    expect(text()).toBe('');

    fixture.destroy();
    TestBed.resetTestingModule();
    await render([]);
    expect(text()).toBe('');
  });

  it('is postponed until the browser forgets it', async () => {
    await render([channel()]);

    buttonByText(hostElement(fixture), 'Не сейчас').click();
    fixture.detectChanges();
    expect(text()).toBe('');
    expect(localStorage.getItem(CONNECT_DISMISSED_KEY)).toBe('1');

    fixture.destroy();
    TestBed.resetTestingModule();
    create();
    backend.expectNone('/api/me/channels');
    expect(text()).toBe('');
  });

  it('works without browser storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    await render([channel()]);

    buttonByText(hostElement(fixture), 'Не сейчас').click();
    fixture.detectChanges();

    expect(text()).toBe('');
  });
});
